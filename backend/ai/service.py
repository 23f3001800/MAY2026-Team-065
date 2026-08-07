"""AI service facade -- the single entry point every route uses.

Owns the hybrid policy:

* **Categorisation, severity and duplicates** are computed by the deterministic
  rules engine. It is the authority for these, because triage must stay
  reproducible and must not depend on a network call at complaint-submission time.
* **Gemini refines** those results when a key is configured: it can raise (never
  silently lower) severity on evidence the lexicon missed, and it re-ranks
  category when the rules engine was not confident.
* **Vision, write-ups and the assistant** are LLM-only. Without a key they report
  themselves unavailable rather than returning invented output.

Every LLM call is wrapped so that an upstream failure degrades to the rules
result instead of failing the citizen's request.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence

from . import rules
from .config import AISettings, load_settings
from .gemini import GeminiClient
from .provider import (
    AIProviderError,
    CategoryResult,
    CategorySuggestion,
    DuplicateResult,
    SeverityResult,
    TriageResult,
    VisionResult,
    highest_severity,
    severity_rank,
)
from .rules import CategoryRecord, ComplaintRecord
from .text import truncate

logger = logging.getLogger(__name__)

_SEVERITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

_TRIAGE_SYSTEM_PROMPT = (
    "You are a triage assistant for a municipal complaint system. You classify "
    "civic infrastructure issues reported by citizens. Be factual and concise. "
    "Base your answer only on the complaint text provided. Do not invent details, "
    "locations, or names. Do not identify individual people."
)

_VISION_SYSTEM_PROMPT = (
    "You analyse photographs attached to municipal infrastructure complaints. "
    "Describe only the visible infrastructure problem. "
    "Do NOT describe, identify or count people, faces, clothing, vehicle "
    "registration numbers, or house numbers. If the photo shows no civic "
    "infrastructure issue, say so plainly and return low confidence."
)

_WRITEUP_SYSTEM_PROMPT = (
    "You rewrite citizen complaint reports into clear, neutral, single-paragraph "
    "summaries for municipal officers. Preserve every concrete fact. Add nothing "
    "that is not in the source text. Do not speculate about blame or cost."
)


def _category_schema(category_ids: Sequence[str]) -> Dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "categoryId": {"type": "string", "enum": list(category_ids)},
            "severity": {"type": "string", "enum": _SEVERITY_VALUES},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "reason": {"type": "string"},
        },
        "required": ["categoryId", "severity", "confidence", "reason"],
    }


def _vision_schema(category_ids: Sequence[str]) -> Dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "description": {
                "type": "string",
                "description": "One or two factual sentences describing the visible issue.",
            },
            "categoryId": {"type": "string", "enum": list(category_ids) + ["UNKNOWN"]},
            "severity": {"type": "string", "enum": _SEVERITY_VALUES},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "observations": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["description", "categoryId", "severity", "confidence"],
    }


def _clamp_confidence(value: Any, default: float = 0.0) -> float:
    """Self-reported confidence is not calibrated and is not validated upstream."""
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return default


def _coerce_severity(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    upper = value.strip().upper()
    return upper if upper in _SEVERITY_VALUES else None


class AIService:
    """Facade combining the rules engine with optional Gemini refinement."""

    def __init__(
        self,
        settings: Optional[AISettings] = None,
        *,
        client: Optional[GeminiClient] = None,
    ):
        self.settings = settings or load_settings()
        # Injectable so tests can supply a stub without any network access.
        self._client = client

    # -- capability reporting -------------------------------------------

    @property
    def llm_available(self) -> bool:
        return self.settings.llm_enabled and self.settings.gemini_configured

    def status(self) -> Dict[str, Any]:
        """Describe what this deployment can actually do, for /ai/health and the UI."""
        return {
            "provider": self.settings.provider,
            "rulesEngine": "available",
            "llm": {
                "provider": "gemini",
                "model": self.settings.gemini_model if self.llm_available else None,
                "configured": self.settings.gemini_configured,
                "available": self.llm_available,
            },
            "features": {
                "categorization": "available",
                "severity": "available",
                "duplicateDetection": "available",
                "imageAnalysis": "available" if self.llm_available else "unavailable",
                "descriptionWriteup": "available" if self.llm_available else "unavailable",
                "assistant": "grounded" if self.llm_available else "degraded",
            },
        }

    def _gemini(self) -> GeminiClient:
        if self._client is None:
            self._client = GeminiClient(self.settings)
        return self._client

    # -- categorisation ---------------------------------------------------

    async def categorize(
        self, description: str, categories: Sequence[CategoryRecord]
    ) -> CategoryResult:
        """Rules-first categorisation, optionally re-ranked by Gemini."""
        result = rules.categorize(description, categories)

        if not self.llm_available or not categories:
            return result

        # Only spend a call when the deterministic engine is unsure: no match at
        # all, or a weak leader.
        best = result.best
        if best and best.confidence >= 0.6:
            return result

        refined = await self._llm_classify(description, categories)
        if refined is None:
            return result

        category, severity_hint, confidence, reason = refined
        # Put the LLM's pick first, keeping the rules ranking beneath it so the
        # officer still sees the alternatives.
        others = [s for s in result.suggestions if s.categoryId != category.categoryId]
        return CategoryResult(
            suggestions=[
                CategorySuggestion(
                    categoryId=category.categoryId,
                    name=category.name,
                    department=category.department,
                    confidence=confidence,
                    reason=reason,
                )
            ]
            + others[:4],
            source="gemini",
        )

    async def _llm_classify(
        self, description: str, categories: Sequence[CategoryRecord]
    ):
        """Ask Gemini to pick a category. Returns None on any failure."""
        by_id = {c.categoryId: c for c in categories}
        catalogue = "\n".join(
            f"- {c.categoryId}: {c.name} (department: {c.department})" for c in categories
        )
        prompt = (
            f"Available categories:\n{catalogue}\n\n"
            f"Citizen complaint:\n\"\"\"{truncate(description, 1500)}\"\"\"\n\n"
            "Choose the single best categoryId, judge the severity, and explain briefly."
        )

        try:
            payload = await self._gemini().generate_json(
                prompt=prompt,
                system_instruction=_TRIAGE_SYSTEM_PROMPT,
                response_schema=_category_schema(list(by_id.keys())),
                max_output_tokens=400,
            )
        except AIProviderError as exc:
            logger.warning("AI categorisation via Gemini failed, using rules result: %s", exc)
            return None

        # The schema's enum is not guaranteed to be enforced, so re-validate.
        category = by_id.get(str(payload.get("categoryId", "")))
        if category is None:
            logger.warning("Gemini returned an unknown categoryId; ignoring")
            return None

        return (
            category,
            _coerce_severity(payload.get("severity")),
            _clamp_confidence(payload.get("confidence"), 0.5),
            str(payload.get("reason") or "classified by Gemini")[:300],
        )

    # -- severity ----------------------------------------------------------

    async def predict_severity(
        self,
        description: str,
        category: Optional[CategoryRecord] = None,
        *,
        vision: Optional[VisionResult] = None,
    ) -> SeverityResult:
        """Score severity from text, escalated by any image evidence.

        Gemini may only *raise* severity here. Letting a model quietly downgrade
        a hazard the lexicon caught is the more dangerous failure direction for a
        public-safety system, so the rules floor always holds.
        """
        result = rules.predict_severity(description, category)

        if vision and vision.available:
            escalated = highest_severity(result.severity, vision.severity)
            if escalated != result.severity:
                result = SeverityResult(
                    severity=escalated,
                    confidence=max(result.confidence, vision.confidence),
                    reason=f"{result.reason}; raised by photo analysis: {truncate(vision.description, 120)}",
                    signals=result.signals + vision.observations[:3],
                    source="gemini-vision",
                )

        if not self.llm_available:
            return result

        llm_severity = await self._llm_severity(description, category)
        if llm_severity and severity_rank(llm_severity[0]) > severity_rank(result.severity):
            severity, confidence, reason = llm_severity
            return SeverityResult(
                severity=severity,
                confidence=max(result.confidence, confidence),
                reason=f"{result.reason}; raised by Gemini: {reason}",
                signals=result.signals,
                source="gemini",
            )

        return result

    async def _llm_severity(self, description: str, category: Optional[CategoryRecord]):
        context = f"Category: {category.name} ({category.department})\n" if category else ""
        prompt = (
            f"{context}Citizen complaint:\n\"\"\"{truncate(description, 1500)}\"\"\"\n\n"
            "Judge how urgent this is for a municipal maintenance team. "
            "CRITICAL means an immediate risk to life. HIGH means a real safety "
            "hazard or a large affected population. MEDIUM means meaningful "
            "disruption. LOW means routine maintenance."
        )
        schema = {
            "type": "object",
            "properties": {
                "severity": {"type": "string", "enum": _SEVERITY_VALUES},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "reason": {"type": "string"},
            },
            "required": ["severity", "confidence", "reason"],
        }

        try:
            payload = await self._gemini().generate_json(
                prompt=prompt,
                system_instruction=_TRIAGE_SYSTEM_PROMPT,
                response_schema=schema,
                max_output_tokens=300,
            )
        except AIProviderError as exc:
            logger.warning("AI severity via Gemini failed, using rules result: %s", exc)
            return None

        severity = _coerce_severity(payload.get("severity"))
        if not severity:
            return None
        return (
            severity,
            _clamp_confidence(payload.get("confidence"), 0.5),
            str(payload.get("reason") or "")[:300],
        )

    # -- duplicates --------------------------------------------------------

    def find_duplicates(
        self,
        description: str,
        candidates: Sequence[ComplaintRecord],
        *,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        categoryId: Optional[str] = None,
    ) -> DuplicateResult:
        """Duplicate detection is deterministic by design.

        It compares against real rows the caller already fetched, so an LLM adds
        latency without adding information the geo/text scoring lacks.
        """
        return rules.find_duplicates(
            description,
            candidates,
            latitude=latitude,
            longitude=longitude,
            categoryId=categoryId,
            radius_km=self.settings.duplicate_radius_km,
            window_days=self.settings.duplicate_window_days,
            threshold=self.settings.duplicate_similarity_threshold,
        )

    # -- vision ------------------------------------------------------------

    async def analyze_image(
        self,
        image_bytes: bytes,
        mime_type: str,
        categories: Sequence[CategoryRecord],
        *,
        hint: str = "",
    ) -> VisionResult:
        """Infer category, a written description and severity from a photo.

        Fails soft: an unconfigured key, a safety block or an upstream error all
        return ``available=False`` with a reason, never an exception. A citizen
        must still be able to file a complaint when the photo cannot be analysed.
        """
        if not self.llm_available:
            return VisionResult(
                available=False,
                unavailableReason=(
                    "Image analysis needs GEMINI_API_KEY to be configured."
                ),
            )

        if mime_type not in self.settings.allowed_image_types:
            return VisionResult(
                available=False,
                unavailableReason=(
                    f"Unsupported image type '{mime_type}'. Supported: "
                    f"{', '.join(sorted(self.settings.allowed_image_types))}."
                ),
            )

        if len(image_bytes) > self.settings.max_image_bytes:
            limit_mb = self.settings.max_image_bytes / (1024 * 1024)
            return VisionResult(
                available=False,
                unavailableReason=f"Image is larger than the {limit_mb:.0f} MB limit.",
            )

        by_id = {c.categoryId: c for c in categories}
        catalogue = "\n".join(
            f"- {c.categoryId}: {c.name} (department: {c.department})" for c in categories
        )
        prompt = (
            f"Available categories:\n{catalogue}\n\n"
            + (f"Citizen's own description: \"\"\"{truncate(hint, 600)}\"\"\"\n\n" if hint else "")
            + "Analyse the attached photograph of a reported civic issue. Describe "
            "the visible infrastructure problem, choose the best categoryId "
            "(use UNKNOWN if no category fits or the photo shows no civic issue), "
            "and rate severity. List the specific visual details that justify "
            "your rating in 'observations'."
        )

        try:
            payload = await self._gemini().generate_json(
                prompt=prompt,
                system_instruction=_VISION_SYSTEM_PROMPT,
                response_schema=_vision_schema(list(by_id.keys())),
                image_bytes=image_bytes,
                image_mime_type=mime_type,
                max_output_tokens=600,
            )
        except AIProviderError as exc:
            logger.warning("Image analysis failed: %s", exc)
            return VisionResult(
                available=False,
                unavailableReason=f"The image could not be analysed: {exc}",
            )

        category_id = str(payload.get("categoryId") or "").strip()
        category = by_id.get(category_id)
        observations = payload.get("observations")

        return VisionResult(
            description=str(payload.get("description") or "").strip()[:2000],
            categoryId=category.categoryId if category else None,
            categoryName=category.name if category else None,
            severity=_coerce_severity(payload.get("severity")) or "LOW",
            confidence=_clamp_confidence(payload.get("confidence"), 0.5),
            observations=[str(o)[:200] for o in observations][:8]
            if isinstance(observations, list)
            else [],
            available=True,
            source="gemini-vision",
        )

    # -- description write-up ---------------------------------------------

    async def write_description(
        self, description: str, *, category: Optional[CategoryRecord] = None
    ) -> Optional[str]:
        """Rewrite a citizen's raw text into an officer-facing paragraph.

        Returns None when unavailable so callers can fall back to the rules
        summary rather than showing an error.
        """
        if not self.llm_available or not description.strip():
            return None

        context = f"Category: {category.name} ({category.department})\n" if category else ""
        prompt = (
            f"{context}Original citizen report:\n\"\"\"{truncate(description, 2000)}\"\"\"\n\n"
            "Rewrite this as a single clear paragraph for a municipal officer. "
            "Keep all specific details (what, where, how long). Maximum 80 words."
        )

        try:
            text = await self._gemini().generate_text(
                prompt=prompt,
                system_instruction=_WRITEUP_SYSTEM_PROMPT,
                max_output_tokens=300,
            )
        except AIProviderError as exc:
            logger.warning("Description write-up failed: %s", exc)
            return None

        return text.strip()[:2000] or None

    # -- combined triage ---------------------------------------------------

    async def triage(
        self,
        description: str,
        categories: Sequence[CategoryRecord],
        *,
        duplicate_candidates: Sequence[ComplaintRecord] = (),
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        categoryId: Optional[str] = None,
        image_bytes: Optional[bytes] = None,
        image_mime_type: Optional[str] = None,
    ) -> TriageResult:
        """Run a full triage pass: category, severity, duplicates and a summary."""
        vision: Optional[VisionResult] = None
        if image_bytes and image_mime_type:
            vision = await self.analyze_image(
                image_bytes, image_mime_type, categories, hint=description
            )

        # A photo often carries detail the citizen did not type; fold the model's
        # description into the text used for classification.
        effective_text = description
        if vision and vision.available and vision.description:
            effective_text = f"{description}\n\n[from photo] {vision.description}".strip()

        category_result = await self.categorize(effective_text, categories)

        chosen: Optional[CategoryRecord] = None
        if categoryId:
            chosen = next((c for c in categories if c.categoryId == categoryId), None)
        if chosen is None and category_result.best:
            chosen = next(
                (c for c in categories if c.categoryId == category_result.best.categoryId), None
            )

        # A confident vision categorisation outranks text when the text was vague.
        if (
            vision
            and vision.available
            and vision.categoryId
            and vision.confidence >= 0.7
            and (not category_result.best or category_result.best.confidence < 0.5)
        ):
            chosen = next((c for c in categories if c.categoryId == vision.categoryId), chosen)

        severity_result = await self.predict_severity(effective_text, chosen, vision=vision)

        duplicate_result = self.find_duplicates(
            description,
            duplicate_candidates,
            latitude=latitude,
            longitude=longitude,
            categoryId=categoryId or (chosen.categoryId if chosen else None),
        )

        summary = await self.write_description(effective_text, category=chosen)
        if not summary:
            summary = rules.summarize(effective_text, chosen, severity_result.severity)

        source = "gemini-vision" if (vision and vision.available) else (
            "gemini" if self.llm_available else "rules"
        )

        return TriageResult(
            category=category_result,
            severity=severity_result,
            duplicates=duplicate_result,
            summary=summary,
            vision=vision,
            source=source,
        )


def utcnow() -> datetime:
    """Naive UTC timestamp, matching the convention used across the codebase."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

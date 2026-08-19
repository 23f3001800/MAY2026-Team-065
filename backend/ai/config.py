"""Configuration for the AI subsystem, read from the environment.

Every value has a working default so the API runs with no AI-specific
configuration at all: without ``GEMINI_API_KEY`` the deterministic rules engine
handles categorisation, severity and duplicates, and the LLM-only features
(assistant, description write-ups, image analysis) report themselves as
unavailable instead of failing requests.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Set


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class AISettings:
    """Immutable snapshot of AI configuration."""

    # "auto"   -> use Gemini when a key is configured, else rules
    # "rules"  -> never call out to an LLM (useful for CI and offline demos)
    # "gemini" -> require Gemini; LLM-backed endpoints error if it is unavailable
    provider: str = "auto"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta"

    # -- Azure OpenAI (Azure AI Foundry) ----------------------------------
    # A second LLM backend behind the same interface. Added because a single
    # provider is a single point of failure: when the Gemini quota is exhausted
    # every LLM-backed feature degrades at once, which is what happened during
    # Sprint 2. The endpoint is the Foundry resource URL, the deployment is the
    # name given to the model in that resource -- NOT the model name itself,
    # which is the usual first mistake with Azure OpenAI.
    # Two shapes, because Azure exposes two:
    #
    #  1. Azure OpenAI resource -- needs endpoint + deployment. The URL is
    #     /openai/deployments/{deployment}/chat/completions and auth is the
    #     api-key header.
    #  2. Azure AI Foundry model inference -- needs only the key. The endpoint
    #     is a shared one, the model is named in the body, and auth is a beare
    #     token. No deployment is created, which is why a key on its own is
    #     enough.
    #
    # Shape 1 is used when an endpoint AND deployment are both set; otherwise a
    # key alone selects shape 2.
    azure_api_key: str = ""
    azure_endpoint: str = ""
    azure_deployment: str = ""
    azure_api_version: str = "2024-10-21"
    # Shape 2 only.
    azure_inference_endpoint: str = "https://models.inference.ai.azure.com"
    azure_model: str = "gpt-4o-mini"

    # Wall-clock budget for a single upstream call. Kept short: complaint
    # submission must not hang behind a slow model.
    request_timeout_seconds: float = 12.0
    max_output_tokens: int = 1024

    # Vision limits. Gemini requires the Files API for large payloads; we simply
    # reject anything bigger rather than silently truncating.
    max_image_bytes: int = 4 * 1024 * 1024
    allowed_image_types: Set[str] = field(
        default_factory=lambda: {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
    )

    # Run triage automatically when a complaint is filed.
    auto_triage_on_create: bool = True

    # Duplicate detection thresholds.
    duplicate_radius_km: float = 0.3
    duplicate_window_days: int = 30
    duplicate_similarity_threshold: float = 0.55
    # Stricter than the display threshold above: this one decides whether a
    # duplicate is *recorded* on the complaint, which hides the second citizen's
    # report behind the first. A false merge costs more than a missed one.
    duplicate_autolink_threshold: float = 0.75

    @property
    def gemini_configured(self) -> bool:
        return bool(self.gemini_api_key.strip())

    @property
    def azure_mode(self) -> str:
        """Which Azure shape this configuration describes.

        "deployment" when a resource endpoint and deployment are both given,
        "inference" when only a key is, and "" when there is no key at all.
        """
        if not self.azure_api_key.strip():
            return ""
        if self.azure_endpoint.strip() and self.azure_deployment.strip():
            return "deployment"
        return "inference"

    @property
    def azure_configured(self) -> bool:
        """A key is the minimum. Endpoint and deployment only pick the shape."""
        return bool(self.azure_mode)

    @property
    def active_llm(self) -> str:
        """Which backend will actually serve a request: 'azure', 'gemini' or ''.

        In 'auto', Azure wins when both are configured -- it is the one the team
        deliberately provisioned, and preferring it makes the fallback direction
        predictable rather than depending on which key happened to be set.
        """
        if self.provider == "rules":
            return ""
        if self.provider == "azure":
            return "azure" if self.azure_configured else ""
        if self.provider == "azure":
            return self.azure_configured
        if self.provider == "gemini":
            return "gemini" if self.gemini_configured else ""
        if self.azure_configured:
            return "azure"
        return "gemini" if self.gemini_configured else ""

    @property
    def llm_enabled(self) -> bool:
        """True when LLM calls should actually be attempted."""
        if self.provider == "rules":
            return False
        if self.provider == "azure":
            return self.azure_configured
        if self.provider == "gemini":
            return True
        return self.azure_configured or self.gemini_configured


def load_settings() -> AISettings:
    """Build settings from the current environment.

    Read at call time rather than import time so tests can monkeypatch the
    environment (and so a redeployed container picks up new values).
    """
    provider = (os.getenv("AI_PROVIDER") or "auto").strip().lower()
    if provider not in {"auto", "rules", "gemini", "azure"}:
        provider = "auto"

    return AISettings(
        provider=provider,
        gemini_api_key=(os.getenv("GEMINI_API_KEY") or "").strip(),
        gemini_model=(os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip(),
        azure_api_key=(os.getenv("AZURE_OPENAI_API_KEY") or "").strip(),
        azure_endpoint=(os.getenv("AZURE_OPENAI_ENDPOINT") or "").strip().rstrip("/"),
        azure_deployment=(os.getenv("AZURE_OPENAI_DEPLOYMENT") or "").strip(),
        azure_api_version=(os.getenv("AZURE_OPENAI_API_VERSION") or "2024-10-21").strip(),
        azure_inference_endpoint=(
            os.getenv("AZURE_OPENAI_INFERENCE_ENDPOINT")
            or "https://models.inference.ai.azure.com"
        ).strip().rstrip("/"),
        azure_model=(os.getenv("AZURE_OPENAI_MODEL") or "gpt-4o-mini").strip(),
        gemini_api_base=(
            os.getenv("GEMINI_API_BASE") or "https://generativelanguage.googleapis.com/v1beta"
        ).rstrip("/"),
        request_timeout_seconds=_env_float("AI_TIMEOUT_SECONDS", 12.0),
        max_output_tokens=_env_int("AI_MAX_OUTPUT_TOKENS", 1024),
        max_image_bytes=_env_int("AI_MAX_IMAGE_BYTES", 4 * 1024 * 1024),
        auto_triage_on_create=_env_bool("AI_AUTO_TRIAGE", True),
        duplicate_radius_km=_env_float("AI_DUPLICATE_RADIUS_KM", 0.3),
        duplicate_window_days=_env_int("AI_DUPLICATE_WINDOW_DAYS", 30),
        duplicate_similarity_threshold=_env_float("AI_DUPLICATE_THRESHOLD", 0.55),
        duplicate_autolink_threshold=_env_float("AI_DUPLICATE_AUTOLINK_THRESHOLD", 0.75),
    )

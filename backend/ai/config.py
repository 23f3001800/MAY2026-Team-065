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

    # "auto"       -> Gemini first, OpenRouter as fallback, rules underneath
    # "rules"      -> never call out to an LLM (useful for CI and offline demos)
    # "gemini"     -> pin to Gemini; no fallback to OpenRouter
    # "openrouter" -> pin to OpenRouter; no fallback to Gemini
    provider: str = "auto"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_api_base: str = "https://generativelanguage.googleapis.com/v1beta"

    # -- OpenRouter -------------------------------------------------------
    # The fallback LLM, behind the same interface as Gemini. One provider is a
    # single point of failure: when the Gemini quota runs out every LLM-backed
    # feature degrades at once, and the only signal is a 429 in a response body.
    #
    # A key is the whole configuration. The model is namespaced by vendor
    # ("openai/gpt-4o-mini", "google/gemini-2.0-flash-001"); a bare name without
    # the vendor prefix is rejected, which is the usual first mistake here.
    openrouter_api_key: str = ""
    openrouter_model: str = "openai/gpt-4o-mini"
    openrouter_api_base: str = "https://openrouter.ai/api/v1"
    # Attribution headers. Optional, and only used to label this service's
    # traffic on the OpenRouter dashboard -- which is what makes a spend spike
    # traceable to this API rather than to "something using our key".
    openrouter_referer: str = ""
    openrouter_title: str = "SmartCivicConnect"

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
    def openrouter_configured(self) -> bool:
        return bool(self.openrouter_api_key.strip())

    @property
    def active_llm(self) -> str:
        """Which backend serves a request FIRST: 'gemini', 'openrouter' or ''.

        In 'auto' Gemini leads and OpenRouter backs it up, which is the order
        the deployment is actually paid for: Gemini has a free tier that covers
        normal load, and OpenRouter is metered credit that should only be spent
        when the free tier is exhausted or down.

        This names the FIRST choice, not the only one -- see ``llm_chain``.
        """
        for name in self.llm_chain:
            return name
        return ""

    @property
    def llm_chain(self) -> tuple:
        """Every backend to try, in order, before giving up on the LLM layer.

        This is what makes the fallback real. Before it existed the provider was
        chosen once from configuration and a failure meant dropping straight to
        the rules engine -- so a second key bought nothing at the moment it was
        supposed to help, which is precisely when the first provider is failing.

        An explicit provider pins the chain to that one backend. Being told
        "gemini" and quietly billing OpenRouter would be worse than an error.
        """
        if self.provider == "rules":
            return ()
        if self.provider == "gemini":
            return ("gemini",) if self.gemini_configured else ()
        if self.provider == "openrouter":
            return ("openrouter",) if self.openrouter_configured else ()

        chain = []
        if self.gemini_configured:
            chain.append("gemini")
        if self.openrouter_configured:
            chain.append("openrouter")
        return tuple(chain)

    @property
    def llm_enabled(self) -> bool:
        """True when LLM calls should actually be attempted."""
        return bool(self.llm_chain)


def load_settings() -> AISettings:
    """Build settings from the current environment.

    Read at call time rather than import time so tests can monkeypatch the
    environment (and so a redeployed container picks up new values).
    """
    provider = (os.getenv("AI_PROVIDER") or "auto").strip().lower()
    if provider not in {"auto", "rules", "gemini", "openrouter"}:
        provider = "auto"

    return AISettings(
        provider=provider,
        gemini_api_key=(os.getenv("GEMINI_API_KEY") or "").strip(),
        gemini_model=(os.getenv("GEMINI_MODEL") or "gemini-2.5-flash").strip(),
        openrouter_api_key=(os.getenv("OPENROUTER_API_KEY") or "").strip(),
        openrouter_model=(
            os.getenv("OPENROUTER_MODEL") or "openai/gpt-4o-mini"
        ).strip(),
        openrouter_api_base=(
            os.getenv("OPENROUTER_API_BASE") or "https://openrouter.ai/api/v1"
        ).strip().rstrip("/"),
        openrouter_referer=(os.getenv("OPENROUTER_SITE_URL") or "").strip(),
        openrouter_title=(
            os.getenv("OPENROUTER_APP_TITLE") or "SmartCivicConnect"
        ).strip(),
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

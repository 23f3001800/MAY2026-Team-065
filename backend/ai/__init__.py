"""AI subsystem for SmartCivicConnect.

Layout:

* ``config``    -- environment-driven settings
* ``provider``  -- shared result types
* ``text``      -- dependency-free text/geo helpers
* ``rules``     -- deterministic engine (categorisation, severity, duplicates)
* ``gemini``    -- async Gemini REST client (text + vision, structured JSON)
* ``service``   -- the facade routes use; owns the rules/LLM hybrid policy
* ``assistant`` -- grounded, role-scoped question answering
"""

from .config import AISettings, load_settings
from .provider import (
    AIProviderError,
    AssistantAnswer,
    CategoryResult,
    CategorySuggestion,
    DuplicateCandidate,
    DuplicateResult,
    SeverityResult,
    TriageResult,
    VisionResult,
)
from .rules import CategoryRecord, ComplaintRecord
from .service import AIService

__all__ = [
    "AISettings",
    "load_settings",
    "AIService",
    "AIProviderError",
    "AssistantAnswer",
    "CategoryRecord",
    "CategoryResult",
    "CategorySuggestion",
    "ComplaintRecord",
    "DuplicateCandidate",
    "DuplicateResult",
    "SeverityResult",
    "TriageResult",
    "VisionResult",
]

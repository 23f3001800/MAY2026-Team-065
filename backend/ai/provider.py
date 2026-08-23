"""Result types shared by the deterministic and LLM-backed AI engines.

Both engines return the same shapes so callers never branch on which one ran.
``source`` records what actually produced a result, which matters for audit:
an officer looking at a severity of CRITICAL should be able to tell whether a
keyword rule or a vision model put it there.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

# Severity values mirror database.SeverityEnum. Ordered low -> high so callers
# can compare or take a maximum.
SEVERITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def severity_rank(severity: str) -> int:
    """Position of a severity in the escalation order; unknown values sort lowest."""
    try:
        return SEVERITY_ORDER.index(severity.upper())
    except (ValueError, AttributeError):
        return 0


def highest_severity(*severities: Optional[str]) -> str:
    """Return the most severe of the given values, ignoring None."""
    present = [s for s in severities if s]
    if not present:
        return "LOW"
    return max(present, key=severity_rank).upper()


@dataclass
class CategorySuggestion:
    """One candidate category with the engine's confidence in it."""

    categoryId: str
    name: str
    department: str
    confidence: float
    reason: str = ""


@dataclass
class CategoryResult:
    suggestions: List[CategorySuggestion] = field(default_factory=list)
    source: str = "rules"

    @property
    def best(self) -> Optional[CategorySuggestion]:
        return self.suggestions[0] if self.suggestions else None


@dataclass
class SeverityResult:
    severity: str = "LOW"
    confidence: float = 0.0
    reason: str = ""
    # Terms or observations that drove the decision, for explainability.
    signals: List[str] = field(default_factory=list)
    source: str = "rules"


@dataclass
class DuplicateCandidate:
    complaintId: str
    similarity: float
    distanceKm: Optional[float]
    status: str
    description: str
    createdAt: Optional[str] = None
    reason: str = ""


@dataclass
class DuplicateResult:
    isDuplicate: bool = False
    candidates: List[DuplicateCandidate] = field(default_factory=list)
    source: str = "rules"

    @property
    def best(self) -> Optional[DuplicateCandidate]:
        return self.candidates[0] if self.candidates else None


@dataclass
class VisionResult:
    """What a vision model saw in a complaint photo."""

    description: str = ""
    categoryId: Optional[str] = None
    categoryName: Optional[str] = None
    severity: str = "LOW"
    confidence: float = 0.0
    observations: List[str] = field(default_factory=list)
    # False when the image could not be analysed (no LLM configured, safety
    # block, upstream error). Callers fall back to text-only triage.
    available: bool = False
    unavailableReason: str = ""
    source: str = "gemini-vision"


@dataclass
class TriageResult:
    """Combined result of a full triage pass over a complaint."""

    category: CategoryResult = field(default_factory=CategoryResult)
    severity: SeverityResult = field(default_factory=SeverityResult)
    duplicates: DuplicateResult = field(default_factory=DuplicateResult)
    summary: str = ""
    vision: Optional[VisionResult] = None
    source: str = "rules"


@dataclass
class AssistantAnswer:
    answer: str
    citations: List[str] = field(default_factory=list)
    source: str = "rules"
    # Records what the assistant was allowed to read, so a reviewer can confirm
    # it never reached beyond the caller's role.
    contextUsed: List[str] = field(default_factory=list)
    # Suggested next questions, derived from the retrieved records rather than
    # generated, so they can never reference a complaint that does not exist.
    followUps: List[str] = field(default_factory=list)


class AIProviderError(RuntimeError):
    """Raised when an upstream AI provider fails in a way the caller should see."""

    def __init__(self, message: str, *, retryable: bool = False, status_code: Optional[int] = None):
        super().__init__(message)
        self.retryable = retryable
        self.status_code = status_code

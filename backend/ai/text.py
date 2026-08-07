"""Small, dependency-free text utilities used by the deterministic AI engine.

Deliberately not a full NLP stack. Complaint text is short, domain-specific and
often ungrammatical, so a compact normaliser plus a hand-tuned lexicon
outperforms a generic model here -- and stays fast, offline and testable.
"""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from typing import Dict, Iterable, List, Sequence, Set

# Common English filler plus civic-report boilerplate ("please", "kindly",
# "complaint") that appears in nearly every submission and therefore carries no
# discriminating signal.
STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "all", "also", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
    "by", "can", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from",
    "further", "had", "has", "have", "having", "he", "her", "here", "hers", "him", "his", "how",
    "i", "if", "in", "into", "is", "it", "its", "just", "me", "more", "most", "my", "no", "nor",
    "not", "now", "of", "off", "on", "once", "only", "or", "other", "our", "out", "over", "own",
    "same", "she", "should", "so", "some", "such", "than", "that", "the", "their", "them", "then",
    "there", "these", "they", "this", "those", "through", "to", "too", "under", "until", "up",
    "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why",
    "will", "with", "would", "you", "your",
    # Civic boilerplate.
    "please", "kindly", "sir", "madam", "request", "requesting", "complaint", "complain",
    "issue", "problem", "report", "reported", "reporting", "area", "near", "nearby", "help",
    "urgent", "asap", "immediately",
}

_WORD_RE = re.compile(r"[a-z0-9]+")

# Crude suffix stripping. Real stemming would need a dependency; these suffixes
# cover the plural/participle variation that actually shows up in complaints
# ("potholes"/"pothole", "leaking"/"leak", "flooded"/"flood").
#
# Each entry is (suffix, minimum length of the remaining root). The minimums stop
# short words being destroyed -- "gas" must not become "ga", "ring" must not
# become "r".
_SUFFIX_RULES = (
    ("ing", 3),
    ("ed", 3),
    ("es", 3),
    ("s", 3),
)


def normalize(value: str) -> str:
    """Lowercase, strip accents, and collapse whitespace."""
    if not value:
        return ""
    decomposed = unicodedata.normalize("NFKD", value)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", stripped.lower()).strip()


def stem(token: str) -> str:
    """Reduce a word to a crude root, converging singular and plural forms.

    The trailing-'e' step matters more than it looks: without it "pothole" stems
    to itself while "potholes" stems to "pothol", so a citizen writing the plural
    would miss every lexicon entry. Stripping the final 'e' makes both land on
    "pothol".
    """
    # Only the first matching suffix is removed -- stacking them mangles words.
    for suffix, min_root in _SUFFIX_RULES:
        if token.endswith(suffix) and len(token) - len(suffix) >= min_root:
            # "ss" is not a plural ("glass", "address").
            if suffix == "s" and token.endswith("ss"):
                break
            token = token[: -len(suffix)]
            break

    # Same minimum root as the plural rules above, so "pipe"/"pipes" and
    # "tree"/"trees" converge instead of splitting on a threshold mismatch.
    if token.endswith("e") and len(token) - 1 >= 3:
        token = token[:-1]

    return token


def tokenize(value: str, *, keep_stopwords: bool = False) -> List[str]:
    """Split text into normalised, stemmed content tokens."""
    words = _WORD_RE.findall(normalize(value))
    if keep_stopwords:
        return [stem(w) for w in words]
    return [stem(w) for w in words if w not in STOPWORDS and len(w) > 1]


def token_set(value: str) -> Set[str]:
    return set(tokenize(value))


def bigrams(tokens: Sequence[str]) -> Set[str]:
    """Adjacent token pairs -- they separate 'water leak' from 'leak detector'."""
    return {f"{tokens[i]}_{tokens[i + 1]}" for i in range(len(tokens) - 1)}


def jaccard(left: Set[str], right: Set[str]) -> float:
    if not left or not right:
        return 0.0
    intersection = len(left & right)
    if not intersection:
        return 0.0
    return intersection / len(left | right)


def build_idf(documents: Iterable[Sequence[str]]) -> Dict[str, float]:
    """Inverse document frequency over a small candidate corpus.

    Used so that shared rare words ("banyan", "flyover") count for far more than
    shared common ones ("road", "water") when comparing two complaints.
    """
    docs = [set(doc) for doc in documents]
    total = len(docs)
    if total == 0:
        return {}

    counts: Counter = Counter()
    for doc in docs:
        counts.update(doc)

    # Smoothed IDF, floored at 0 so a term present in every document contributes
    # nothing rather than going negative.
    return {
        term: max(0.0, math.log((total + 1) / (count + 1)) + 1.0)
        for term, count in counts.items()
    }


def weighted_cosine(left: Sequence[str], right: Sequence[str], idf: Dict[str, float]) -> float:
    """IDF-weighted cosine similarity between two token sequences."""
    if not left or not right:
        return 0.0

    left_counts = Counter(left)
    right_counts = Counter(right)

    def vector(counts: Counter) -> Dict[str, float]:
        return {term: freq * idf.get(term, 1.0) for term, freq in counts.items()}

    lv, rv = vector(left_counts), vector(right_counts)

    shared = set(lv) & set(rv)
    if not shared:
        return 0.0

    dot = sum(lv[term] * rv[term] for term in shared)
    left_norm = math.sqrt(sum(v * v for v in lv.values()))
    right_norm = math.sqrt(sum(v * v for v in rv.values()))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres between two coordinates."""
    earth_radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    # Clamp before asin: floating-point error can push `a` marginally above 1.
    return 2 * earth_radius_km * math.asin(math.sqrt(min(1.0, a)))


def truncate(value: str, limit: int = 240) -> str:
    """Shorten text for display without cutting mid-word."""
    value = (value or "").strip()
    if len(value) <= limit:
        return value
    clipped = value[:limit].rsplit(" ", 1)[0]
    return f"{clipped}..."

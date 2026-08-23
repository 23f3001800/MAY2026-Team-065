"""Deterministic AI engine: categorisation, severity scoring and duplicate detection.

This is the default engine and the fallback for every LLM-backed path. It runs
offline, costs nothing, returns identical output for identical input, and is
therefore what the test suite asserts against.

Design notes:

* Categories are **not** hardcoded. They are read from the database and matched
  against a topic lexicon, so adding a category row works without a code change.
  A category is linked to a topic when its name or department matches that
  topic's aliases; anything unmatched still scores via direct token overlap.
* Severity combines three independent signals -- explicit urgency terms, hazard
  terms, and the base risk of the matched category -- rather than a single
  keyword sweep, so "streetlight out" and "live wire sparking on a wet road"
  don't land in the same bucket.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from .provider import (
    CategoryResult,
    CategorySuggestion,
    DuplicateCandidate,
    DuplicateResult,
    SeverityResult,
    highest_severity,
)
from .text import (
    _WORD_RE,
    bigrams,
    build_idf,
    haversine_km,
    jaccard,
    normalize,
    stem,
    token_set,
    tokenize,
    truncate,
    weighted_cosine,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Topic:
    """A civic issue domain and the vocabulary that signals it."""

    key: str
    # Words that identify the matching CategoryModel row (name or department).
    aliases: Tuple[str, ...]
    # Strong terms -- near-conclusive for this topic.
    strong: Tuple[str, ...]
    # Weak terms -- supporting evidence only.
    weak: Tuple[str, ...]
    # Baseline severity for the topic, before urgency modifiers.
    base_severity: str = "LOW"


# Tuned against the seeded categories (Water & Plumbing, Sanitation, Roads &
# Transport, Electrical, Public Works) but written to generalise.
TOPICS: Tuple[Topic, ...] = (
    Topic(
        key="water",
        aliases=("water", "plumbing", "pipe", "pipes", "sewer", "sewage", "drain", "drains"),
        strong=(
            "leak", "leakage", "pipe", "pipeline", "burst", "waterlog", "flood", "flooding",
            "sewage", "sewer", "drainage", "drain", "tap", "borewell", "hydrant", "overflow",
            "contaminated", "seepage", "watermain",
        ),
        weak=("water", "supply", "pressure", "muddy", "smell", "stagnant", "puddle", "wet"),
        base_severity="MEDIUM",
    ),
    Topic(
        key="sanitation",
        aliases=("sanitation", "garbage", "waste", "debris", "cleaning", "refuse"),
        strong=(
            "garbage", "trash", "rubbish", "waste", "dump", "dumping", "litter", "debris",
            "sewage", "manure", "rodent", "rat", "mosquito", "stink", "stench", "rotting",
            "carcass", "dead", "biohazard",
        ),
        weak=("bin", "collection", "pickup", "smell", "dirty", "unclean", "pile", "heap"),
        base_severity="MEDIUM",
    ),
    Topic(
        key="roads",
        aliases=("road", "roads", "transport", "street", "streets", "traffic", "pothole", "potholes"),
        strong=(
            "pothole", "crater", "road", "asphalt", "tarmac", "pavement", "footpath", "sidewalk",
            "manhole", "speedbreaker", "divider", "crack", "subsidence", "cavein", "bridge",
            "flyover", "culvert",
        ),
        weak=("traffic", "vehicle", "car", "bike", "bus", "drive", "driving", "lane", "junction"),
        base_severity="MEDIUM",
    ),
    Topic(
        key="electrical",
        aliases=("electric", "electrical", "electricity", "streetlight", "streetlights",
                 "light", "lights", "lighting", "power"),
        strong=(
            "streetlight", "lamppost", "light", "bulb", "electric", "electrical", "wire",
            "cable", "transformer", "pole", "shortcircuit", "spark", "sparking", "voltage",
            "electrocution", "shock", "powercut", "outage",
        ),
        weak=("dark", "darkness", "night", "flicker", "flickering", "power", "current"),
        base_severity="MEDIUM",
    ),
    Topic(
        key="public_works",
        aliases=("public", "park", "parks", "property", "works", "civic"),
        strong=(
            "park", "playground", "bench", "swing", "statue", "fountain", "toilet", "shelter",
            "vandalism", "graffiti", "encroachment", "boundary", "railing", "gate", "wall",
            "tree", "branch", "fallen",
        ),
        weak=("public", "property", "damage", "damaged", "broken", "garden", "ground"),
        base_severity="LOW",
    ),
)

_TOPIC_BY_KEY: Dict[str, Topic] = {topic.key: topic for topic in TOPICS}

# Terms that raise severity regardless of topic, grouped by how far they push it.
_CRITICAL_TERMS = {
    "electrocution", "electrocuted", "death", "died", "fatal", "casualty", "collapse",
    "collapsed", "explosion", "explode", "fire", "gasleak", "livewire", "drowning",
    "emergency", "trapped", "unconscious",
}
_HIGH_TERMS = {
    "injury", "injured", "accident", "hurt", "bleeding", "hospital", "ambulance", "danger",
    "dangerous", "hazard", "hazardous", "unsafe", "risk", "spark", "sparking", "shock",
    "burst", "flooding", "flooded", "overflow", "contaminated", "disease", "outbreak",
    "epidemic", "child", "children", "school", "hospital", "elderly", "blocked", "blocking",
}
_MEDIUM_TERMS = {
    "urgent", "immediately", "asap", "repeatedly", "again", "worsening", "spreading",
    "large", "huge", "deep", "major", "several", "many", "multiple", "entire", "whole",
    "week", "weeks", "month", "months", "long", "persistent",
}

# Phrases (checked on raw normalised text, before stemming) that indicate scale.
_SCALE_PHRASES = (
    "entire street", "whole street", "entire area", "whole area", "many houses",
    "several houses", "all residents", "main road", "school children", "every day",
)

# Hazards that people write as two words.
#
# The sets above are matched against single stemmed tokens, and the tokenizer
# splits on word boundaries -- so the squashed spellings in them ("livewire",
# "gasleak", "shortcircuit") can only ever match if a citizen types the words
# joined up, which nobody does. "Live wire hanging low from the pole, well
# within reach of anyone walking past" therefore scored LOW: the single most
# dangerous thing in the electrical lexicon, rated as harmless.
#
# These are checked against the raw normalised text the same way _SCALE_PHRASES
# already was. The squashed forms are kept above rather than deleted, because
# they still catch the occasional "livewire" written as one word.
_CRITICAL_PHRASES = (
    "live wire", "live cable", "exposed wire", "exposed cable", "naked wire",
    "high voltage", "gas leak", "gas smell", "smell of gas",
    "building collapse", "wall collapse", "roof collapse", "about to collapse",
    "open manhole", "uncovered manhole", "manhole open",
    "electric shock", "caught fire", "on fire",
)
_HIGH_PHRASES = (
    "short circuit", "power cut", "water main", "cave in", "caved in",
    "speed breaker", "sewage overflow", "no water", "no supply",
    "near the school", "outside the school", "near a school",
    "someone could", "somebody could", "could fall", "could be hurt",
)


def _stemmed(terms: Iterable[str]) -> set:
    return {stem(t) for t in terms}


_CRITICAL_STEMS = _stemmed(_CRITICAL_TERMS)
_HIGH_STEMS = _stemmed(_HIGH_TERMS)
_MEDIUM_STEMS = _stemmed(_MEDIUM_TERMS)


@dataclass
class CategoryRecord:
    """The subset of a CategoryModel row this engine needs.

    Decoupled from SQLAlchemy so the engine stays unit-testable without a database.
    """

    categoryId: str
    name: str
    department: str


@dataclass
class ComplaintRecord:
    """The subset of a ComplaintModel row needed for duplicate detection."""

    complaintId: str
    description: str
    status: str
    categoryId: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    createdAt: Optional[datetime] = None


def _topics_for_category(category: CategoryRecord) -> List[Topic]:
    """Match a database category row to lexicon topics via its name/department.

    Matched on WHOLE WORDS. Plain substring matching -- which this used to do --
    linked "Streetlight Fault" to the *roads* topic, because "street" is a
    substring of "streetlight". The visible effect was streetlight complaints
    being scored with road vocabulary and, worse, road complaints scoring points
    against the electrical category: a report of rubbish "on the road" listed
    Streetlight Fault as its third-best category, with the word "road" given as
    the reason.

    The cost of word matching is that an alias no longer catches its own
    derived forms ("electric" does not match "electrical"), so the alias tuples
    above list the forms that actually appear in category names.
    """
    haystack = set(_WORD_RE.findall(normalize(
        category.name + " " + category.department
    )))
    return [t for t in TOPICS if haystack & set(t.aliases)]


def categorize(description: str, categories: Sequence[CategoryRecord]) -> CategoryResult:
    """Rank categories by how well the complaint text matches each one.

    Scoring per category is the sum of:
      * strong lexicon hits for its topics (weight 3)
      * weak lexicon hits for its topics (weight 1)
      * direct overlap with the category's own name/department words (weight 2)

    Scores are normalised across candidates into a 0-1 confidence, so confidence
    expresses *relative* fit among the available categories -- which is what an
    officer choosing between them actually needs.
    """
    if not categories:
        return CategoryResult(suggestions=[], source="rules")

    tokens = tokenize(description)
    if not tokens:
        return CategoryResult(suggestions=[], source="rules")

    token_bag = set(tokens)
    raw_text = normalize(description)

    scored: List[Tuple[CategoryRecord, float, List[str]]] = []

    for category in categories:
        score = 0.0
        reasons: List[str] = []

        for topic in _topics_for_category(category):
            strong_hits = token_bag & _stemmed(topic.strong)
            weak_hits = token_bag & _stemmed(topic.weak)
            if strong_hits:
                score += 3.0 * len(strong_hits)
                reasons.extend(sorted(strong_hits))
            if weak_hits:
                score += 1.0 * len(weak_hits)

        # Direct match against the category's own wording catches categories that
        # the lexicon has no topic for at all.
        own_words = token_set(f"{category.name} {category.department}")
        direct_hits = token_bag & own_words
        if direct_hits:
            score += 2.0 * len(direct_hits)
            reasons.extend(sorted(direct_hits))

        # Small bonus when the category name appears near-verbatim.
        if normalize(category.name) and normalize(category.name) in raw_text:
            score += 2.0

        if score > 0:
            scored.append((category, score, reasons))

    if not scored:
        return CategoryResult(suggestions=[], source="rules")

    scored.sort(key=lambda item: item[1], reverse=True)
    total = sum(item[1] for item in scored)

    suggestions = [
        CategorySuggestion(
            categoryId=category.categoryId,
            name=category.name,
            department=category.department,
            confidence=round(score / total, 4) if total else 0.0,
            reason=(
                f"matched: {', '.join(sorted(set(reasons))[:6])}" if reasons else "partial match"
            ),
        )
        for category, score, reasons in scored[:5]
    ]

    return CategoryResult(suggestions=suggestions, source="rules")


def predict_severity(
    description: str,
    category: Optional[CategoryRecord] = None,
) -> SeverityResult:
    """Score severity from urgency/hazard vocabulary plus the category's base risk."""
    tokens = set(tokenize(description))
    raw_text = normalize(description)
    signals: List[str] = []

    critical_hits = tokens & _CRITICAL_STEMS
    high_hits = tokens & _HIGH_STEMS
    medium_hits = tokens & _MEDIUM_STEMS
    scale_hits = [phrase for phrase in _SCALE_PHRASES if phrase in raw_text]

    # Multi-word hazards, which single-token matching cannot see at all.
    critical_hits |= {p for p in _CRITICAL_PHRASES if p in raw_text}
    high_hits |= {p for p in _HIGH_PHRASES if p in raw_text}

    signals.extend(sorted(critical_hits))
    signals.extend(sorted(high_hits))
    signals.extend(sorted(medium_hits))
    signals.extend(scale_hits)

    # Start from the category's inherent risk, then escalate on evidence.
    base = "LOW"
    if category:
        topics = _topics_for_category(category)
        if topics:
            base = highest_severity(*[t.base_severity for t in topics])

    severity = base
    confidence = 0.35
    reason_parts: List[str] = []

    if category and base != "LOW":
        reason_parts.append(f"'{category.department}' issues carry a {base} baseline")

    if medium_hits or scale_hits:
        severity = highest_severity(severity, "MEDIUM")
        confidence = max(confidence, 0.55)
        if medium_hits:
            reason_parts.append(f"scale/persistence terms ({', '.join(sorted(medium_hits)[:3])})")
        if scale_hits:
            reason_parts.append(f"affects a wide area ({scale_hits[0]})")

    if high_hits:
        severity = highest_severity(severity, "HIGH")
        confidence = max(confidence, 0.75)
        reason_parts.append(f"hazard terms ({', '.join(sorted(high_hits)[:3])})")

    if critical_hits:
        severity = "CRITICAL"
        confidence = 0.92
        reason_parts.append(f"life-safety terms ({', '.join(sorted(critical_hits)[:3])})")

    # Several independent HIGH signals justify escalating one more step.
    if severity == "HIGH" and len(high_hits) >= 3:
        severity = "CRITICAL"
        confidence = max(confidence, 0.8)
        reason_parts.append("multiple independent hazard signals")

    reason = "; ".join(reason_parts) if reason_parts else "no urgency indicators found"

    return SeverityResult(
        severity=severity,
        confidence=round(confidence, 4),
        reason=reason,
        signals=sorted(set(signals))[:10],
        source="rules",
    )


def find_duplicates(
    description: str,
    candidates: Sequence[ComplaintRecord],
    *,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    categoryId: Optional[str] = None,
    radius_km: float = 0.3,
    window_days: int = 30,
    threshold: float = 0.55,
    now: Optional[datetime] = None,
) -> DuplicateResult:
    """Find existing complaints that look like the same real-world issue.

    A duplicate needs to agree on *what* and *where*: text similarity alone would
    flag every pothole in the city. The combined score is text similarity
    weighted by proximity, with a same-category bonus. Candidates outside the
    radius or the time window are dropped before scoring.
    """
    if not candidates:
        return DuplicateResult(source="rules")

    now = now or datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = now - timedelta(days=window_days)

    query_tokens = tokenize(description)
    if not query_tokens:
        return DuplicateResult(source="rules")

    query_bigrams = bigrams(query_tokens)

    # Filter first so IDF is computed over genuinely comparable complaints.
    in_scope: List[Tuple[ComplaintRecord, Optional[float]]] = []
    for candidate in candidates:
        if candidate.createdAt:
            created = candidate.createdAt
            if created.tzinfo is not None:
                created = created.astimezone(timezone.utc).replace(tzinfo=None)
            if created < cutoff:
                continue

        distance: Optional[float] = None
        if None not in (latitude, longitude, candidate.latitude, candidate.longitude):
            distance = haversine_km(latitude, longitude, candidate.latitude, candidate.longitude)
            if distance > radius_km:
                continue

        in_scope.append((candidate, distance))

    if not in_scope:
        return DuplicateResult(source="rules")

    corpus = [tokenize(c.description) for c, _ in in_scope] + [query_tokens]
    idf = build_idf(corpus)

    scored: List[DuplicateCandidate] = []
    for candidate, distance in in_scope:
        candidate_tokens = tokenize(candidate.description)
        if not candidate_tokens:
            continue

        cosine = weighted_cosine(query_tokens, candidate_tokens, idf)
        phrase_overlap = jaccard(query_bigrams, bigrams(candidate_tokens))
        # Bigram agreement is strong evidence, but sparse on short text, so it
        # tops up the cosine rather than standing on its own.
        text_score = min(1.0, cosine + 0.25 * phrase_overlap)

        reasons: List[str] = [f"text similarity {text_score:.0%}"]

        # Proximity multiplier: same spot keeps the full score, edge of the
        # radius keeps 70%.
        if distance is not None:
            proximity = 1.0 - 0.3 * (distance / radius_km if radius_km else 0)
            text_score *= max(0.7, proximity)
            reasons.append(f"{distance * 1000:.0f} m away")

        if categoryId and candidate.categoryId == categoryId:
            text_score = min(1.0, text_score + 0.1)
            reasons.append("same category")

        if text_score >= threshold:
            scored.append(
                DuplicateCandidate(
                    complaintId=candidate.complaintId,
                    similarity=round(text_score, 4),
                    distanceKm=round(distance, 4) if distance is not None else None,
                    status=candidate.status,
                    description=truncate(candidate.description, 200),
                    createdAt=candidate.createdAt.isoformat() if candidate.createdAt else None,
                    reason="; ".join(reasons),
                )
            )

    scored.sort(key=lambda c: c.similarity, reverse=True)

    return DuplicateResult(
        isDuplicate=bool(scored),
        candidates=scored[:5],
        source="rules",
    )


def summarize(description: str, category: Optional[CategoryRecord], severity: str) -> str:
    """Build a one-line officer-facing summary without calling an LLM.

    The Gemini path produces a better write-up; this keeps the field populated
    when no key is configured so the UI never has to render an empty summary.
    """
    department = category.department if category else "General"
    label = category.name if category else "Unclassified issue"
    return f"[{severity}] {label} ({department}): {truncate(description, 160)}"

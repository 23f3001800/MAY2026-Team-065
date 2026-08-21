"""A small in-process cache, and HTTP validators to go with it.

Two different problems, deliberately solved separately:

**Repeated identical work on the server.** The analytics endpoints each run
several aggregate queries over the whole complaints table. An officer dashboard
calls five of them on load, every officer loads it at the start of a shift, and
the answers are identical for all of them. ``TTLCache`` holds the computed
result for a few seconds so the second through fifth caller do not re-run the
aggregation.

**Repeated identical transfer to the client.** ``/categories`` returns reference
data that changes when somebody adds a department -- perhaps twice a year -- and
the frontend re-fetches it on every dashboard mount. An ETag lets the browser
ask "still the same?" and get 304 with no body.

Scope and limits, stated plainly because a cache that is wrong is worse than no
cache:

* **In-process.** Two API workers keep two copies and expire independently. That
  is acceptable for a few seconds of aggregate figures; it would not be for
  anything a user expects to see change immediately after they act, which is why
  nothing here caches a complaint, a status, or an inbox.
* **Keyed by caller where it matters.** Analytics is officer-and-admin-wide
  today, but the key still includes the caller's role, so scoping the figures
  per user later cannot silently serve one officer another's numbers.
* **Bounded.** Entries are evicted on read when stale, and the whole cache is
  dropped if it grows past a ceiling. An unbounded process-lifetime dict is a
  slow memory leak wearing a hat.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Past this many live entries the cache is cleared wholesale rather than being
# evicted intelligently. It only ever holds a handful of analytics shapes; going
# far beyond that means a key is being built from something unbounded, and
# dropping the lot is the safe response to a bug we have not found yet.
_MAX_ENTRIES = 512


def _int_env(name: str, default: int, minimum: int = 0) -> int:
    try:
        return max(minimum, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


def analytics_ttl_seconds() -> int:
    """How long an analytics answer may be reused. 0 disables caching."""
    return _int_env("ANALYTICS_CACHE_SECONDS", 30)


def reference_max_age() -> int:
    """Cache-Control max-age for reference data such as categories."""
    return _int_env("REFERENCE_CACHE_SECONDS", 60)


class TTLCache:
    """Async-safe cache of values that expire after a fixed number of seconds."""

    def __init__(self) -> None:
        self._entries: Dict[str, Tuple[float, Any]] = {}
        self._lock = asyncio.Lock()
        self.hits = 0
        self.misses = 0

    async def get_or_set(
        self,
        key: str,
        ttl: int,
        producer: Callable[[], Awaitable[Any]],
    ) -> Any:
        """Return the cached value for ``key``, computing it if absent or stale.

        The producer runs OUTSIDE the lock. Holding a lock across a database
        query would serialise every analytics request behind the slowest one,
        which is the opposite of the point. The cost is that a few concurrent
        callers may all compute on a cold key -- they write the same answer, so
        the only waste is duplicated work that was going to happen anyway.
        """
        if ttl <= 0:
            return await producer()

        now = time.monotonic()

        async with self._lock:
            entry = self._entries.get(key)
            if entry is not None and entry[0] > now:
                self.hits += 1
                return entry[1]
            if entry is not None:
                del self._entries[key]

        self.misses += 1
        value = await producer()

        async with self._lock:
            if len(self._entries) >= _MAX_ENTRIES:
                logger.warning(
                    "cache exceeded %d entries; clearing (key shape suspect)",
                    _MAX_ENTRIES,
                )
                self._entries.clear()
            self._entries[key] = (time.monotonic() + ttl, value)

        return value

    async def clear(self) -> int:
        """Drop everything. Returns how many entries were removed."""
        async with self._lock:
            count = len(self._entries)
            self._entries.clear()
        return count

    def stats(self) -> dict:
        total = self.hits + self.misses
        return {
            "entries": len(self._entries),
            "hits": self.hits,
            "misses": self.misses,
            "hitRate": round(self.hits / total, 3) if total else None,
        }


# One shared instance for the analytics endpoints.
analytics_cache = TTLCache()


def key_for(prefix: str, **parts: Any) -> str:
    """Build a stable cache key from a prefix and keyword parts.

    Sorted and JSON-encoded so that the same arguments in a different order
    produce the same key, and so that ``None`` and the string "None" do not
    collide -- which they would with naive string concatenation.
    """
    encoded = json.dumps(parts, sort_keys=True, default=str)
    digest = hashlib.sha256(encoded.encode("utf-8")).hexdigest()[:16]
    return prefix + ":" + digest


# --- HTTP validators -----------------------------------------------------


def etag_for(payload: Any) -> str:
    """A strong ETag for a JSON-serialisable payload.

    Derived from the content itself rather than a timestamp, so an update that
    rewrites a row without changing what it says does not needlessly invalidate
    every client's copy.
    """
    encoded = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return '"' + hashlib.sha256(encoded).hexdigest()[:32] + '"'


def matches(if_none_match: Optional[str], etag: str) -> bool:
    """Does the client's If-None-Match cover this ETag?

    Handles the comma-separated list form and the ``W/`` weak prefix, both of
    which are legal and both of which a naive equality check gets wrong -- the
    symptom being a cache that never returns 304 and quietly does nothing.
    """
    if not if_none_match:
        return False

    if if_none_match.strip() == "*":
        return True

    bare = etag.strip().lstrip("W/").strip()
    for candidate in if_none_match.split(","):
        if candidate.strip().lstrip("W/").strip() == bare:
            return True
    return False

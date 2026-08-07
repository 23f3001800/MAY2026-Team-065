"""Minimal async Gemini REST client (no vendor SDK).

Targets the ``generateContent`` surface, which is stable, has no published
shutdown date, and works identically across the 2.5 and 3.x model families --
so pinning a different ``GEMINI_MODEL`` needs no code change.

Two protocol details drive the shape of this module:

* **Request/response casing is asymmetric.** Google's protobuf-JSON layer accepts
  either ``inline_data`` or ``inlineData`` on the way in, but *always* serialises
  responses in camelCase. So requests follow the documented snake_case examples
  while the response parser only ever reads camelCase keys.
* **A blocked response is HTTP 200.** Safety blocks and truncation return a
  success status with ``content.parts`` missing entirely -- not empty. Indexing
  straight into ``candidates[0]["content"]["parts"][0]`` raises KeyError on what
  looks like a successful call, so extraction is defensive throughout.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from .config import AISettings
from .provider import AIProviderError

logger = logging.getLogger(__name__)

# Codes worth retrying: transient overload, rate limiting, gateway issues.
_RETRYABLE_STATUS = {408, 429, 500, 502, 503, 504}
_MAX_ATTEMPTS = 3

# The four adjustable harm categories. Relaxed to BLOCK_ONLY_HIGH because
# genuine street-infrastructure photos (accident damage, biohazard, sanitation)
# otherwise trip the default thresholds. SPII and PROHIBITED_CONTENT are not
# adjustable, so PII blocks are handled by failing soft instead.
_SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
]


class GeminiBlockedError(AIProviderError):
    """The model returned 200 but no usable content (safety block or truncation)."""


class GeminiClient:
    """Thin async wrapper over the Gemini generateContent endpoint."""

    def __init__(self, settings: AISettings, *, client: Optional[httpx.AsyncClient] = None):
        self._settings = settings
        # An injected client lets tests stub transport without patching globals.
        self._client = client

    # -- public API ------------------------------------------------------

    async def generate_json(
        self,
        *,
        prompt: str,
        system_instruction: str,
        response_schema: Dict[str, Any],
        image_bytes: Optional[bytes] = None,
        image_mime_type: Optional[str] = None,
        max_output_tokens: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Run a prompt (optionally with one image) and return parsed JSON.

        Raises AIProviderError on transport failure, a blocked response, or
        output that is not parseable JSON.
        """
        parts: List[Dict[str, Any]] = [{"text": prompt}]

        if image_bytes:
            if not image_mime_type:
                raise AIProviderError("image_mime_type is required when sending an image")
            parts.append(
                {
                    "inline_data": {
                        "mime_type": image_mime_type,
                        # Raw base64 -- no data: URI prefix.
                        "data": base64.b64encode(image_bytes).decode("ascii"),
                    }
                }
            )

        payload: Dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": response_schema,
                "maxOutputTokens": max_output_tokens or self._settings.max_output_tokens,
            },
            "safetySettings": _SAFETY_SETTINGS,
        }

        raw = await self._post(payload)
        text = _extract_text(raw)

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            # Structured mode can still emit truncated JSON if the token budget
            # runs out mid-object.
            raise AIProviderError(
                f"Gemini returned unparseable JSON ({exc}); output may have been truncated"
            ) from exc

        if not isinstance(parsed, dict):
            raise AIProviderError("Gemini returned JSON that was not an object")
        return parsed

    async def generate_text(
        self,
        *,
        prompt: str,
        system_instruction: str,
        max_output_tokens: Optional[int] = None,
    ) -> str:
        """Run a prompt and return plain text."""
        payload: Dict[str, Any] = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "maxOutputTokens": max_output_tokens or self._settings.max_output_tokens,
            },
            "safetySettings": _SAFETY_SETTINGS,
        }
        raw = await self._post(payload)
        return _extract_text(raw)

    # -- transport -------------------------------------------------------

    async def _post(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        settings = self._settings
        if not settings.gemini_configured:
            raise AIProviderError("GEMINI_API_KEY is not configured", retryable=False)

        url = f"{settings.gemini_api_base}/models/{settings.gemini_model}:generateContent"
        headers = {
            # Header auth rather than ?key= so the secret stays out of URLs and logs.
            "x-goog-api-key": settings.gemini_api_key,
            "Content-Type": "application/json",
        }

        last_error: Optional[Exception] = None

        for attempt in range(1, _MAX_ATTEMPTS + 1):
            try:
                response = await self._request(url, headers, payload)
            except httpx.TimeoutException as exc:
                last_error = exc
                logger.warning(
                    "Gemini request timed out (attempt %d/%d)", attempt, _MAX_ATTEMPTS
                )
            except httpx.HTTPError as exc:
                last_error = exc
                logger.warning(
                    "Gemini transport error (attempt %d/%d): %s", attempt, _MAX_ATTEMPTS, exc
                )
            else:
                if response.status_code == 200:
                    try:
                        return response.json()
                    except ValueError as exc:
                        raise AIProviderError("Gemini returned a non-JSON body") from exc

                detail = _error_detail(response)

                if response.status_code in _RETRYABLE_STATUS and attempt < _MAX_ATTEMPTS:
                    logger.warning(
                        "Gemini returned %d (attempt %d/%d): %s",
                        response.status_code, attempt, _MAX_ATTEMPTS, detail,
                    )
                    last_error = AIProviderError(detail, retryable=True,
                                                 status_code=response.status_code)
                else:
                    raise AIProviderError(
                        f"Gemini request failed ({response.status_code}): {detail}",
                        retryable=response.status_code in _RETRYABLE_STATUS,
                        status_code=response.status_code,
                    )

            if attempt < _MAX_ATTEMPTS:
                await asyncio.sleep(0.5 * (2 ** (attempt - 1)))  # 0.5s, 1s

        raise AIProviderError(
            f"Gemini request failed after {_MAX_ATTEMPTS} attempts: {last_error}",
            retryable=True,
        )

    async def _request(
        self, url: str, headers: Dict[str, str], payload: Dict[str, Any]
    ) -> httpx.Response:
        timeout = self._settings.request_timeout_seconds

        if self._client is not None:
            return await self._client.post(url, headers=headers, json=payload, timeout=timeout)

        async with httpx.AsyncClient(timeout=timeout) as client:
            return await client.post(url, headers=headers, json=payload)


def _error_detail(response: httpx.Response) -> str:
    """Pull a human-readable message out of an error body."""
    try:
        body = response.json()
    except ValueError:
        return (response.text or "").strip()[:300]

    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict):
            return str(error.get("message") or error.get("status") or error)[:300]
    return str(body)[:300]


def _extract_text(response: Dict[str, Any]) -> str:
    """Pull generated text out of a response, treating 200-with-no-content as an error.

    Responses are always camelCase, so only camelCase keys are read here.
    """
    prompt_feedback = response.get("promptFeedback") or {}
    block_reason = prompt_feedback.get("blockReason")
    if block_reason:
        raise GeminiBlockedError(f"Gemini blocked the prompt (reason: {block_reason})")

    candidates = response.get("candidates") or []
    if not candidates:
        raise GeminiBlockedError("Gemini returned no candidates")

    candidate = candidates[0]
    finish_reason = candidate.get("finishReason")

    # None is normal for a complete single-candidate response.
    if finish_reason not in (None, "STOP", "MAX_TOKENS"):
        ratings = candidate.get("safetyRatings")
        logger.warning(
            "Gemini stopped early (finishReason=%s, safetyRatings=%s)", finish_reason, ratings
        )
        raise GeminiBlockedError(f"Gemini returned no usable content (finishReason={finish_reason})")

    parts = (candidate.get("content") or {}).get("parts") or []
    text = "".join(part["text"] for part in parts if isinstance(part, dict) and "text" in part)

    if not text.strip():
        raise GeminiBlockedError(
            f"Gemini returned an empty response (finishReason={finish_reason})"
        )

    if finish_reason == "MAX_TOKENS":
        # Surfaced by the caller's JSON parse if the object was cut mid-structure.
        logger.warning("Gemini hit the output token limit; response may be truncated")

    return text

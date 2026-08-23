"""OpenRouter client -- the second LLM backend.

Behind the same two methods the Gemini client exposes, ``generate_json`` and
``generate_text``, so ``AIService`` never branches on which provider is live.

**Why a second provider at all.** One provider is a single point of failure.
When the Gemini quota is exhausted, every LLM-backed feature degrades at once --
category refinement, image analysis, the assistant -- and the only signal is a
429 buried in a response body. The rules engine still triages, so nothing breaks
outright, but the refinement layer disappears silently.

**Why OpenRouter rather than another vendor.** It is one account and one key in
front of many models, so a fallback does not mean a second billing relationship
and a second SDK, and the fallback model can be changed by editing one
environment variable instead of writing another client. The API is
OpenAI-shaped, which is the de facto standard.

**Differences from a direct OpenAI-compatible endpoint**, all of which this
file has to handle:

* The model is *always* named in the body, and the name is namespaced by vendor
  (``openai/gpt-4o-mini``, ``google/gemini-2.0-flash-001``). A bare model name
  without the vendor prefix is a 400.
* **402 means out of credit**, not a malformed request. It is the failure this
  integration will actually hit, and reporting it as a generic error sends
  whoever is debugging to look at the payload instead of the balance.
* ``json_schema`` structured output is supported by only some of the models on
  offer, so a rejection falls back to ``json_object``.
* ``max_tokens`` is normalised across upstreams, so there is no need to work
  out which spelling of the token limit a given model accepts.

Implemented on httpx rather than the ``openai`` package: httpx is already a
dependency, the surface used here is one endpoint, and an SDK for that is a
dependency to pin and upgrade in exchange for very little.
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Any, Dict, List, Optional

import httpx

from .config import AISettings
from .provider import AIProviderError

logger = logging.getLogger(__name__)


class OpenRouterClient:
    """Thin async wrapper over the OpenRouter chat completions endpoint."""

    def __init__(self, settings: AISettings, *, client: Optional[httpx.AsyncClient] = None):
        self._settings = settings
        # An injected client lets tests stub transport without patching globals.
        self._client = client
        # Set once a model has refused json_schema, so the retry is not paid for
        # on every subsequent call for the life of this client.
        self._schema_unsupported = False

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

        Uses json_schema structured output with ``strict: true`` where the model
        supports it, so it cannot add or drop keys -- the same guarantee
        Gemini's responseSchema gives, which callers already rely on.
        """
        content: List[Dict[str, Any]] = [{"type": "text", "text": prompt}]

        if image_bytes:
            if not image_mime_type:
                raise AIProviderError("image_mime_type is required when sending an image")
            encoded = base64.b64encode(image_bytes).decode("ascii")
            content.append({
                "type": "image_url",
                # A data: URI, following the OpenAI convention -- unlike Gemini,
                # which takes raw base64 in an inlineData part.
                "image_url": {"url": "data:" + image_mime_type + ";base64," + encoded},
            })

        payload: Dict[str, Any] = {
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": content},
            ],
        }

        if not self._schema_unsupported:
            payload["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": "structured_output",
                    "strict": True,
                    "schema": _strictify(response_schema),
                },
            }
        else:
            payload["response_format"] = {"type": "json_object"}

        try:
            raw = await self._post(payload, tokens=max_output_tokens)
        except AIProviderError as exc:
            if self._schema_unsupported or not _rejects_schema(exc):
                raise
            # Still forces valid JSON, just not a shape; the caller validates
            # what comes back anyway. A looser result beats no AI at all.
            logger.info(
                "openrouter: %s does not support json_schema, falling back to json_object",
                self._settings.openrouter_model,
            )
            self._schema_unsupported = True
            payload["response_format"] = {"type": "json_object"}
            raw = await self._post(payload, tokens=max_output_tokens)

        text = _extract_text(raw)
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise AIProviderError(
                "OpenRouter returned unparseable JSON (" + str(exc)
                + "); output may have been truncated"
            ) from exc

        if not isinstance(parsed, dict):
            raise AIProviderError("OpenRouter returned JSON that was not an object")
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
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": prompt},
            ],
        }
        return _extract_text(await self._post(payload, tokens=max_output_tokens))

    # -- transport -------------------------------------------------------

    @property
    def _url(self) -> str:
        return self._settings.openrouter_api_base + "/chat/completions"

    @property
    def _headers(self) -> Dict[str, str]:
        headers = {
            "Authorization": "Bearer " + self._settings.openrouter_api_key,
            "Content-Type": "application/json",
        }
        # Optional attribution headers. OpenRouter uses them to label traffic on
        # the account's dashboard, which is what makes a spend spike traceable
        # to this service rather than to "something with our key".
        if self._settings.openrouter_referer:
            headers["HTTP-Referer"] = self._settings.openrouter_referer
        if self._settings.openrouter_title:
            headers["X-Title"] = self._settings.openrouter_title
        return headers

    async def _post(
        self, payload: Dict[str, Any], *, tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        settings = self._settings
        if not settings.openrouter_configured:
            raise AIProviderError(
                "OpenRouter needs OPENROUTER_API_KEY.", retryable=False
            )

        payload = dict(payload)
        payload.setdefault("model", settings.openrouter_model)
        payload["max_tokens"] = tokens or settings.max_output_tokens

        return await self._send(payload, self._headers)

    async def _send(self, payload: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
        if self._client is not None:
            response = await self._client.post(self._url, json=payload, headers=headers)
            return _parse_response(response)

        timeout = httpx.Timeout(self._settings.request_timeout_seconds)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await self._request(client, payload, headers)
        return _parse_response(response)

    async def _request(self, client, payload, headers):
        try:
            return await client.post(self._url, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise AIProviderError("OpenRouter timed out", retryable=True) from exc
        except httpx.HTTPError as exc:
            raise AIProviderError(
                "OpenRouter request failed: " + str(exc), retryable=True
            ) from exc


# -- helpers -------------------------------------------------------------

def _rejects_schema(exc: AIProviderError) -> bool:
    """Did the failure come from json_schema specifically?

    Matched on the phrase rather than the status code, because a model that does
    not support structured output and a genuinely malformed request both arrive
    as 400 -- and retrying the latter without its response_format would just
    fail again more slowly.
    """
    message = str(exc).lower()
    return "json_schema" in message or "response_format" in message or (
        "structured output" in message
    )


def _strictify(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Adapt a schema to strict structured-output rules.

    Strict mode requires every object to list all of its properties as required
    and to set additionalProperties false. The schemas in service.py were
    written for Gemini, which does not care, so they are adapted here rather
    than maintained twice.
    """
    if not isinstance(schema, dict):
        return schema

    out = dict(schema)
    if out.get("type") == "object":
        props = out.get("properties") or {}
        out["properties"] = {k: _strictify(v) for k, v in props.items()}
        out["required"] = list(props.keys())
        out["additionalProperties"] = False
    elif out.get("type") == "array" and "items" in out:
        out["items"] = _strictify(out["items"])
    return out


def _parse_response(response) -> Dict[str, Any]:
    if response.status_code >= 400:
        detail = _error_detail(response)

        if response.status_code == 402:
            # The one OpenRouter-specific failure worth naming. Left generic it
            # sends whoever is debugging to inspect the payload rather than the
            # account balance.
            raise AIProviderError(
                "OpenRouter rejected the request for lack of credit (402): " + detail,
                retryable=False,
                status_code=402,
            )

        # 429 and 5xx are worth retrying; a 400 means the request itself is wrong.
        retryable = response.status_code == 429 or response.status_code >= 500
        raise AIProviderError(
            "OpenRouter request failed (" + str(response.status_code) + "): " + detail,
            retryable=retryable,
            status_code=response.status_code,
        )

    try:
        body = response.json()
    except ValueError as exc:
        raise AIProviderError("OpenRouter returned a non-JSON response") from exc

    # OpenRouter can answer 200 with an error object in the body when an
    # upstream provider fails mid-route. Without this check that surfaces as
    # "returned no choices", which points at the wrong thing entirely.
    error = body.get("error")
    if isinstance(error, dict) and error:
        code = error.get("code")
        raise AIProviderError(
            "OpenRouter upstream error: " + str(error.get("message") or error)[:300],
            retryable=code in (429, 502, 503),
            status_code=code if isinstance(code, int) else None,
        )

    return body


def _error_detail(response) -> str:
    try:
        body = response.json()
    except ValueError:
        return response.text[:200]
    error = body.get("error")
    if isinstance(error, dict):
        return str(error.get("message") or error)[:300]
    return str(body)[:300]


def _extract_text(raw: Dict[str, Any]) -> str:
    """Pull the assistant message out of a chat completion.

    A content filter produces a choice with no content and a finish_reason
    saying so. That is reported as a block rather than as empty output, because
    the two need very different handling from the caller.
    """
    choices = raw.get("choices") or []
    if not choices:
        raise AIProviderError("OpenRouter returned no choices")

    choice = choices[0]
    finish = choice.get("finish_reason")
    message = choice.get("message") or {}
    text = message.get("content")

    if not text:
        if finish in ("content_filter", "error"):
            raise AIProviderError("OpenRouter blocked the response (" + str(finish) + ")")
        if finish == "length":
            raise AIProviderError(
                "OpenRouter hit the token limit before producing any output"
            )
        raise AIProviderError(
            "OpenRouter returned empty content (finish_reason=" + str(finish) + ")"
        )

    return text

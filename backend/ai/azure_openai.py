"""Azure OpenAI (Azure AI Foundry) client.

A second LLM backend behind the same two methods the Gemini client exposes --
``generate_json`` and ``generate_text`` -- so ``AIService`` never branches on
which provider is live.

Why a second provider at all: one provider is a single point of failure. When
the Gemini quota was exhausted during Sprint 2, every LLM-backed feature went
down together (categorisation, vision, the assistant), and the only signal was
a 429 buried in a response body.

Implemented directly on httpx rather than the ``openai`` package. httpx is
already a dependency, the surface used here is one endpoint, and adding an SDK
for that buys very little in exchange for a dependency to pin and upgrade.

THE USUAL AZURE MISTAKE: the URL takes the *deployment* name, not the model
name. A deployment called "gpt4o-prod" serving gpt-4o is addressed as
"gpt4o-prod". Sending the model name gives a 404 that reads as if the whole
resource were missing.
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


class AzureOpenAIClient:
    """Thin async wrapper over the Azure OpenAI chat completions endpoint."""

    def __init__(self, settings: AISettings, *, client: Optional[httpx.AsyncClient] = None):
        self._settings = settings
        # An injected client lets tests stub transport without patching globals.
        self._client = client
        # Which token-limit parameter this deployment accepts.
        #
        # The two generations disagree and each rejects the other's spelling:
        # gpt-4o and earlier take `max_tokens`, while gpt-5 and the o-series
        # take `max_completion_tokens` and 400 on `max_tokens`. Rather than
        # guess from the model name -- which is a string the operator chose and
        # may say nothing about the model -- the first request finds out from
        # the API and the answer is reused for the life of the client.
        self._token_param: Optional[str] = None

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

        Uses json_schema structured output where the deployment supports it, with
        ``strict: true`` so the model cannot add or drop keys. That is the same
        guarantee Gemini's responseSchema gives, and callers already rely on it.
        """
        content: List[Dict[str, Any]] = [{"type": "text", "text": prompt}]

        if image_bytes:
            if not image_mime_type:
                raise AIProviderError("image_mime_type is required when sending an image")
            encoded = base64.b64encode(image_bytes).decode("ascii")
            content.append({
                "type": "image_url",
                # Azure wants a data: URI here, unlike Gemini which takes raw base64.
                "image_url": {"url": "data:" + image_mime_type + ";base64," + encoded},
            })

        payload: Dict[str, Any] = {
            "messages": [
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": content},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": "structured_output",
                    "strict": True,
                    "schema": _strictify(response_schema),
                },
            },
        }

        try:
            raw = await self._post(payload, tokens=max_output_tokens)
        except AIProviderError as exc:
            # Older deployments and some models reject json_schema outright. Fall
            # back to json_object, which still forces valid JSON but not a shape,
            # and let the caller's own validation carry the rest. A slightly
            # looser result beats no AI at all.
            if "json_schema" not in str(exc):
                raise
            logger.info("azure: deployment rejected json_schema, retrying with json_object")
            payload["response_format"] = {"type": "json_object"}
            raw = await self._post(payload, tokens=max_output_tokens)

        text = _extract_text(raw)
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise AIProviderError(
                "Azure OpenAI returned unparseable JSON (" + str(exc)
                + "); output may have been truncated"
            ) from exc

        if not isinstance(parsed, dict):
            raise AIProviderError("Azure OpenAI returned JSON that was not an object")
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
        s = self._settings
        if s.azure_mode == "inference":
            # Foundry model inference: one shared endpoint, model named in the
            # body, no deployment to create.
            return s.azure_inference_endpoint + "/chat/completions"
        return (
            s.azure_endpoint
            + "/openai/deployments/" + s.azure_deployment
            + "/chat/completions?api-version=" + s.azure_api_version
        )

    @property
    def _headers(self) -> Dict[str, str]:
        s = self._settings
        if s.azure_mode == "inference":
            # Bearer, not api-key: the inference endpoint follows the OpenAI
            # convention rather than the Azure OpenAI resource one.
            return {
                "Authorization": "Bearer " + s.azure_api_key,
                "Content-Type": "application/json",
            }
        return {"api-key": s.azure_api_key, "Content-Type": "application/json"}

    async def _post(
        self, payload: Dict[str, Any], *, tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        settings = self._settings
        if not settings.azure_configured:
            raise AIProviderError(
                "Azure needs at least AZURE_OPENAI_API_KEY. For an Azure OpenAI "
                "resource, also set AZURE_OPENAI_ENDPOINT and "
                "AZURE_OPENAI_DEPLOYMENT.",
                retryable=False,
            )

        # The inference endpoint takes the model in the body; the resource
        # endpoint takes it in the URL, so sending it there would be rejected.
        if settings.azure_mode == "inference" and "model" not in payload:
            payload = dict(payload, model=settings.azure_model)

        headers = self._headers
        limit = tokens or settings.max_output_tokens

        # Start with whichever spelling is known to work, or the newer one.
        attempts = [self._token_param] if self._token_param else [
            "max_completion_tokens", "max_tokens",
        ]

        last_error: Optional[AIProviderError] = None
        for name in attempts:
            attempt = dict(payload)
            attempt.pop("max_tokens", None)
            attempt.pop("max_completion_tokens", None)
            attempt[name] = limit
            try:
                result = await self._send(attempt, headers)
            except AIProviderError as exc:
                # Only a rejection OF THIS PARAMETER is worth retrying; anything
                # else is a real failure and retrying would just repeat it.
                if not _rejects_token_param(exc, name):
                    raise
                last_error = exc
                continue
            self._token_param = name
            return result

        raise last_error or AIProviderError("Azure OpenAI rejected every token parameter")

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
            raise AIProviderError("Azure OpenAI timed out", retryable=True) from exc
        except httpx.HTTPError as exc:
            raise AIProviderError(
                "Azure OpenAI request failed: " + str(exc), retryable=True
            ) from exc


# -- helpers -------------------------------------------------------------

def _rejects_token_param(exc: AIProviderError, name: str) -> bool:
    """Did Azure refuse specifically because of the token-limit parameter?

    Matched on the parameter name plus an unsupported/not-supported phrase, so a
    quota or content error carrying the word "token" is not mistaken for this.
    """
    message = str(exc).lower()
    if name not in message:
        return False
    return "unsupported" in message or "not supported" in message


def _strictify(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Adapt a schema to Azure's strict structured-output rules.

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
        # 429 and 5xx are worth retrying; a 400 means the request itself is wrong.
        retryable = response.status_code == 429 or response.status_code >= 500
        raise AIProviderError(
            "Azure OpenAI request failed (" + str(response.status_code) + "): " + detail,
            retryable=retryable,
            status_code=response.status_code,
        )
    try:
        return response.json()
    except ValueError as exc:
        raise AIProviderError("Azure OpenAI returned a non-JSON response") from exc


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

    A content filter produces a choice with no content and a finish_reason of
    content_filter. That is reported as a block rather than as empty output,
    because the two need very different handling from the caller.
    """
    choices = raw.get("choices") or []
    if not choices:
        raise AIProviderError("Azure OpenAI returned no choices")

    choice = choices[0]
    finish = choice.get("finish_reason")
    message = choice.get("message") or {}
    text = message.get("content")

    if not text:
        if finish == "content_filter":
            raise AIProviderError("Azure OpenAI blocked the response (content filter)")
        if finish == "length":
            raise AIProviderError(
                "Azure OpenAI hit the token limit before producing any output"
            )
        raise AIProviderError(
            "Azure OpenAI returned empty content (finish_reason=" + str(finish) + ")"
        )

    return text

"""AI endpoints: triage, image analysis, write-ups and the grounded assistant.

Design points worth knowing:

* Every route degrades rather than failing. If Gemini is unconfigured or errors,
  the deterministic engine answers instead and ``source`` in the response says
  so. Only the LLM-only routes (image analysis, write-up) report unavailability,
  and they do it with a 200 + ``available: false`` rather than an error status,
  because "no AI" is a normal state for this deployment, not a fault.
* Assistant retrieval is scoped by role inside the SQL query, so a prompt
  injected into a complaint description cannot widen what the model can read.
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

import models
import schemas
from ai.assistant import answer_question
from ai.service import AIService
from dependencies import get_current_user, get_db, require_roles
from services import notifications as notification_service
from services import triage as triage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])


def get_ai_service() -> AIService:
    """Provide the AI facade.

    A dependency (not a module global) so tests can override it with a stubbed
    provider via ``app.dependency_overrides``.
    """
    return AIService()


def _category_payload(result) -> dict:
    return {
        "suggestions": [
            {
                "categoryId": s.categoryId,
                "name": s.name,
                "department": s.department,
                "confidence": s.confidence,
                "reason": s.reason,
            }
            for s in result.suggestions
        ],
        "source": result.source,
    }


def _severity_payload(result) -> dict:
    return {
        "severity": result.severity,
        "confidence": result.confidence,
        "reason": result.reason,
        "signals": result.signals,
        "source": result.source,
    }


def _duplicates_payload(result) -> dict:
    return {
        "isDuplicate": result.isDuplicate,
        "candidates": [
            {
                "complaintId": c.complaintId,
                "similarity": c.similarity,
                "distanceKm": c.distanceKm,
                "status": c.status,
                "description": c.description,
                "createdAt": c.createdAt,
                "reason": c.reason,
            }
            for c in result.candidates
        ],
        "source": result.source,
    }


def _vision_payload(result) -> Optional[dict]:
    if result is None:
        return None
    return {
        "available": result.available,
        "unavailableReason": result.unavailableReason,
        "description": result.description,
        "categoryId": result.categoryId,
        "categoryName": result.categoryName,
        "severity": result.severity,
        "confidence": result.confidence,
        "observations": result.observations,
        "source": result.source,
    }


@router.get("/health", summary="AI subsystem status")
async def ai_health(service: AIService = Depends(get_ai_service)):
    """Report which AI features this deployment can actually serve.

    Unauthenticated on purpose: it exposes no data, and the frontend needs it
    before login to decide whether to show AI affordances at all.
    """
    return service.status()


@router.post(
    "/categorize",
    response_model=schemas.CategorizeResponse,
    summary="Suggest a category for complaint text",
)
async def categorize(
    payload: schemas.CategorizeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
    service: AIService = Depends(get_ai_service),
):
    categories = await triage_service.load_categories(db)
    if not categories:
        raise HTTPException(
            status_code=503,
            detail="No categories are configured; run seed.py before using AI categorisation.",
        )

    result = await service.categorize(payload.description, categories)
    return _category_payload(result)


@router.post(
    "/severity",
    response_model=schemas.SeverityResponse,
    summary="Predict complaint severity",
)
async def predict_severity(
    payload: schemas.SeverityRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
    service: AIService = Depends(get_ai_service),
):
    category = await triage_service.find_category(db, payload.categoryId)
    if payload.categoryId and category is None:
        raise HTTPException(status_code=404, detail="Category not found.")

    result = await service.predict_severity(payload.description, category)
    return _severity_payload(result)


@router.post(
    "/duplicates",
    response_model=schemas.DuplicateCheckResponse,
    summary="Check for duplicate complaints",
)
async def check_duplicates(
    payload: schemas.DuplicateCheckRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
    service: AIService = Depends(get_ai_service),
):
    candidates = await triage_service.load_duplicate_candidates(
        db, window_days=service.settings.duplicate_window_days
    )
    result = service.find_duplicates(
        payload.description,
        candidates,
        latitude=payload.latitude,
        longitude=payload.longitude,
        categoryId=payload.categoryId,
    )
    return _duplicates_payload(result)


@router.post(
    "/triage",
    response_model=schemas.TriageResponse,
    summary="Full triage: category, severity, duplicates and summary",
)
async def triage(
    payload: schemas.TriageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
    service: AIService = Depends(get_ai_service),
):
    """One call for the report form -- what the citizen sees before submitting."""
    categories = await triage_service.load_categories(db)
    if not categories:
        raise HTTPException(
            status_code=503,
            detail="No categories are configured; run seed.py before using AI triage.",
        )

    candidates = await triage_service.load_duplicate_candidates(
        db, window_days=service.settings.duplicate_window_days
    )

    result = await service.triage(
        payload.description,
        categories,
        duplicate_candidates=candidates,
        latitude=payload.latitude,
        longitude=payload.longitude,
        categoryId=payload.categoryId,
    )

    return {
        "category": _category_payload(result.category),
        "severity": _severity_payload(result.severity),
        "duplicates": _duplicates_payload(result.duplicates),
        "summary": result.summary,
        "vision": _vision_payload(result.vision),
        "source": result.source,
    }


@router.post(
    "/analyze-image",
    response_model=schemas.VisionResponse,
    summary="Analyse a complaint photo (category, description, severity)",
)
async def analyze_image(
    file: UploadFile = File(..., description="Photo of the civic issue"),
    description: str = Form("", description="Optional citizen text to give the model context"),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
    service: AIService = Depends(get_ai_service),
):
    """Infer what a photo shows, how bad it is, and which department owns it.

    Returns 200 with ``available: false`` when analysis cannot run, so the
    citizen can still file the complaint. Only a genuinely malformed upload is
    a 4xx.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    categories = await triage_service.load_categories(db)
    result = await service.analyze_image(
        contents,
        file.content_type or "application/octet-stream",
        categories,
        hint=description,
    )
    return _vision_payload(result)


@router.post(
    "/describe",
    response_model=schemas.DescriptionWriteupResponse,
    summary="Rewrite a complaint description for officers",
)
async def write_description(
    payload: schemas.DescriptionWriteupRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
    service: AIService = Depends(get_ai_service),
):
    from ai import rules  # local import: only needed for the fallback path

    category = await triage_service.find_category(db, payload.categoryId)
    rewritten = await service.write_description(payload.description, category=category)

    if rewritten:
        source = "gemini"
    else:
        # No LLM configured: return the deterministic summary rather than an error.
        severity = (await service.predict_severity(payload.description, category)).severity
        rewritten = rules.summarize(payload.description, category, severity)
        source = "rules"

    return {"original": payload.description, "rewritten": rewritten, "source": source}


@router.post(
    "/assistant/query",
    response_model=schemas.AssistantQueryResponse,
    summary="Ask the role-aware AI assistant",
)
async def assistant_query(
    payload: schemas.AssistantQueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
    service: AIService = Depends(get_ai_service),
):
    """Answer a question using only records the caller is authorised to read."""
    answer = await answer_question(db, current_user, payload.question, service)
    return {
        "answer": answer.answer,
        "citations": answer.citations,
        "source": answer.source,
        "contextUsed": answer.contextUsed,
    }


@router.post(
    "/complaints/{complaintId}/analyze",
    response_model=schemas.TriageResponse,
    summary="Re-run AI triage on an existing complaint",
)
async def analyze_existing_complaint(
    complaintId: str,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserModel = Depends(get_current_user),
    service: AIService = Depends(get_ai_service),
):
    """Re-triage a complaint and persist the result.

    Officers and administrators only: it writes to the complaint and can raise
    its severity, which is a triage decision rather than a read.
    """
    require_roles(current_user, ["officer", "administrator"], "re-run AI triage")

    result = await db.execute(
        select(models.ComplaintModel)
        .where(models.ComplaintModel.complaintId == complaintId)
        .options(
            selectinload(models.ComplaintModel.category),
            selectinload(models.ComplaintModel.location),
        )
    )
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")

    categories = await triage_service.load_categories(db)
    candidates = await triage_service.load_duplicate_candidates(
        db,
        exclude_complaint_id=complaintId,
        window_days=service.settings.duplicate_window_days,
    )

    location = complaint.location
    triage_result = await service.triage(
        complaint.description,
        categories,
        duplicate_candidates=candidates,
        latitude=location.latitude if location else None,
        longitude=location.longitude if location else None,
        categoryId=complaint.categoryId,
    )

    previous_severity = str(getattr(complaint.severity, "name", complaint.severity))
    triage_service.apply_triage(
        complaint,
        triage_result,
        db=db,
        autolink_threshold=service.settings.duplicate_autolink_threshold,
    )

    # Escalating past HIGH is worth interrupting the department for.
    if triage_result.severity.severity in {"HIGH", "CRITICAL"} and (
        triage_result.severity.severity != previous_severity
    ):
        await notification_service.notify_escalation(
            db,
            complaint,
            severity=triage_result.severity.severity,
            reason=triage_result.severity.reason,
        )

    await db.commit()

    return {
        "category": _category_payload(triage_result.category),
        "severity": _severity_payload(triage_result.severity),
        "duplicates": _duplicates_payload(triage_result.duplicates),
        "summary": triage_result.summary,
        "vision": _vision_payload(triage_result.vision),
        "source": triage_result.source,
    }

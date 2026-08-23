// AI endpoints (`/ai/*`).
//
// Two things to know before using these:
//
// 1. They are ADVISORY. Nothing here writes to a complaint. Triage output is a
//    suggestion an officer accepts or overrides — never present it as decided.
// 2. Availability is conditional. The deterministic rules engine always works,
//    but vision, description rewriting and the assistant need a Gemini key. If
//    it is missing the backend returns a response with `available: false` and
//    an `unavailableReason` rather than erroring, so callers must handle
//    "switched off" as a normal state, not a failure.
//
// Every response carries `source` — `rules` for the deterministic engine,
// `gemini` for a model call. Surface it: users trust those differently.
import { apiRequest } from './client';

export async function aiHealth() {
  return apiRequest('/ai/health');
}

// Category suggestions, ranked. Each carries a confidence and a `reason`.
export async function suggestCategory(description) {
  return apiRequest('/ai/categorize', {
    method: 'POST',
    body: { description },
  });
}

// Severity with the keyword `signals` that drove it — worth showing, because
// "flagged High because it mentions 'child' and 'school'" is auditable in a way
// a bare number is not.
export async function suggestSeverity({ description, categoryId }) {
  return apiRequest('/ai/severity', {
    method: 'POST',
    body: { description, categoryId: categoryId || null },
  });
}

// POST /ai/duplicates had a helper here and nothing ever called it. The report
// form gets duplicates from triage() below, which returns them alongside the
// category and severity it is already asking for — one round trip instead of
// two, on a form that fires on every pause in typing. Removed rather than left
// as a second way to do the same thing that no caller had ever exercised.

// One-shot category + severity + duplicates + summary. Preferred over calling
// the three separately: it is a single round trip and the backend can reuse
// intermediate work.
export async function triage({ description, categoryId, latitude, longitude }) {
  return apiRequest('/ai/triage', {
    method: 'POST',
    body: {
      description,
      categoryId: categoryId || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    },
  });
}

// Vision analysis of a photo before the complaint exists. Returns
// `{available:false, unavailableReason}` when no model is configured.
export async function analyzeImage(file) {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/ai/analyze-image', { method: 'POST', body: form });
}

// Rewrites a terse complaint into something an officer can act on.
export async function rewriteDescription({ description, categoryId }) {
  return apiRequest('/ai/describe', {
    method: 'POST',
    body: { description, categoryId: categoryId || null },
  });
}

// Role-scoped assistant. The backend decides what data this user may see, so
// the frontend passes the question and nothing else.
export async function askAssistant(question) {
  return apiRequest('/ai/assistant/query', {
    method: 'POST',
    body: { question },
  });
}

// Re-runs triage against a complaint that already exists.
export async function analyzeComplaint(complaintId) {
  return apiRequest(`/ai/complaints/${encodeURIComponent(complaintId)}/analyze`, {
    method: 'POST',
  });
}

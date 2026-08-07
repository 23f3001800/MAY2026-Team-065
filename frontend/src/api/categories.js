// GET /categories.
//
// This replaces the hand-maintained mirror of backend/seed.py that used to live
// in mappers.js. That table was the most fragile thing in the frontend: if
// anyone edited the seed, the app carried on sending category ids that no
// longer existed, and the failure surfaced as a 404 at submit time rather than
// anywhere near the cause.
//
// The static list is kept as a fallback so the app still renders if this call
// fails, but the fetched list wins whenever it arrives.
import { apiRequest } from './client';
import { CATEGORIES as FALLBACK_CATEGORIES } from './mappers';

// Short UI labels, keyed by the backend's category id. The backend names are
// descriptive ("Pothole / Road Damage") and too long for a table cell or a
// five-across button row.
const SHORT_LABELS = {
  'CAT-ROA-01': 'Pothole',
  'CAT-SAN-01': 'Garbage',
  'CAT-WAT-01': 'Water Leakage',
  'CAT-ELE-01': 'Streetlight',
  'CAT-PUB-01': 'Other',
};

function toUiCategory(c) {
  return {
    categoryId: c.categoryId,
    name: c.name,
    department: c.department,
    // Fall back to the backend name for any category added after this map was
    // written — better a long label than a blank one.
    label: SHORT_LABELS[c.categoryId] || c.name,
  };
}

export async function listCategories() {
  const data = await apiRequest('/categories');
  const mapped = (data || []).map(toUiCategory);
  return mapped.length ? mapped : FALLBACK_CATEGORIES;
}

export { FALLBACK_CATEGORIES };

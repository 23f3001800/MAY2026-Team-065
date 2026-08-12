// What a field worker can be skilled in.
//
// This list is NOT invented. Assignment matches a worker's `skillSet` text
// against the department that owns a complaint's category (see ComplaintDrawer),
// so a skill only does anything if it is spelled exactly like a real department.
// Free text made that a trap: "Roads" never matched "Roads & Transport", and the
// worker silently never came up as a candidate for road work.
//
// So the options are derived from the category table the backend actually
// serves. Add a category with a new department and it appears here on its own.
//
// The backend stores this as one comma-separated string on FieldWorkerModel
// (`skillSet`), which is why these helpers exist: the UI works in arrays, the
// wire format is a string, and the two must not drift.

/** Departments handled by the city, from the live category list. */
export function skillOptions(categories = []) {
  const seen = new Set();
  for (const c of categories) {
    if (c?.department) seen.add(c.department);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** "Roads & Transport, Sanitation" -> ['Roads & Transport', 'Sanitation'] */
export function parseSkills(skillSet) {
  if (!skillSet) return [];
  return String(skillSet)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The wire format: one comma-separated string, in the order given. */
export function formatSkills(skills = []) {
  return skills.map((s) => String(s).trim()).filter(Boolean).join(', ');
}

/**
 * Skills that are not one of the known departments.
 *
 * Existing workers were created with free text, so their stored skills may not
 * match anything. Rather than silently dropping those values when an admin
 * opens the edit form, they are surfaced as-is and flagged — the admin can see
 * exactly which entries will never match a complaint.
 */
export function unmatchedSkills(skills = [], options = []) {
  const known = new Set(options);
  return skills.filter((s) => !known.has(s));
}

// Turnaround formatting, shared by every surface that shows a duration.
//
// The backend reports resolution time in hours as a float. Rendering that raw
// gives "173.4 hours", which nobody converts in their head. These pick a unit a
// reader can actually reason about, and — importantly — keep null as null.

/** "6h" / "1.2d" / "3.4 weeks". Returns null for null, never "0". */
export function formatHours(hours) {
  if (hours == null || !Number.isFinite(hours)) return null;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 14) return `${days.toFixed(1)}d`;
  return `${(days / 7).toFixed(1)}w`;
}

/** The value and unit split apart, for MetricCard which renders them separately. */
export function hoursAsMetric(hours) {
  if (hours == null || !Number.isFinite(hours)) return { value: null, unit: '' };
  if (hours < 48) return { value: Math.round(hours), unit: 'h' };
  return { value: Number((hours / 24).toFixed(1)), unit: 'd' };
}

// The map pin, shared by the complaint map and the heat map.
//
// A divIcon built from our own markup rather than Leaflet's default PNG: that
// sidesteps the well-known broken-marker-path problem under bundlers, and lets
// a pin carry severity by colour — which is the point of plotting these at all.
import L from 'leaflet';

// Matches SeverityBadge so a pin and a badge never disagree.
export const SEVERITY_COLOR = {
  Critical: '#dc2626',
  High: '#ea580c',
  Medium: '#d97706',
  Low: '#059669',
};

const DEFAULT_COLOR = '#64748b';

export function severityColor(severity) {
  return SEVERITY_COLOR[severity] || DEFAULT_COLOR;
}

/**
 * @param {string} severity  Critical | High | Medium | Low
 * @param {boolean} [dimmed] fade a closed complaint without hiding it
 * @param {number} [size]    diameter in px
 */
export function pinIcon(severity, dimmed = false, size = 18) {
  const color = severityColor(severity);
  return L.divIcon({
    className: '', // suppress Leaflet's default styling
    html: `
      <span style="
        display:block;width:${size}px;height:${size}px;border-radius:9999px;
        background:${color};border:2.5px solid #fff;
        box-shadow:0 1px 4px rgba(15,23,42,.4);
        opacity:${dimmed ? 0.45 : 1};
      "></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  });
}

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Complaints that can actually be placed on a map. */
export function plottable(complaints = []) {
  return complaints.filter((c) => c?.coords
    && typeof c.coords.latitude === 'number'
    && typeof c.coords.longitude === 'number');
}


/**
 * Group complaints that sit on (nearly) the same point.
 *
 * Several complaints at one junction is the normal case, not an edge case: a
 * blocked drain gets reported by six neighbours, and every report carries the
 * same corner. Drawn naively they stack exactly on top of each other, so the
 * map shows one pin and the reader concludes the other five are missing.
 *
 * Rounding to five decimal places is about a metre, which is far finer than a
 * phone's GPS fix, so anything that lands in one bucket genuinely is the same
 * spot rather than merely nearby.
 *
 * @returns [{ lat, lng, items }] preserving the order complaints arrived in
 */
export function groupByPoint(complaints = [], precision = 5) {
  const buckets = new Map();
  for (const c of plottable(complaints)) {
    const lat = c.coords.latitude;
    const lng = c.coords.longitude;
    const key = `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.items.push(c);
    } else {
      buckets.set(key, { lat, lng, items: [c] });
    }
  }
  return [...buckets.values()];
}

/**
 * A pin carrying a count, for a point holding more than one complaint.
 *
 * The count is the whole point: without it a stack of six reads as one, and the
 * map quietly under-reports the city's workload.
 */
export function clusterIcon(count, severity, size = 30) {
  const color = severityColor(severity);
  return L.divIcon({
    className: '',
    html: `
      <span style="
        display:flex;align-items:center;justify-content:center;
        width:${size}px;height:${size}px;border-radius:9999px;
        background:${color};border:2.5px solid #fff;
        box-shadow:0 1px 5px rgba(15,23,42,.45);
        color:#fff;font-size:${count > 99 ? 10 : 12}px;font-weight:700;
        font-family:ui-sans-serif,system-ui,sans-serif;line-height:1;
      ">${count > 99 ? '99+' : count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  });
}

/** The most severe complaint in a group decides the pin's colour. */
export function worstSeverity(items = []) {
  const order = ['Critical', 'High', 'Medium', 'Low'];
  for (const level of order) {
    if (items.some((c) => c.severity === level)) return level;
  }
  return items[0]?.severity;
}

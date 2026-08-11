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

// Where complaints cluster.
//
// A heat layer rather than pins: at city scale a few hundred markers overlap
// into a solid mass and stop meaning anything, whereas density is exactly the
// question an administrator is asking — which streets generate the most work.
//
// Implemented with plain Leaflet circle markers at low opacity rather than
// leaflet.heat. Overlapping translucent circles accumulate into the same
// visual density, and it avoids a second dependency for one screen. The
// trade-off is that it is a density plot, not a true gaussian heat map — good
// enough to answer "where is the pressure".
//
// A pin is ALSO drawn for every complaint, on top of the halos. The halos alone
// were the right answer at city scale and the wrong one at five complaints: a
// handful of translucent blobs spread across a country reads as an empty map,
// and someone who knows there are five complaints wants to see five marks. The
// pins make the count legible; the halos still do the density work underneath
// once the volume is there to produce any.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  SEVERITY_COLOR, pinIcon, clusterIcon, escapeHtml, plottable, groupByPoint,
  worstSeverity,
} from './pin';

// The density shading. Deliberately not the civic navy: this encodes pressure,
// and reusing the brand anchor would make a quiet area look "on brand" rather
// than simply quiet. Severity is carried by the pins (see pin.js), so this is
// one colour rather than a ramp — two colour scales on one map compete.
const HALO = '#12a184';

// Weight by severity — a Critical complaint should register more strongly than
// a Low one, because that is what the map is being read for.
const WEIGHT = { Critical: 3, High: 2.2, Medium: 1.4, Low: 1 };

// Mainland India plus island territories, with a little slack.
const INDIA_BOUNDS = [[6.0, 67.5], [36.5, 97.5]];

export default function ComplaintHeatMap({ complaints = [], height = '460px' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [ready, setReady] = useState(false);

  const plotted = useMemo(() => plottable(complaints), [complaints]);

  // Reports at one spot are one counted pin. Seventeen complaints across three
  // junctions previously drew three pins and looked like fourteen were missing.
  const groups = useMemo(() => groupByPoint(plotted), [plotted]);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;
    // Constrained to India. Without bounds the map pans to empty ocean the
    // moment someone drags, and fitBounds on a stray coordinate could throw the
    // whole view to another continent — neither is a useful state for a city
    // operations map.
    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      maxBounds: INDIA_BOUNDS,
      maxBoundsViscosity: 0.9,   // rubber-band rather than a hard stop
      minZoom: 4,
    }).fitBounds(INDIA_BOUNDS);

    // Muted base map: a heat layer competes with colourful tiles, and the data
    // should be the loudest thing on screen.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setReady(true);

    return () => { map.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!plotted.length) return;

    for (const group of groups) {
      const { lat, lng, items } = group;
      const at = [lat, lng];
      // Density weight is the sum over everything at this point, so a junction
      // with twelve reports burns hotter than one with a single report -- which
      // is the entire question this map answers.
      const weight = items.reduce((total, c) => total + (WEIGHT[c.severity] || 1), 0);

      L.circleMarker(at, {
        radius: Math.min(22 * Math.sqrt(weight), 70),
        stroke: false,
        fillColor: HALO,
        fillOpacity: 0.10,
      }).addTo(layer);

      const severity = worstSeverity(items);
      const marker = items.length === 1
        ? L.marker(at, { icon: pinIcon(severity), title: items[0].issue })
        : L.marker(at, {
            icon: clusterIcon(items.length, severity),
            title: `${items.length} complaints reported here`,
          });

      const heading = items.length === 1
        ? `<div style="font-weight:600;font-size:13px;color:#0f172a;line-height:1.35">${escapeHtml(items[0].issue || 'Complaint')}</div>`
        : `<div style="font-weight:600;font-size:13px;color:#0f172a">${items.length} complaints reported here</div>`;

      const breakdown = {};
      for (const c of items) breakdown[c.category] = (breakdown[c.category] || 0) + 1;
      const lines = Object.entries(breakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([name, n]) => `<div style="font-size:12px;color:#475569">${escapeHtml(name)} · ${n}</div>`)
        .join('');

      marker.bindPopup(`
        <div style="min-width:190px">
          ${heading}
          <div style="font-size:11px;color:#94a3b8;margin:2px 0 6px">${escapeHtml(items[0].location || '')}</div>
          ${lines}
        </div>`);
      marker.addTo(layer);
    }

    // Fit to the data, but never outside India — a single bad coordinate should
    // not drag the view off the country.
    const dataBounds = L.latLngBounds(plotted.map((c) => [c.coords.latitude, c.coords.longitude]));
    map.fitBounds(dataBounds.isValid() ? dataBounds.pad(0.15) : INDIA_BOUNDS, { maxZoom: 15 });
  }, [plotted, groups]);

  useEffect(() => {
    const onResize = () => mapRef.current?.invalidateSize();
    window.addEventListener('resize', onResize);
    const t = setTimeout(onResize, 200);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(t); };
  }, [ready]);

  const missing = complaints.length - plotted.length;

  return (
    <div className="relative rounded-xl overflow-hidden border border-line shadow-sm">
      <div ref={containerRef} style={{ height }} className="w-full z-0 bg-surface-inset" />

      {plotted.length === 0 && (
        <div className="absolute inset-0 bg-surface/85 flex items-center justify-center text-center px-6 pointer-events-none">
          <p className="text-[13px] text-ink-muted max-w-xs">
            No complaint has usable coordinates, so there is nothing to plot.
          </p>
        </div>
      )}

      {plotted.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[400] bg-surface/95 backdrop-blur rounded-lg border border-line shadow-sm px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-1.5">
            {plotted.length} plotted at {groups.length} location{groups.length === 1 ? '' : 's'}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {Object.entries(SEVERITY_COLOR).map(([label, color]) => (
              <span key={label} className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-body">
                <span className="w-2.5 h-2.5 rounded-full border border-white" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
          <div className="text-[9.5px] text-ink-faint mt-1.5">
            Shading shows where complaints cluster.
          </div>
        </div>
      )}

      {/* Say what is NOT on the map. A density plot that silently drops a third
          of the records misleads more than it informs. */}
      {missing > 0 && (
        <div className="absolute top-3 right-3 z-[400] bg-caution-50/95 border border-caution-100 rounded-lg px-2.5 py-1.5">
          <span className="text-[11px] font-medium text-caution-700 tnum">
            {missing} without coordinates
          </span>
        </div>
      )}
    </div>
  );
}

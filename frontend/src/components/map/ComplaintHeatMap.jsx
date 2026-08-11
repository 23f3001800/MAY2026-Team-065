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
// enough to answer "where is the pressure", and it degrades honestly at low
// counts instead of painting a dramatic blob over three complaints.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Cool → hot. Deliberately not the civic navy: this ramp encodes intensity,
// and reusing the brand anchor would make a quiet area look "on brand" rather
// than simply quiet.
const RAMP = ['#2a6396', '#12a184', '#d97706', '#b42318'];

// Weight by severity — a Critical complaint should register more strongly than
// a Low one, because that is what the map is being read for.
const WEIGHT = { Critical: 3, High: 2.2, Medium: 1.4, Low: 1 };

export default function ComplaintHeatMap({ complaints = [], height = '460px' }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [ready, setReady] = useState(false);

  const plotted = useMemo(
    () => complaints.filter((c) => c?.coords
      && typeof c.coords.latitude === 'number'
      && typeof c.coords.longitude === 'number'),
    [complaints],
  );

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;
    const map = L.map(containerRef.current, { scrollWheelZoom: false })
      .setView([20.5937, 78.9629], 4);

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

    for (const c of plotted) {
      const w = WEIGHT[c.severity] || 1;
      // Two stacked circles: a broad soft halo plus a tighter core. Where
      // complaints overlap the halos compound, which is what produces the
      // hot spots.
      L.circleMarker([c.coords.latitude, c.coords.longitude], {
        radius: 22 * w, stroke: false, fillColor: RAMP[1], fillOpacity: 0.10,
      }).addTo(layer);
      L.circleMarker([c.coords.latitude, c.coords.longitude], {
        radius: 7 * w,
        stroke: false,
        fillColor: RAMP[Math.min(RAMP.length - 1, Math.round(w) )],
        fillOpacity: 0.5,
      })
        .bindPopup(
          `<strong style="font-size:13px">${c.severity}</strong><br/>` +
          `<span style="font-size:12px;color:#5c6a78">${c.category} · ${c.status}</span>`,
        )
        .addTo(layer);
    }

    map.fitBounds(
      L.latLngBounds(plotted.map((c) => [c.coords.latitude, c.coords.longitude])),
      { padding: [40, 40], maxZoom: 15 },
    );
  }, [plotted]);

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
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
            Intensity by severity
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ink-faint">Low</span>
            <span className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${RAMP.join(',')})` }} />
            <span className="text-[10px] text-ink-faint">Critical</span>
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

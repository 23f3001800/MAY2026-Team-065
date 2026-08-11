// Complaint map — OpenStreetMap tiles via Leaflet.
//
// Plain Leaflet rather than react-leaflet: one dependency instead of two, and
// no coupling to a wrapper's React-version support. The imperative lifecycle is
// small enough to manage directly.
//
// Markers are divIcons built from our own markup, not Leaflet's default PNG.
// That sidesteps the well-known broken-marker-path problem under bundlers, and
// lets a pin carry severity by colour — which is the point of plotting these on
// a map at all.
import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { SEVERITY_COLOR, pinIcon, escapeHtml, plottable } from './pin';

/**
 * @param {Array}  complaints  UI-shaped complaints; those without `coords` are skipped
 * @param {string} [height]    CSS height for the map container
 * @param {Function} [onSelect] called with a complaint when its popup link is clicked
 * @param {boolean} [showMe]   plot the browser's current position too
 */
export default function ComplaintMap({ complaints = [], height = '420px', onSelect, showMe = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  const plotted = useMemo(() => plottable(complaints), [complaints]);

  // Create the map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return undefined;

    const map = L.map(containerRef.current, {
      // Scroll-wheel zoom off by default: the map often sits mid-page, and
      // hijacking the wheel traps someone trying to scroll past it.
      scrollWheelZoom: false,
      zoomControl: true,
    }).setView([20.5937, 78.9629], 4); // India, until real points arrive

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Redraw markers whenever the set changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    plotted.forEach((c) => {
      const resolved = c.status === 'Resolved' || c.status === 'Closed';
      const marker = L.marker([c.coords.latitude, c.coords.longitude], {
        icon: pinIcon(c.severity, resolved),
        title: c.issue,
      });

      marker.bindPopup(`
        <div style="min-width:180px">
          <div style="font-weight:600;font-size:13px;color:#0f172a;line-height:1.35">${escapeHtml(c.issue)}</div>
          <div style="font-family:ui-monospace,monospace;font-size:11px;color:#94a3b8;margin-top:2px">${escapeHtml(c.id)}</div>
          <div style="font-size:12px;color:#475569;margin-top:6px">${escapeHtml(c.status)} · ${escapeHtml(c.severity)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${escapeHtml(c.location || '')}</div>
          <a href="/complaints/${encodeURIComponent(c.id)}" data-complaint="${escapeHtml(c.id)}"
             style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#10b981;text-decoration:none">
             Open complaint →</a>
        </div>`);

      // Let the host page intercept navigation rather than doing a full reload,
      // which would throw away the SPA's state.
      marker.on('popupopen', (e) => {
        const link = e.popup.getElement()?.querySelector('a[data-complaint]');
        if (link && onSelect) {
          link.addEventListener('click', (ev) => {
            ev.preventDefault();
            onSelect(c);
          });
        }
      });

      layer.addLayer(marker);
    });

    if (plotted.length === 1) {
      map.setView([plotted[0].coords.latitude, plotted[0].coords.longitude], 16);
    } else if (plotted.length > 1) {
      map.fitBounds(
        L.latLngBounds(plotted.map((c) => [c.coords.latitude, c.coords.longitude])),
        { padding: [36, 36], maxZoom: 16 },
      );
    }
  }, [plotted, onSelect]);

  // Optional "you are here" dot.
  useEffect(() => {
    if (!showMe || !mapRef.current || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const map = mapRef.current;
      if (!map) return;
      L.circleMarker([pos.coords.latitude, pos.coords.longitude], {
        radius: 7, color: '#2563eb', weight: 3, fillColor: '#3b82f6', fillOpacity: 0.9,
      }).bindPopup('You are here').addTo(map);
    }, () => {});
  }, [showMe]);

  // Leaflet measures the container on creation. If the map is inside a panel
  // that was hidden or has just resized, that measurement is stale and tiles
  // render in the wrong place until invalidated.
  useEffect(() => {
    const onResize = () => mapRef.current?.invalidateSize();
    window.addEventListener('resize', onResize);
    const t = setTimeout(onResize, 200);
    return () => { window.removeEventListener('resize', onResize); clearTimeout(t); };
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-line shadow-sm">
      <div ref={containerRef} style={{ height }} className="w-full z-0" />

      {plotted.length === 0 && (
        <div className="absolute inset-0 bg-white/85 flex items-center justify-center text-center px-6 pointer-events-none">
          <p className="text-[13px] text-ink-muted max-w-xs">
            Nothing to plot — none of these complaints have coordinates recorded.
          </p>
        </div>
      )}

      {/* Legend. Without it the pin colours are decoration. */}
      {plotted.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur rounded-lg border border-line shadow-sm px-2.5 py-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            {Object.entries(SEVERITY_COLOR).map(([label, color]) => (
              <span key={label} className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-body">
                <span className="w-2.5 h-2.5 rounded-full border border-white" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

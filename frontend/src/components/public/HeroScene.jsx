// The landing page's backdrop: a city with a park in it.
//
// Inline SVG rather than an image — no extra request, no layout shift, and it
// scales to any viewport without a set of exported sizes to keep in sync.
//
// Composition is deliberate. The skyline, trees and bench sit in the RIGHT
// third and the LEFT corners carry only leaf sprigs, because the hero's copy
// and the live complaint card occupy the middle. Everything is held at low
// contrast: this is the ground the page stands on, not something to read.
import React from 'react';

function Tree({ x, y, s = 1, canopy = '#bfdfc9', trunk = '#c2cfc3' }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-3" y="-26" width="6" height="28" rx="3" fill={trunk} />
      <circle cx="0" cy="-42" r="20" fill={canopy} />
      <circle cx="-15" cy="-32" r="14" fill={canopy} />
      <circle cx="15" cy="-33" r="15" fill={canopy} />
    </g>
  );
}

function LampPost({ x, y, h = 140, color = '#a9bdb0' }) {
  return (
    <g transform={`translate(${x} ${y})`} fill={color}>
      <rect x="-2.5" y={-h} width="5" height={h} rx="2.5" />
      <rect x="-11" y="-6" width="22" height="7" rx="3.5" />
      <rect x="-9" y={-h - 12} width="18" height="14" rx="5" />
    </g>
  );
}

function Bench({ x, y, color = '#b3c7ba' }) {
  return (
    <g transform={`translate(${x} ${y})`} fill={color}>
      <rect x="0" y="0" width="72" height="6" rx="3" />
      <rect x="0" y="-11" width="72" height="5" rx="2.5" />
      <rect x="4" y="6" width="5" height="14" rx="2.5" />
      <rect x="63" y="6" width="5" height="14" rx="2.5" />
    </g>
  );
}

function Birds({ x, y, color = '#a6bdb0' }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round">
      <path d="M0 0c5-6 10-6 15 0" />
      <path d="M34 -20c5-6 10-6 15 0" />
      <path d="M18 26c4-5 8-5 12 0" />
    </g>
  );
}

/**
 * A leafy branch for a corner. `flip` mirrors it so the same drawing can hang
 * from the left or the right without a second set of coordinates.
 */
export function LeafSprig({ className = '', flip = false, tone = '#bfdfc9' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 160"
      className={className}
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      fill="none"
    >
      <g stroke={tone} strokeWidth="3" strokeLinecap="round">
        <path d="M-6 6C26 30 58 52 96 66" />
        <path d="M18 -8C34 26 46 60 52 100" />
      </g>
      <g fill={tone}>
        {/* Leaves along the lower branch */}
        <ellipse cx="26" cy="20" rx="17" ry="9" transform="rotate(24 26 20)" />
        <ellipse cx="52" cy="36" rx="18" ry="9.5" transform="rotate(20 52 36)" />
        <ellipse cx="80" cy="54" rx="16" ry="9" transform="rotate(26 80 54)" />
        <ellipse cx="40" cy="4" rx="15" ry="8" transform="rotate(-16 40 4)" />
        {/* Leaves along the descending branch */}
        <ellipse cx="30" cy="34" rx="14" ry="8" transform="rotate(72 30 34)" />
        <ellipse cx="40" cy="62" rx="15" ry="8.5" transform="rotate(80 40 62)" />
        <ellipse cx="48" cy="92" rx="13" ry="7.5" transform="rotate(86 48 92)" />
      </g>
    </svg>
  );
}

/** Full-bleed scene sitting behind the hero. */
export default function HeroScene({ className = '' }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none overflow-hidden ${className}`}>
      <div className="absolute inset-0 bg-[linear-gradient(175deg,#fbfdfb_0%,#f1f9f4_46%,#e6f3ea_100%)]" />

      <svg
        viewBox="0 0 1440 520"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
      >
        {/* Clouds */}
        <g fill="#ffffff" opacity="0.75">
          <ellipse cx="1052" cy="74" rx="86" ry="25" />
          <ellipse cx="1122" cy="84" rx="56" ry="20" />
          <ellipse cx="286" cy="60" rx="70" ry="22" />
        </g>

        <Birds x={1244} y={116} />
        <Birds x={880} y={92} color="#b3c8bc" />

        {/* Far skyline, right side only — the copy owns the left. */}
        <g fill="#d8ebde">
          <rect x="1096" y="252" width="76" height="168" rx="4" />
          <rect x="1186" y="196" width="58" height="224" rx="4" />
          <rect x="1258" y="278" width="84" height="142" rx="4" />
          <rect x="1356" y="222" width="72" height="198" rx="4" />
          <rect x="1010" y="300" width="62" height="120" rx="4" />
        </g>

        {/* Near buildings */}
        <g fill="#c8e2d1">
          <rect x="1160" y="300" width="40" height="120" rx="4" />
          <rect x="1330" y="290" width="44" height="130" rx="4" />
        </g>

        {/* Windows */}
        <g fill="#eef8f1">
          {[0, 1, 2, 3, 4].map((r) => (
            <React.Fragment key={r}>
              <rect x="1198" y={216 + r * 34} width="12" height="16" rx="2" />
              <rect x="1218" y={216 + r * 34} width="12" height="16" rx="2" />
              <rect x="1370" y={242 + r * 34} width="12" height="16" rx="2" />
              <rect x="1392" y={242 + r * 34} width="12" height="16" rx="2" />
            </React.Fragment>
          ))}
          {[0, 1, 2].map((r) => (
            <React.Fragment key={`b-${r}`}>
              <rect x="1110" y={272 + r * 36} width="14" height="18" rx="2" />
              <rect x="1136" y={272 + r * 36} width="14" height="18" rx="2" />
              <rect x="1274" y={300 + r * 36} width="14" height="18" rx="2" />
            </React.Fragment>
          ))}
        </g>

        {/* Ground */}
        <rect x="0" y="420" width="1440" height="100" fill="#e3f1e7" />
        <rect x="0" y="420" width="1440" height="6" fill="#d2e8d9" />
        <ellipse cx="1120" cy="482" rx="420" ry="28" fill="#ecf6ef" />

        <LampPost x={1288} y={422} h={148} />
        <Bench x={1140} y={404} />

        <Tree x={956} y={422} s={1.2} canopy="#c9e5d1" />
        <Tree x={1010} y={422} s={0.92} canopy="#b6dbc2" />
        <Tree x={1416} y={422} s={1.3} canopy="#c4e2ce" />
        <Tree x={1064} y={422} s={0.8} canopy="#cbe7d3" />
      </svg>

      {/* Corner foliage. Same drawing, three placements. */}
      <LeafSprig className="absolute -left-6 -top-8 w-[240px] h-[190px] opacity-90" tone="#bfdfc9" />
      <LeafSprig className="absolute -left-10 bottom-2 w-[200px] h-[160px] opacity-70" tone="#c8e5d1" />
      <LeafSprig className="absolute right-0 -top-10 w-[180px] h-[145px] opacity-45" tone="#cbe7d3" flip />
    </div>
  );
}

/**
 * Portrait-ish slice of the same city, sized for the foot of the dashboard
 * sidebar. Shares the scene primitives above so the signed-in shell and the
 * landing page are recognisably one place rather than two products.
 */
export function ParkPanel({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 268 210"
      preserveAspectRatio="xMidYMax slice"
      className={className}
    >
      <rect width="268" height="210" fill="#f4faf6" />

      <g fill="#ffffff" opacity="0.9">
        <ellipse cx="70" cy="34" rx="30" ry="11" />
        <ellipse cx="94" cy="28" rx="19" ry="8" />
        <ellipse cx="206" cy="26" rx="26" ry="10" />
      </g>

      {/* Skyline, held very low in contrast — this is wallpaper, not content. */}
      <g fill="#e2f0e7">
        <rect x="10" y="74" width="30" height="86" rx="3" />
        <rect x="46" y="52" width="24" height="108" rx="3" />
        <rect x="78" y="88" width="34" height="72" rx="3" />
        <rect x="168" y="66" width="28" height="94" rx="3" />
        <rect x="202" y="90" width="38" height="70" rx="3" />
        <rect x="246" y="58" width="24" height="102" rx="3" />
      </g>
      <g fill="#f2f9f5">
        {[0, 1, 2, 3].map((r) => (
          <React.Fragment key={r}>
            <rect x="51" y={62 + r * 20} width="6" height="9" rx="1" />
            <rect x="61" y={62 + r * 20} width="6" height="9" rx="1" />
            <rect x="251" y={68 + r * 20} width="6" height="9" rx="1" />
          </React.Fragment>
        ))}
      </g>

      {/* Ground */}
      <rect x="0" y="158" width="268" height="52" fill="#e0efe5" />
      <rect x="0" y="158" width="268" height="4" fill="#cee3d6" />
      <ellipse cx="134" cy="190" rx="112" ry="14" fill="#ebf5ef" />

      <LampPost x={222} y={160} h={64} color="#9db3a6" />

      <Tree x={22} y={160} s={0.7} canopy="#a6d3b5" trunk="#b6c8b9" />
      <Tree x={58} y={160} s={0.56} canopy="#93c8a4" trunk="#b6c8b9" />
      <Tree x={96} y={160} s={0.66} canopy="#b0dabd" trunk="#b6c8b9" />
      <Tree x={140} y={160} s={0.5} canopy="#9ccfac" trunk="#b6c8b9" />
      <Tree x={176} y={160} s={0.62} canopy="#a9d6b7" trunk="#b6c8b9" />
      <Tree x={256} y={160} s={0.58} canopy="#9ccfac" trunk="#b6c8b9" />
    </svg>
  );
}

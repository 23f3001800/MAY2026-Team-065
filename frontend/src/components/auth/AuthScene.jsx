// Illustrations for the auth screens. All inline SVG — no image requests, no
// layout shift, and they scale cleanly to any viewport.
//
// The three pieces are deliberately different in weight:
//   AuthBackdrop — page background, very low contrast so the card stays the
//                  focal point. Content sits in the outer thirds; the middle is
//                  kept empty because the card floats there.
//   CityLineArt  — white line drawing for the dark green pane on Login.
//   ParkScene    — soft colour scene for the mint pane on Register.
import React from 'react';

// A tree: trunk plus overlapping canopy blobs. Colours are passed in so the
// same shape can sit in the near or far plane.
function Tree({ x, y, s = 1, canopy = '#bcd9c3', trunk = '#c3cfc4' }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-3" y="-26" width="6" height="28" rx="3" fill={trunk} />
      <circle cx="0" cy="-42" r="20" fill={canopy} />
      <circle cx="-15" cy="-32" r="14" fill={canopy} />
      <circle cx="15" cy="-33" r="15" fill={canopy} />
    </g>
  );
}

function LampPost({ x, y, h = 140, color = '#a9bcc4' }) {
  return (
    <g transform={`translate(${x} ${y})`} fill={color}>
      <rect x="-2.5" y={-h} width="5" height={h} rx="2.5" />
      <rect x="-11" y="-6" width="22" height="7" rx="3.5" />
      <rect x="-9" y={-h - 12} width="18" height="14" rx="5" />
    </g>
  );
}

function Bench({ x, y, color = '#b9c8c0' }) {
  return (
    <g transform={`translate(${x} ${y})`} fill={color}>
      <rect x="0" y="0" width="72" height="6" rx="3" />
      <rect x="0" y="-11" width="72" height="5" rx="2.5" />
      <rect x="4" y="6" width="5" height="14" rx="2.5" />
      <rect x="63" y="6" width="5" height="14" rx="2.5" />
    </g>
  );
}

function Birds({ x, y, color = '#9fb4b0' }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={color} strokeWidth="2.4" fill="none" strokeLinecap="round">
      <path d="M0 0c5-6 10-6 15 0" />
      <path d="M34 -20c5-6 10-6 15 0" />
      <path d="M18 26c4-5 8-5 12 0" />
    </g>
  );
}

// Full-viewport background. Fixed and behind everything, matching how the app's
// other background layer behaves.
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden bg-[#eef4f0]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#fafcfb_0%,#f1f7f3_52%,#e5f0e9_100%)]" />

      {/* Soft discs — the wash that keeps the right-hand side from going flat */}
      <div className="absolute -right-40 -top-24 h-[480px] w-[480px] rounded-full bg-[#dcece3]/60" />
      <div className="absolute -left-32 top-1/3 h-[360px] w-[360px] rounded-full bg-[#e3eff5]/50" />

      <svg
        viewBox="0 0 1440 460"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-[54vh] min-h-[330px] w-full"
      >
        <g fill="#ffffff" opacity="0.7">
          <ellipse cx="215" cy="66" rx="82" ry="26" />
          <ellipse cx="288" cy="58" rx="54" ry="21" />
          <ellipse cx="1128" cy="48" rx="90" ry="26" />
          <ellipse cx="1198" cy="58" rx="58" ry="20" />
        </g>

        <Birds x={975} y={104} />
        <Birds x={352} y={132} color="#a8bcb8" />

        {/* Far skyline */}
        <g fill="#dbe7ef">
          <rect x="52" y="212" width="72" height="148" rx="4" />
          <rect x="138" y="150" width="52" height="210" rx="4" />
          <rect x="200" y="240" width="82" height="120" rx="4" />
          <rect x="300" y="176" width="60" height="184" rx="4" />
          <rect x="1178" y="190" width="76" height="170" rx="4" />
          <rect x="1266" y="136" width="56" height="224" rx="4" />
          <rect x="1332" y="220" width="86" height="140" rx="4" />
        </g>

        {/* Near buildings */}
        <g fill="#cbdeea">
          <rect x="96" y="246" width="56" height="114" rx="4" />
          <rect x="252" y="266" width="46" height="94" rx="4" />
          <rect x="1148" y="256" width="46" height="104" rx="4" />
          <rect x="1308" y="262" width="62" height="98" rx="4" />
        </g>

        {/* Windows */}
        <g fill="#eef5f9">
          {[0, 1, 2, 3, 4].map((r) => (
            <React.Fragment key={r}>
              <rect x="150" y={170 + r * 34} width="12" height="16" rx="2" />
              <rect x="168" y={170 + r * 34} width="12" height="16" rx="2" />
              <rect x="1278" y={158 + r * 34} width="12" height="16" rx="2" />
              <rect x="1296" y={158 + r * 34} width="12" height="16" rx="2" />
            </React.Fragment>
          ))}
          {[0, 1, 2].map((r) => (
            <React.Fragment key={`b-${r}`}>
              <rect x="314" y={196 + r * 36} width="14" height="18" rx="2" />
              <rect x="334" y={196 + r * 36} width="14" height="18" rx="2" />
              <rect x="1192" y={210 + r * 36} width="14" height="18" rx="2" />
            </React.Fragment>
          ))}
        </g>

        {/* Ground */}
        <rect x="0" y="360" width="1440" height="100" fill="#e5efe8" />
        <rect x="0" y="360" width="1440" height="7" fill="#d5e6da" />
        <ellipse cx="720" cy="424" rx="520" ry="30" fill="#edf4ef" />

        <LampPost x={548} y={362} h={132} />
        <LampPost x={906} y={362} h={132} />
        <Bench x={618} y={344} />
        <Bench x={782} y={344} />

        <Tree x={396} y={362} s={1.25} canopy="#c6e0cd" />
        <Tree x={452} y={362} s={0.95} canopy="#b4d4bd" />
        <Tree x={496} y={362} s={1.1} canopy="#cae3d0" />
        <Tree x={960} y={362} s={1.15} canopy="#c2ddca" />
        <Tree x={1014} y={362} s={0.9} canopy="#b0d2ba" />
        <Tree x={1062} y={362} s={1.3} canopy="#c9e2cf" />
        <Tree x={64} y={362} s={1.35} canopy="#c4dfcb" />
        <Tree x={1390} y={362} s={1.2} canopy="#c4dfcb" />
      </svg>
    </div>
  );
}

// White line drawing for Login's dark green pane.
export function CityLineArt({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 116"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Wi-Fi arcs above the skyline — the "connected city" note */}
      <path d="M126 20a16 16 0 0 1 22 0" opacity="0.85" />
      <path d="M131 27a9 9 0 0 1 12 0" opacity="0.85" />
      <circle cx="137" cy="34" r="1.8" fill="currentColor" stroke="none" />

      {/* Buildings */}
      <rect x="86" y="34" width="30" height="62" rx="3" />
      <path d="M93 44h5M105 44h5M93 56h5M105 56h5M93 68h5M105 68h5" strokeWidth="1.6" opacity="0.75" />
      <rect x="120" y="50" width="24" height="46" rx="3" />
      <path d="M126 60h5M134 60h5M126 72h5M134 72h5" strokeWidth="1.6" opacity="0.75" />
      <rect x="148" y="42" width="20" height="54" rx="3" />
      <path d="M154 52h6M154 64h6M154 76h6" strokeWidth="1.6" opacity="0.75" />

      {/* Trees */}
      <path d="M64 96V74" />
      <circle cx="64" cy="62" r="13" />
      <path d="M188 96V70" />
      <path d="M188 78 178 66M188 78l10-12M188 88l-8-9M188 88l8-9" strokeWidth="1.6" />

      {/* Bench + lamp */}
      <path d="M104 96h28M104 90h28M108 96v6M128 96v6" strokeWidth="1.6" opacity="0.8" />
      <path d="M212 96V58" />
      <rect x="206" y="48" width="12" height="10" rx="4" />

      {/* Ground */}
      <path d="M28 96h204" opacity="0.5" />
    </svg>
  );
}

// Soft colour park scene for Register's mint pane.
export function ParkScene({ className = '' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 320 200" className={className} preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="200" fill="#f4faf6" />

      <g fill="#ffffff" opacity="0.9">
        <ellipse cx="72" cy="42" rx="30" ry="11" />
        <ellipse cx="96" cy="36" rx="20" ry="9" />
        <ellipse cx="246" cy="30" rx="26" ry="10" />
      </g>

      <Birds x={150} y={34} color="#a9c2bc" />

      <g fill="#dbe9f2">
        <rect x="18" y="78" width="34" height="76" rx="3" />
        <rect x="58" y="56" width="26" height="98" rx="3" />
        <rect x="92" y="88" width="38" height="66" rx="3" />
        <rect x="200" y="70" width="30" height="84" rx="3" />
        <rect x="236" y="94" width="42" height="60" rx="3" />
        <rect x="284" y="62" width="26" height="92" rx="3" />
      </g>
      <g fill="#f0f7fb">
        {[0, 1, 2, 3].map((r) => (
          <React.Fragment key={r}>
            <rect x="64" y={66 + r * 20} width="6" height="9" rx="1" />
            <rect x="74" y={66 + r * 20} width="6" height="9" rx="1" />
            <rect x="290" y={72 + r * 20} width="6" height="9" rx="1" />
          </React.Fragment>
        ))}
      </g>

      <rect x="0" y="152" width="320" height="48" fill="#e2efe6" />
      <rect x="0" y="152" width="320" height="4" fill="#cfe4d7" />
      <ellipse cx="160" cy="182" rx="130" ry="14" fill="#ecf5ef" />

      <LampPost x={262} y={154} h={62} color="#93a9b1" />
      <Bench x={128} y={140} color="#a9bfb4" />

      <Tree x={26} y={154} s={0.66} canopy="#9ecdad" trunk="#b3c4b5" />
      <Tree x={62} y={154} s={0.52} canopy="#8dc29f" trunk="#b3c4b5" />
      <Tree x={104} y={154} s={0.6} canopy="#a8d3b6" trunk="#b3c4b5" />
      <Tree x={200} y={154} s={0.58} canopy="#95c8a5" trunk="#b3c4b5" />
      <Tree x={232} y={154} s={0.48} canopy="#a8d3b6" trunk="#b3c4b5" />
      <Tree x={300} y={154} s={0.64} canopy="#9ecdad" trunk="#b3c4b5" />
    </svg>
  );
}

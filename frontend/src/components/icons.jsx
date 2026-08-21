// Inline SVG icons — zero dependency, tree-shakeable, styled via currentColor.
import React from 'react';

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconUser = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);

export const IconMail = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
);

export const IconLock = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);

export const IconPhone = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
);

export const IconMapPin = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
);

export const IconEye = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
);

export const IconEyeOff = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
);

export const IconShieldCheck = ({ size = 28 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 11 11 13 15 9" /></svg>
);

export const IconChevronRight = ({ size = 16 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
);

export const IconInfo = ({ size = 16 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
);

export const IconUsers = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

export const IconMegaphone = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><path d="m3 11 18-5.5v13L3 13z" /><path d="M11.5 16.9a3 3 0 1 1-5.6-1.9" /></svg>
);

export const IconCheckCircle = ({ size = 18 }) => (
  <svg {...base} width={size} height={size} viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="9" /><polyline points="8.5 12 11 14.5 15.5 9.5" /></svg>
);

export const IconSparkle = ({ size = 14 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5 14.1 9.1 20.7 11.2 14.1 13.3 12 19.9 9.9 13.3 3.3 11.2 9.9 9.1z" /></svg>
);

// The wordmark shield. Filled rather than stroked so it holds its weight at the
// small size the auth top bar uses.
export const IconShieldMark = ({ size = 30 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2.2 4.4 5v6.5c0 5.2 3.4 8.5 7.6 10.3 4.2-1.8 7.6-5.1 7.6-10.3V5L12 2.2Z" fill="#0f7f43" />
    <path d="m8.5 11.9 2.4 2.4 4.6-4.8" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

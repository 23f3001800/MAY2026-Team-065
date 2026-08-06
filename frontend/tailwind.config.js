/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        'bg-dark': '#090d16',
        'bg-card': 'rgba(15, 23, 42, 0.3)',
        'border-light': 'rgba(255, 255, 255, 0.07)',
        primary: '#10b981',
        'primary-glow': 'rgba(16, 185, 129, 0.35)',
        secondary: '#3b82f6',
        'secondary-glow': 'rgba(59, 130, 246, 0.35)',
        'text-primary': '#f8fafc',
        'text-secondary': '#94a3b8',
        'text-muted': '#64748b',
        error: '#ef4444',
        success: '#10b981',

        // Semantic tokens for the signed-in (light) app. The auth screens keep
        // the dark palette above; everything behind login should reach for
        // these instead of raw slate-* so a future theme change is one edit.
        surface: {
          DEFAULT: '#ffffff',
          sunken: '#f6f8fa',   // page background behind cards
          raised: '#ffffff',
          hover: '#f8fafc',
        },
        line: {
          DEFAULT: '#e6eaf0',  // slightly warmer than slate-200; less harsh on white
          strong: '#d3dae3',
        },
        ink: {
          DEFAULT: '#0f172a',  // headings
          body: '#334155',     // body copy
          muted: '#64748b',    // secondary
          faint: '#94a3b8',    // timestamps, meta
        },
      },
      fontFamily: {
        primary: ["'Plus Jakarta Sans'", '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ["'Outfit'", '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'card-appear': {
          '0%': { opacity: '0', transform: 'translateY(40px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'card-appear-fast': {
          '0%': { opacity: '0', transform: 'translateY(40px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in-alert': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'spin': {
          to: { transform: 'rotate(360deg)' },
        },
        'pulse-dot': {
          '0%': { opacity: '0.3', transform: 'scale(0.9)' },
          '50%': { opacity: '1', transform: 'scale(1.1)' },
          '100%': { opacity: '0.3', transform: 'scale(0.9)' },
        },
        'badge-pulse': {
          '0%': { boxShadow: '0 0 0 0 rgba(16,185,129,0.4)' },
          '70%': { boxShadow: '0 0 0 15px rgba(16,185,129,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(16,185,129,0)' },
        },
        'float-blob-1': {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(-80px,60px) scale(1.1)' },
          '100%': { transform: 'translate(-40px,120px) scale(0.9)' },
        },
        'float-blob-2': {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(100px,-80px) scale(0.85)' },
          '100%': { transform: 'translate(50px,-150px) scale(1.05)' },
        },
        'float-blob-3': {
          '0%': { transform: 'translate(0,0) scale(1)' },
          '100%': { transform: 'translate(120px,80px) scale(1.2)' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },

        // Skeleton shimmer. Animates background-position rather than a moving
        // child element, so it costs one composited layer instead of a reflow.
        shimmer: {
          '100%': { backgroundPosition: '-200% 0' },
        },
        // Panels and rows entering. Short and small — a long slide reads as lag.
        'rise-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Right-hand drawer (officer/worker task panels).
        'drawer-in': {
          '0%': { transform: 'translateX(24px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'overlay-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        // Toasts.
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(-10px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        // Count-up underline / progress fill.
        'grow-x': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
      },
      animation: {
        'card-appear': 'card-appear 0.8s cubic-bezier(0.16,1,0.3,1)',
        'card-appear-fast': 'card-appear-fast 0.6s cubic-bezier(0.16,1,0.3,1)',
        'slide-in-alert': 'slide-in-alert 0.3s cubic-bezier(0.16,1,0.3,1)',
        'spin-slow': 'spin 0.8s linear infinite',
        'pulse-dot': 'pulse-dot 1.5s infinite',
        'badge-pulse': 'badge-pulse 2s infinite',
        'float-blob-1': 'float-blob-1 25s infinite alternate ease-in-out',
        'float-blob-2': 'float-blob-2 30s infinite alternate ease-in-out',
        'float-blob-3': 'float-blob-3 20s infinite alternate ease-in-out',
        'fade-in': 'fade-in 0.5s ease',

        shimmer: 'shimmer 1.6s linear infinite',
        'rise-in': 'rise-in 260ms cubic-bezier(0.16,1,0.3,1) both',
        'scale-in': 'scale-in 180ms cubic-bezier(0.16,1,0.3,1) both',
        'drawer-in': 'drawer-in 260ms cubic-bezier(0.16,1,0.3,1) both',
        'overlay-in': 'overlay-in 200ms ease both',
        'toast-in': 'toast-in 240ms cubic-bezier(0.16,1,0.3,1) both',
        'grow-x': 'grow-x 600ms cubic-bezier(0.16,1,0.3,1) both',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4,0,0.2,1)',
      },
      boxShadow: {
        // Auth-screen (dark) shadows — emerald glow, unchanged.
        'card': '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(16,185,129,0.05)',
        'input-focus': '0 0 14px rgba(16,185,129,0.15)',
        'btn-hover': '0 12px 24px -8px rgba(16,185,129,0.6)',
        'btn': '0 10px 20px -10px rgba(16,185,129,0.4)',
        'logo': '0 0 20px rgba(16,185,129,0.4)',
        'feed': '0 10px 30px rgba(0,0,0,0.3)',
        'badge': '0 0 20px rgba(16,185,129,0.2)',

        // Neutral ramp for the light app. These deliberately OVERRIDE Tailwind's
        // defaults: the whole dashboard already uses `shadow-sm`, so redefining
        // it lifts every existing card at once without editing 33 pages.
        // Two layers each — a tight contact shadow plus a soft ambient one — is
        // what stops a card looking like a flat outlined box.
        sm: '0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.06)',
        DEFAULT: '0 1px 3px rgba(15,23,42,0.05), 0 4px 12px -2px rgba(15,23,42,0.06)',
        md: '0 2px 4px rgba(15,23,42,0.04), 0 8px 20px -4px rgba(15,23,42,0.08)',
        lg: '0 4px 8px rgba(15,23,42,0.04), 0 16px 32px -8px rgba(15,23,42,0.10)',
        xl: '0 8px 16px rgba(15,23,42,0.05), 0 28px 56px -12px rgba(15,23,42,0.14)',
        // Focus ring used by the .focus-ring utility.
        focus: '0 0 0 3px rgba(16,185,129,0.18)',
      },
      transitionDuration: {
        fast: '140ms',
        DEFAULT: '200ms',
        slow: '320ms',
      },
      backdropBlur: {
        '20px': '20px',
      },
    },
  },
  plugins: [],
};

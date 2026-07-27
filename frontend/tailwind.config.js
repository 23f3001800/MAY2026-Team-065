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
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4,0,0.2,1)',
      },
      boxShadow: {
        'card': '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(16,185,129,0.05)',
        'input-focus': '0 0 14px rgba(16,185,129,0.15)',
        'btn-hover': '0 12px 24px -8px rgba(16,185,129,0.6)',
        'btn': '0 10px 20px -10px rgba(16,185,129,0.4)',
        'logo': '0 0 20px rgba(16,185,129,0.4)',
        'feed': '0 10px 30px rgba(0,0,0,0.3)',
        'badge': '0 0 20px rgba(16,185,129,0.2)',
      },
      backdropBlur: {
        '20px': '20px',
      },
    },
  },
  plugins: [],
};

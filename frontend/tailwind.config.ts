import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        surface2: 'var(--color-surface-2)',
        border: 'var(--color-border)',
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'primary-glow': 'var(--color-primary-glow)',
        secondary: 'var(--color-secondary)',
        top: 'var(--color-top-badge)',
        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        success: 'var(--color-success)',
        danger: 'var(--color-danger)',
        warning: 'var(--color-warning)',
      },
      fontFamily: {
        display: ['var(--font-unbounded)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
        mono: ['UAH Glyph Fix', 'var(--font-jetbrains)', 'monospace'],
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        primary: 'var(--shadow-primary)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-300px 0' },
          '100%': { backgroundPosition: '300px 0' },
        },
        pulseSlot: {
          '0%': { boxShadow: '0 0 0 0 rgba(94,86,168,0.45)' },
          '100%': { boxShadow: '0 0 0 10px rgba(94,86,168,0)' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        floatOrb: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-40px) scale(1.05)' },
          '66%': { transform: 'translate(-20px,20px) scale(0.95)' },
        },
        navRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(94,86,168,0.35)', transform: 'scale(0.85)' },
          '60%': { boxShadow: '0 0 0 9px rgba(94,86,168,0)', transform: 'scale(1)' },
          '100%': { boxShadow: '0 0 0 9px rgba(94,86,168,0)', transform: 'scale(1)' },
        },
        navPop: {
          '0%': { transform: 'scale(0.7)' },
          '55%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite linear',
        pulseSlot: 'pulseSlot 1s ease-out infinite',
        fadeInUp: 'fadeInUp 0.6s cubic-bezier(0.4,0,0.2,1) forwards',
        floatOrb: 'floatOrb 10s ease-in-out infinite',
        floatOrbReverse: 'floatOrb 14s ease-in-out infinite reverse',
        navRing: 'navRing 0.5s cubic-bezier(0.4,0,0.2,1) forwards',
        navPop: 'navPop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;

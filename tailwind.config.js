/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // 'class' lets the Settings theme toggle override the system preference.
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        neon: ['Monoton', '"Space Grotesk"', 'cursive'],
      },
      colors: {
        neon: {
          cyan: '#00f0ff',
          pink: '#ff2bd6',
          lime: '#39ff14',
          yellow: '#ffe600',
          violet: '#b026ff',
          orange: '#ff8a00',
        },
        night: {
          950: '#05010f',
          900: '#0b0420',
          800: '#140a33',
          700: '#22124f',
        },
      },
      boxShadow: {
        'neon-cyan': '0 0 10px rgba(0,240,255,.3)',
        'neon-pink': '0 0 12px rgba(255,43,214,.3)',
        'neon-lime': '0 0 10px rgba(57,255,20,.3)',
        glass: '0 8px 32px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06)',
      },
      keyframes: {
        flicker: {
          '0%, 19%, 21%, 23%, 25%, 54%, 56%, 100%': { opacity: '1' },
          '20%, 24%, 55%': { opacity: '0.35' },
        },
        'flame-dance': {
          '0%, 100%': { transform: 'scale(1) rotate(-3deg)' },
          '50%': { transform: 'scale(1.15) rotate(3deg)' },
        },
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'blob-drift': {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(8vw,-6vh) scale(1.15)' },
          '66%': { transform: 'translate(-6vw,5vh) scale(0.9)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        'glow-pulse': {
          '0%, 100%': { filter: 'drop-shadow(0 0 4px var(--glow)) drop-shadow(0 0 10px var(--glow))' },
          '50%': { filter: 'drop-shadow(0 0 8px var(--glow)) drop-shadow(0 0 22px var(--glow))' },
        },
      },
      animation: {
        flicker: 'flicker 3s linear infinite',
        'flame-dance': 'flame-dance 0.9s ease-in-out infinite',
        'gradient-pan': 'gradient-pan 6s ease infinite',
        'blob-drift': 'blob-drift 18s ease-in-out infinite',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

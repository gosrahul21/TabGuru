/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,tsx,html}',
    './index.html',
  ],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'system-ui', 'sans-serif'],
        inter:  ['Inter',  'system-ui', 'sans-serif'],
      },
      colors: {
        // TabGuru brand palette
        guru: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
      },
      animation: {
        'float':       'float 4s ease-in-out infinite',
        'pulse-slow':  'pulse-slow 6s ease-in-out infinite',
        'pulse-urgent': 'pulse-urgent 1s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%':      { opacity: '1',   transform: 'scale(1.05)' },
        },
        'pulse-urgent': {
          '0%, 100%': { color: 'rgb(251 146 60)' },
          '50%':      { color: 'rgb(239 68 68)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

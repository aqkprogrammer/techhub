import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        blob: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(18%, -12%) scale(1.1)' },
          '66%': { transform: 'translate(-14%, 14%) scale(0.9)' },
        },
      },
      animation: {
        blob: 'blob 10s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;

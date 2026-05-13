/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#080810',
          1: 'rgba(255,255,255,0.03)',
          2: 'rgba(255,255,255,0.06)',
          3: 'rgba(255,255,255,0.09)',
        },
        indigo: {
          DEFAULT: '#6366f1',
          dim: 'rgba(99,102,241,0.15)',
          border: 'rgba(99,102,241,0.25)',
          text: '#818cf8',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          2: 'rgba(255,255,255,0.12)',
        },
        text: {
          1: 'rgba(255,255,255,0.88)',
          2: 'rgba(255,255,255,0.5)',
          3: 'rgba(255,255,255,0.25)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

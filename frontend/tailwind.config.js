/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#2563EB',
          bright: '#1D4ED8',
          glow: 'rgba(37, 99, 235, 0.08)',
          dark: '#3B82F6',
          'dark-bright': '#60A5FA',
        },
        oil: {
          diesel: '#EAB308',
          crude: '#B45309',
          bunker: '#0D0D11',
          bilge: '#38BDF8',
        },
        drift: '#D97706',
        vessel: '#EA580C',
        sev: {
          critical: '#DC2626',
          high: '#EA580C',
          medium: '#D97706',
          low: '#16A34A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7ff',
          100: '#e6eeff',
          500: '#4f46e5'
        },
        pds: {
          bg: '#e9efe9',
          panel: '#ffffff',
          muted: '#6b7280',
          sidebar: '#f8faf6',
          accent: '#10b981'
        },
        bgdark: '#0b1020'
      },
      boxShadow: {
        'soft': '0 6px 18px rgba(24,24,27,0.06)',
        'soft-dark': '0 6px 20px rgba(2,6,23,0.6)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui']
      }
    }
  },
  plugins: [],
}

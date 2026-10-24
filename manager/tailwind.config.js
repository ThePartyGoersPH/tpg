/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#1a0000',
          100: '#2d0000',
          200: '#4d0000',
          300: '#800000',
          400: '#aa0000',
          500: '#FF1A1A',
          600: '#CC0000',
          700: '#991500',
          800: '#6b0f00',
          900: '#3d0800',
          950: '#1a0300',
        },
        sidebar: {
          DEFAULT: '#111111',
          hover:   '#161616',
          active:  '#1a0000',
        },
        land: {
          bg:       '#0A0A0A',
          card:     '#111111',
          elevated: '#161616',
          red:      '#CC0000',
          bright:   '#FF1A1A',
          border:   'rgba(255,255,255,0.06)',
        },
      },
      fontFamily: {
        sans:    ['DM Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Bebas Neue', 'Impact', 'sans-serif'],
        body:    ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

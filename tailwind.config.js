/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pdip: {
          red: '#D32F2F',       // Primary PDIP Red
          brightred: '#E53935', // Highlight Red
          darkred: '#8B0000',   // Deep Red
          black: '#111111',     // Rich Black
          metal: '#1E1E1E',     // Accent Metal Grey
          darkgray: '#2A2A2A',  // Secondary background
          gold: '#FFD700',      // Status/Honorary Accent
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

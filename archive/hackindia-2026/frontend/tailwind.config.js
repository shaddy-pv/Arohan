/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          dark: '#0a0a0f',
          panel: '#151520',
          border: '#2a2a40',
          accent: '#00f0ff',
          neon: '#ff003c',
        }
      }
    },
  },
  plugins: [],
}

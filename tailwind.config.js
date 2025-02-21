/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './src/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      colors: {
        azure: {
          light: '#00b4ff',
          DEFAULT: '#0078d4',
          dark: '#005a9e'
        }
      }
    },
  },
  plugins: [],
} 
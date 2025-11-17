/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'empire-dark': '#0a0a0a',
        'empire-darker': '#050505',
        'empire-border': '#1a1a1a',
        'empire-accent': '#10b981',
        'empire-danger': '#ef4444',
        'empire-warning': '#f59e0b',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        // Laptops at 125–150% Windows scaling leave ~650–750px of page height.
        short: { raw: "(max-height: 820px)" },
      },
    },
  },
  plugins: [],
};

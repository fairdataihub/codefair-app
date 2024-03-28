/** @type {import('tailwindcss').Config} */

const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ["./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['"Inter"', ...defaultTheme.fontFamily.sans],
      }
    },
  },
  plugins: [],
}


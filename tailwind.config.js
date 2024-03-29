/** @type {import('tailwindcss').Config} */

const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ["./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['"Inter"', ...defaultTheme.fontFamily.sans],
      },
      keyframes: {
        float: {
          '0%': {
            'box-shadow': '0 5px 15px 0px rgba(0, 0, 0, 0.6)',
            transform: 'translatey(0px)'
          },
          '50%': {
            'box-shadow': '0 25px 15px 0px rgba(0, 0, 0, 0.2)',
            transform: 'translatey(-20px)'
          },
          '100%': {
            'box-shadow': '0 5px 15px 0px rgba(0, 0, 0, 0.6)',
            transform: 'translatey(0px)'
          },
          animation: {
            'float-item': 'float 6s ease-in-out infinite'
          }
        }
      },
    },
  },
  plugins: [],
}


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
            transform: 'translatey(0px)'
          },
          '50%': {
            transform: 'translatey(-20px)'
          },
          '100%': {
            transform: 'translatey(0px)'
          },
        },
        'float-diff': {
          '0%': {
            transform: 'translatey(0px)'
          },
          '50%': {
            transform: 'translatey(-17px)'
          },
          '100%': {
            transform: 'translatey(0px)'
          },
        },
      },
      animation: {
        'float-item': 'float 5s ease-in-out infinite',
        'float-opposite': 'float-diff 4s ease-in-out infinite'
      }
    },
  },
  plugins: [],
}


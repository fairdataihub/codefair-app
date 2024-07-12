/* eslint-disable @typescript-eslint/no-var-requires */
/** @type {import('tailwindcss').Config} */

const defaultTheme = require("tailwindcss/defaultTheme");
const { fontFamily } = require("tailwindcss/defaultTheme");

module.exports = {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
  ],
  plugins: [
    require("tailwindcss-debug-screens"),
    require("@tailwindcss/typography"),
  ],
  theme: {
    extend: {
      animation: {
        "float-item": "float 5s ease-in-out infinite",
        "float-opposite": "float-diff 4s ease-in-out infinite",
      },
      fontFamily: {
        inter: ['Inter', ...defaultTheme.fontFamily.sans],
        onest: ["Onest", ...defaultTheme.fontFamily.sans],
        primary: ["Inter", ...fontFamily.sans],
      },
      keyframes: {
        float: {
          "0%": {
            transform: "translatey(0px)",
          },
          "100%": {
            transform: "translatey(0px)",
          },
          "50%": {
            transform: "translatey(-20px)",
          },
        },
        "float-diff": {
          "0%": {
            transform: "translatey(0px)",
          },
          "100%": {
            transform: "translatey(0px)",
          },
          "50%": {
            transform: "translatey(-17px)",
          },
        },
      },
    },
  },
};

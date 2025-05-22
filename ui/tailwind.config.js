/* eslint-disable @typescript-eslint/no-var-requires */
/** @type {import('tailwindcss').Config} */

import animate from "tailwindcss-animate";
import { setupInspiraUI } from "@inspira-ui/plugins";
const defaultTheme = require("tailwindcss/defaultTheme");
const { fontFamily } = require("tailwindcss/defaultTheme");

module.exports = {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
  ],
  darkMode: "class",
  plugins: [
    require("tailwindcss-debug-screens"),
    require("@tailwindcss/typography"),
    animate,
    setupInspiraUI,
  ],
  prefix: "",
  safelist: ["dark"],
  theme: {
    extend: {
      animation: {
        "float-item": "float 5s ease-in-out infinite",
        "float-opposite": "float-diff 4s ease-in-out infinite",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
      },
      colors: {
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        background: "hsl(var(--background))",
        border: "hsl(var(--border))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        "codefair-grid": "var(--codefair-grid)",
        "codefair-light": "var(--codefair-light)",
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        foreground: "hsl(var(--foreground))",
        input: "hsl(var(--input))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        ring: "hsl(var(--ring))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
      },
      fontFamily: {
        inter: ["Inter", ...defaultTheme.fontFamily.sans],
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

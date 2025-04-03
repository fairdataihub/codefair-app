import { NaiveUiResolver } from "unplugin-vue-components/resolvers";
import Components from "unplugin-vue-components/vite";
import AutoImport from "unplugin-auto-import/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      title: "Codefair",
      meta: [
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
      ],
      script: [
        {
          async: true,
          "data-website-id": "80e10200-5878-4adb-9a9e-ac0f23cb1f33",
          src: "https://umami.fairdataihub.org/mushroom",
        },
        {
          async: true,
          src: "https://tally.so/widgets/embed.js",
        },
      ],
    },
    layoutTransition: { name: "layout", mode: "out-in" },
    pageTransition: { name: "page", mode: "out-in" },
  },

  build: {
    transpile:
      process.env.NODE_ENV === "production"
        ? [
            "naive-ui",
            "vueuc",
            "@css-render/vue3-ssr",
            "@juggle/resize-observer",
          ]
        : ["@juggle/resize-observer"],
  },

  colorMode: {
    classPrefix: "",
    classSuffix: "-mode",
    componentName: "ColorScheme",
    fallback: "light", // fallback value if not system preference found
    globalName: "__NUXT_COLOR_MODE__",
    hid: "nuxt-color-mode-script",
    preference: "light", // default value of $colorMode.preference
    storageKey: "nuxt-color-mode",
  },

  compatibilityDate: "2024-09-24",

  css: [
    "@/assets/css/tailwind.css",
    "md-editor-v3/lib/style.css",
    "notivue/notification.css", // Only needed if using built-in notifications
    "notivue/animations.css", // Only needed if using built-in animations
  ],

  devtools: { enabled: true },

  modules: [
    "@nuxtjs/tailwindcss",
    "notivue/nuxt",
    "@nuxtjs/color-mode",
    "@pinia/nuxt",
    "dayjs-nuxt",
    [
      "@nuxtjs/google-fonts",
      {
        families: {
          Inter: true,
          Onest: true,
        },
      },
    ],
    "nuxt-icon",
    "nuxtjs-naive-ui",
  ],

  notivue: {
    notifications: {
      global: {},
    },
    position: "bottom-right",
  },

  runtimeConfig: {
    public: {
      codefairDomain: process.env.CODEFAIR_APP_DOMAIN,
    },
  },

  vite: {
    optimizeDeps: {
      include:
        process.env.NODE_ENV === "development" ? ["naive-ui", "vueuc"] : [],
    },
    plugins: [
      AutoImport({
        imports: [
          {
            "naive-ui": [
              "useDialog",
              "useMessage",
              "useNotification",
              "useLoadingBar",
            ],
          },
        ],
      }),
      Components({
        resolvers: [NaiveUiResolver()],
      }),
    ],
    server: {
      hmr: {
        clientPort: 3000,
      },
    },
  },
});

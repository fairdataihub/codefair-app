import { NaiveUiResolver } from "unplugin-vue-components/resolvers";
import Components from "unplugin-vue-components/vite";
import AutoImport from "unplugin-auto-import/vite";

/**
 * The port in CODEFAIR_APP_DOMAIN, which GitHub login redirects back to.
 * Undefined when the domain has no explicit port (production) or is unset.
 */
const appDomainPort = (() => {
  try {
    return (
      Number(new URL(process.env.CODEFAIR_APP_DOMAIN ?? "").port) || undefined
    );
  } catch {
    return undefined;
  }
})();

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
    transpile: [
      "naive-ui",
      "vueuc",
      "@css-render/vue3-ssr",
      "@juggle/resize-observer",
      "vue-countup-v3",
    ],
  },

  colorMode: {
    classSuffix: "",
    fallback: "light",
    preference: "system",
    storageKey: "nuxt-color-mode",
  },

  compatibilityDate: "2024-09-24",

  css: [
    "@/assets/css/tailwind.css",
    "md-editor-v3/lib/style.css",
    "notivue/notification.css", // Only needed if using built-in notifications
    "notivue/animations.css", // Only needed if using built-in animations
  ],

  // The dev server tries the sign-in callback port first and moves to the next
  // free port when it is taken
  devServer: { port: appDomainPort },

  devtools: { enabled: true },

  hooks: {
    "vite:extendConfig"(config, { isServer }) {
      // Nuxt's SSR Vite server never uses HMR but still opens a WebSocket on
      // Vite's default port 24678, which clashes with other local Nuxt apps
      if (isServer && config.server) {
        config.server.ws = false;
      }
    },
  },

  modules: [
    "motion-v/nuxt",
    "notivue/nuxt",
    "nuxtjs-naive-ui",
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
    "@nuxt/icon",
  ],

  notivue: {
    notifications: {
      global: {},
    },
    position: "bottom-right",
  },

  postcss: {
    plugins: {
      autoprefixer: {},
      tailwindcss: {}, // https://tailwindcss.nuxtjs.org/postcss
    },
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
  },
});

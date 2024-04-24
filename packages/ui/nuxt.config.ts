// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      title: "codefair",
      meta: [
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
      ],
      script: [
        {
          async: true,
          "data-website-id": '',
          src: "https://umami.fairdataihub.org/mushroom",
        },
      ],
    },
    layoutTransition: { name: "layout", mode: "out-in" },
    pageTransition: { name: "page", mode: "out-in" },
  },


  modules: ["@nuxtjs/tailwindcss", "@bg-dev/nuxt-naiveui", "notivue/nuxt",  [
    "@nuxtjs/google-fonts",
    {
      families: {
        Inter: true,
      },
    },
  ], "nuxt-icon",],

  css: [
    // "@/assets/css/tailwind.css",
    "notivue/notification.css", // Only needed if using built-in notifications
    "notivue/animations.css", // Only needed if using built-in animations
  ],

  notivue: {
    position: "bottom-right",
  },

  devtools: { enabled: true },
});

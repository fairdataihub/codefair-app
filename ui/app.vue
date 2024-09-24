<template>
  <NaiveConfig :theme-config="themeConfig">
    <Notivue v-slot="item">
      <NotivueSwipe :item="item">
        <Notifications :item="item" :theme="pastelTheme" />
      </NotivueSwipe>
    </Notivue>

    <NuxtLoadingIndicator color="#be185d" :height="5" />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </NaiveConfig>
</template>

<script setup lang="ts">
import { pastelTheme } from "notivue";

const themeConfig = {
  dark: {}, // Theme options applied on dark mode
  light: {}, // Theme options applied on light mode
  mobile: {}, // Theme options applied on mobile only
  mobileOrTablet: {}, // Theme options applied on mobile and tablet
  shared: {
    common: {
      // primaryColor: "#898CF3",
      primaryColor: "#6366f1",
      primaryColorHover: "#4F46E5",
      // primaryColorHover: "#6074aa",
      primaryColorPressed: "#c7d6ff",
      primaryColorSuppl: "#0ea5e9",
    },
  }, // Common theme options
};

useHead({
  title: "Codefair",
  bodyAttrs: {
    class: "test",
  },
  link: [
    { href: "/favicon.ico", rel: "icon", type: "image/x-icon" },
    {
      href: "/apple-touch-icon.png",
      rel: "apple-touch-icon",
      sizes: "180x180",
    },
    {
      href: "/favicon-16x16.png",
      rel: "icon",
      sizes: "16x16",
      type: "image/png",
    },
    {
      href: "/favicon-32x32.png",
      rel: "icon",
      sizes: "32x32",
      type: "image/png",
    },
    {
      color: "#5bbad5",
      href: "/safari-pinned-tab.svg",
      rel: "mask-icon",
    },
    {
      href: "/site.webmanifest",
      rel: "manifest",
    },
  ],
  meta: [
    {
      name: "description",
      content:
        "Codefair is a free and open source GitHub app that acts as your personal assistant when it comes to making your research software reusable and especially complying with the Findable, Accessible, Interoperable, Reusable (FAIR) Principles for Research Software (FAIR4RS Principles).",
    },
    {
      name: "msapplication-TileColor",
      content: "#2b5797",
    },
    {
      name: "theme-color",
      content: "#ffffff",
    },
  ],
});

useSeoMeta({
  title: "Codefair",
  description:
    "Codefair is a free and open source GitHub app that acts as your personal assistant when it comes to making your research software reusable and especially complying with the Findable, Accessible, Interoperable, Reusable (FAIR) Principles for Research Software (FAIR4RS Principles).",
  ogDescription:
    "Codefair is a free and open source GitHub app that acts as your personal assistant when it comes to making your research software reusable and especially complying with the Findable, Accessible, Interoperable, Reusable (FAIR) Principles for Research Software (FAIR4RS Principles).",
  ogImage:
    "https://kalai.fairdataihub.org/api/generate?title=codefair&description=Make%20your%20research%20software%20reusable%20without%20breaking%20a%20sweat!&app=codefair&org=fairdataihub",
  ogTitle: "Codefair",
  twitterCard: "summary_large_image",
});
</script>

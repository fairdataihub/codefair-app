<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <Notivue v-slot="item">
      <Notification :item="item" :theme="pastelTheme" />
    </Notivue>
    <!-- <Notivue v-slot="item">
      <Notification :item="item" :theme="pastelTheme" />
    </Notivue> -->

    <NuxtLoadingIndicator color="#be185d" :height="5" />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </n-config-provider>
</template>

<script setup lang="ts">
import { computed } from "vue";
// import { useColorMode } from "@nuxtjs/color-mode";
import { NConfigProvider, type GlobalThemeOverrides } from "naive-ui";
import { pastelTheme } from "notivue";

const colorMode = useColorMode();

const themeOverrides = computed<GlobalThemeOverrides>(() => ({
  Alert: {
    colorInfo:
      colorMode.value === "dark"
        ? "oklch(54.6% 0.245 262.881 / 50%)"
        : "#EDF5FE",
    titleTextColorInfo: colorMode.value === "dark" ? "#FFFFFF" : "#1E40AF",
  },
  common: {
    primaryColor: colorMode.value === "dark" ? "#4F46E5" : "#6366f1",
    primaryColorHover: colorMode.value === "dark" ? "#7C3AED" : "#4F46E5",
    primaryColorPressed: colorMode.value === "dark" ? "#312E81" : "#c7d6ff",
    primaryColorSuppl: "#0ea5e9",
  },
  Dropdown: {
    color: colorMode.value === "dark" ? "oklch(98.5% 0.001 106.423)" : "white",
    optionColorHover:
      colorMode.value === "dark"
        ? "oklch(92.9% 0.013 255.508)"
        : "oklch(92.9% 0.013 255.508)",
    textColor: colorMode.value === "dark" ? "dark" : "light",
  },
  Input: {
    placeholderColor:
      colorMode.value === "dark" ? "oklch(70.7% 0.022 261.325)" : "#9ca3af",
  },
  Menu: {
    color: colorMode.value === "dark" ? "oklch(70.4% 0.04 256.788)" : "white",
    optionColorHover:
      colorMode.value === "dark"
        ? "oklch(92.9% 0.013 255.508)"
        : "oklch(86.9% 0.022 252.894)",
    textColor: colorMode.value === "dark" ? "dark" : "light",
  },
  Tag: {
    closeIconColorSuccess: "oklch(79.2% 0.209 151.711)",
    colorInfo: colorMode.value === "dark" ? "#f0f9ff" : "#EFF6FF",
    colorSuccess:
      colorMode.value === "dark" ? "oklch(79.2% 0.209 151.711)" : "#EDF7F2",
    textColorInfo: colorMode.value === "dark" ? "#0c4a6e" : "#1E40AF",
    textColorSuccess:
      colorMode.value === "dark" ? "oklch(79.2% 0.209 151.711)" : "#18a058",
    textColorWarning: colorMode.value === "dark" ? "#eb385c" : "#d03050",
  },
}));

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

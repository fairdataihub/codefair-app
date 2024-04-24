<script setup lang="ts">
const devMode = process.env.NODE_ENV === "development";

const navCollapsed = ref(false);

const links = [
  {
    title: "Find Datasets",

    href: "/",
  },
  {
    title: "Share datasets",

    href: "/submit",
  },
  {
    title: "About",

    href: "/about",
  },
  {
    title: "Documentation",

    href: "https://docs.fairhub.io",
  },
  {
    title: "Contact",

    href: "/contact",
  },
];
</script>

<template>
  <div
    class="relativee mx-autoe flexe eh-screen w-fulle eflex-col"
    :class="{ 'debug-screens': devMode }"
  >
  <div class="pb-10 sm:pb-8 lg:pb-12">
      <div class="container mx-auto max-w-screen-xl px-4 md:px-8">
  <header
          class="mb-8 flex items-center justify-between py-4 md:mb-12 md:py-8 xl:mb-16"
        >
          <!-- logo - start -->
          <a
            href="/"
            class="font-inter inline-flex items-center gap-2.5 text-2xl font-bold text-black md:text-3xl"
            aria-label="logo"
          >
            <img
              src="./assets/images/codefair_logo.png"
              alt="codefair"
              class="w-10 h-10 md:w-12 md:h-12"
            />

            codefair
          </a>
          <!-- logo - end -->

          <!-- nav - start -->
          <nav class="hidden gap-12 lg:flex">
            <!-- <a
              href="#about"
              class="font-inter text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
              >About</a
            > -->
            <a
              href="codefair"
              class="font-inter text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
              >About</a
            >
            <a
              href="fairsoftware"
              class="font-inter text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
              >FAIR Software</a
            >
            <a
              href="#contact"
              class="font-inter text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
              >Contact</a
            >
            <a
              href="https://github.com/fairdataihub/codefair-app"
              class="font-inter text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
              >GitHub</a
            >
          </nav>
          <!-- nav - end -->

          <!-- buttons - start -->
          <!-- <a
            href="#"
            class="hidden rounded-lg bg-gray-200 px-8 py-3 text-center text-sm font-semibold text-gray-500 outline-none ring-indigo-300 transition duration-100 hover:bg-gray-300 focus-visible:ring active:text-gray-700 md:text-base lg:inline-block"
            >Log In</a
          > -->

          <button
            id="mobile-menu-button"
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-gray-200 px-2.5 py-2 text-sm font-semibold text-gray-500 ring-indigo-300 hover:bg-gray-300 focus-visible:ring active:text-gray-700 md:text-base lg:hidden"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                clip-rule="evenodd"
              />
            </svg>

            Menu
          </button>
          <div
            id="mobile-menu"
            class="hidden fixed inset-0 bg-purple-50 z-50 flex flex-col items-center justify-center gap-6"
            style="height: fit-content; padding: 6rem;"
          >
            <a
              href="/"
              class="font-inter absolute top-4 left-4 inline-flex items-center gap-2.5 text-2xl font-bold text-black"
              aria-label="logo"
            >
              <img
                src="./assets/images/codefair_logo.png"
                alt="codefair"
                class="w-10 h-10"
              />

              codefair
            </a>

            <button
              id="mobile-menu-close"
              type="button"
              class="absolute top-6 right-4 text-gray-500"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M14.95 5.05a1 1 0 00-1.41 0L10 8.59 6.46 5.05a1 1 0 00-1.41 1.41L8.59 10 5.05 13.54a1 1 0 001.41 1.41L10 11.41l3.54 3.54a1 1 0 001.41-1.41L11.41 10l3.54-3.54a1 1 0 000-1.41z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>

            <nav class="flex flex-col gap-6">
              <a
              href="codefair.html"
              class="font-inter text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
              >About</a
            >
              <a
                href="fairsoftware.html"
                class="font-inter text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
                >FAIR Software</a
              >
              <a
                href="#contact"
                class="font-inter text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
                >Contact</a
              >
              <a
                href="https://github.com/fairdataihub/codefair-app"
                class="font-inter text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
                >GitHub</a
              >
            </nav>
          </div>
          <!-- buttons - end -->
        </header>

    <slot />
  </div>
  </div>
  </div>
</template>
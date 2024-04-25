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
    class="relative mx-auto flex h-screen w-full flex-col"
    :class="{ 'debug-screens': devMode }"
  >
    <div class="relative pb-10 sm:pb-8 lg:pb-12">
      <div
        class="ransform-gpu absolute inset-x-0 -top-40 z-0 overflow-hidden blur-3xl sm:-top-80"
        aria-hidden="true"
      >
        <div
          class="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style="
            clip-path: polygon(
              74.1% 44.1%,
              100% 61.6%,
              97.5% 26.9%,
              85.5% 0.1%,
              80.7% 2%,
              72.5% 32.5%,
              60.2% 62.4%,
              52.4% 68.1%,
              47.5% 58.3%,
              45.2% 34.5%,
              27.5% 76.7%,
              0.1% 64.9%,
              17.9% 100%,
              27.6% 76.8%,
              76.1% 97.7%,
              74.1% 44.1%
            );
          "
        ></div>
      </div>

      <div class="container relative z-10 mx-auto max-w-screen-xl px-4 md:px-8">
        <header
          class="mb-8 flex items-center justify-between py-4 md:mb-12 md:py-8 xl:mb-16"
        >
          <a
            href="/"
            class="inline-flex items-center gap-2.5 text-2xl font-bold text-black md:text-3xl"
            aria-label="logo"
          >
            <img
              src="/assets/images/codefair_logo.png"
              alt="codefair"
              class="h-10 w-10 md:h-12 md:w-12"
            />

            codefair
          </a>

          <nav class="hidden gap-12 lg:flex">
            <NuxtLink
              href="codefair"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
            >
              About
            </NuxtLink>
            <NuxtLink
              href="fairsoftware"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
            >
              FAIR Software
            </NuxtLink>
            <NuxtLink
              href="#contact"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
            >
              Contact
            </NuxtLink>
            <NuxtLink
              href="docs"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
            >
              Documentation
            </NuxtLink>
            <NuxtLink
              href="https://github.com/fairdataihub/codefair-app"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
            >
              GitHub
            </NuxtLink>
          </nav>

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
            class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-purple-50 sm:hidden"
            style="height: fit-content; padding: 6rem"
          >
            <a
              href="/"
              class="absolute left-4 top-4 inline-flex items-center gap-2.5 text-2xl font-bold text-black"
              aria-label="logo"
            >
              <img
                src="/assets/images/codefair_logo.png"
                alt="codefair"
                class="h-10 w-10"
              />

              codefair
            </a>

            <button
              id="mobile-menu-close"
              type="button"
              class="absolute right-4 top-6 text-gray-500"
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
                class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
                >About</a
              >
              <a
                href="fairsoftware.html"
                class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
                >FAIR Software</a
              >
              <a
                href="#contact"
                class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
                >Contact</a
              >
              <a
                href="https://github.com/fairdataihub/codefair-app"
                class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
                >GitHub</a
              >
            </nav>
          </div>
        </header>
      </div>

      <slot />

      <footer id="contact">
        <div>
          <div class="mx-auto max-w-screen-xl border-t px-4 md:px-8">
            <div
              class="my-4 grid grid-rows-1 items-center gap-12 md:my-20 md:grid-cols-3 md:grid-rows-1"
            >
              <div class="my-8 md:col-span-2 lg:my-0">
                <div class="mb-4 lg:-mt-2">
                  <a
                    href="/"
                    class="inline-flex items-center gap-2.5 text-2xl font-bold text-black md:text-3xl"
                    aria-label="logo"
                  >
                    <img
                      src="/assets/images/codefair_logo.png"
                      alt="codefair"
                      class="h-10 w-10 md:h-12 md:w-12"
                    />

                    codefair
                  </a>
                </div>

                <p class="mb-6 text-gray-500 sm:pr-8">
                  With codefair by your side, you're not just managing
                  repositories but you are advocating for the development of
                  FAIR software
                </p>

                <div class="flex gap-4">
                  <a
                    href="https://twitter.com/fairdataihub"
                    target="_blank"
                    class="text-gray-400 transition duration-100 hover:text-gray-500 active:text-gray-600"
                  >
                    <svg
                      class="h-5 w-5"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"
                      />
                    </svg>
                  </a>

                  <a
                    href="https://github.com/fairdataihub"
                    target="_blank"
                    class="text-gray-400 transition duration-100 hover:text-gray-500 active:text-gray-600"
                  >
                    <svg
                      class="h-5 w-5"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </div>

            <div class="border-t py-8 text-center text-sm text-gray-400">
              <p
                class="align-center -mb-4 flex justify-center self-center text-center"
              >
                Made with
                <svg
                  style="margin-top: 0.1rem"
                  xmlns="http://www.w3.org/2000/svg"
                  width="30"
                  height="20"
                  viewBox="0 0 256 256"
                >
                  <g fill="#a782ec">
                    <path
                      d="M232 102c0 66-104 122-104 122S24 168 24 102a54 54 0 0 1 54-54c22.59 0 41.94 12.31 50 32c8.06-19.69 27.41-32 50-32a54 54 0 0 1 54 54"
                      opacity="0.2"
                    />
                    <path
                      d="M178 40c-20.65 0-38.73 8.88-50 23.89C116.73 48.88 98.65 40 78 40a62.07 62.07 0 0 0-62 62c0 70 103.79 126.66 108.21 129a8 8 0 0 0 7.58 0C136.21 228.66 240 172 240 102a62.07 62.07 0 0 0-62-62m-50 174.8c-18.26-10.64-96-59.11-96-112.8a46.06 46.06 0 0 1 46-46c19.45 0 35.78 10.36 42.6 27a8 8 0 0 0 14.8 0c6.82-16.67 23.15-27 42.6-27a46.06 46.06 0 0 1 46 46c0 53.61-77.76 102.15-96 112.8"
                    />
                  </g>
                </svg>
                by the FAIR Data Innovations Hub
              </p>
              <br />
              © 2024 - FAIR Data Innovations Hub. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

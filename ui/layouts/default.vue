<script setup lang="ts">
const devMode = process.env.NODE_ENV === "development";

const showMobileMenu = ref(false);

const toggleMobileMenu = () => {
  showMobileMenu.value = !showMobileMenu.value;
};
</script>

<template>
  <div
    class="relative mx-auto flex h-full min-h-screen w-full flex-col bg-slate-50"
    :class="{ 'debug-screens': devMode }"
  >
    <div
      class="absolute inset-x-0 -top-40 z-0 transform-gpu overflow-hidden blur-3xl sm:-top-80"
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

    <div class="relative z-20 mx-auto w-full max-w-screen-xl px-4 md:px-8">
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

        <nav class="hidden items-center gap-8 lg:flex">
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
            href="https://github.com/fairdataihub/codefair-app"
            class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
          >
            GitHub
          </NuxtLink>

          <div>
            <ProfileStatus />
          </div>
        </nav>

        <button
          v-if="!showMobileMenu"
          id="mobile-menu-button"
          type="button"
          class="z-20 inline-flex items-center gap-2 rounded-lg bg-gray-200 px-2.5 py-2 text-sm font-semibold text-gray-500 ring-indigo-300 hover:bg-gray-300 focus-visible:ring active:text-gray-700 md:text-base lg:hidden"
          @click="toggleMobileMenu"
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
          v-show="showMobileMenu"
          id="mobile-menu"
          class="z-100 fixed inset-0 flex flex-col items-center justify-center gap-6 bg-purple-50 sm:hidden"
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
            @click="toggleMobileMenu"
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
            <NuxtLink
              to="codefair"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
              @click="toggleMobileMenu"
            >
              About
            </NuxtLink>

            <NuxtLink
              to="fairsoftware"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
              @click="toggleMobileMenu"
            >
              FAIR Software
            </NuxtLink>

            <NuxtLink
              to="#contact"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
              @click="toggleMobileMenu"
            >
              Contact
            </NuxtLink>

            <NuxtLink
              to="https://github.com/fairdataihub/codefair-app"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
              @click="toggleMobileMenu"
            >
              GitHub
            </NuxtLink>
          </nav>
        </div>
      </header>
    </div>

    <div class="relative z-10 grow">
      <slot />
    </div>

    <footer class="mx-auto max-w-screen-xl border-t px-5">
      <div
        class="grid grid-rows-1 items-center gap-12 pb-4 pt-8 md:grid-cols-3 md:grid-rows-1"
      >
        <div class="md:col-span-2">
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
            With codefair by your side, you're not just managing repositories
            but you are advocating for the development of FAIR software
          </p>

          <div class="flex gap-4">
            <a
              href="https://twitter.com/fairdataihub"
              target="_blank"
              class="text-gray-400 transition duration-100 hover:text-gray-500 active:text-gray-600"
            >
              <Icon name="fa:twitter" size="25" />
            </a>

            <a
              href="https://github.com/fairdataihub"
              target="_blank"
              class="text-gray-400 transition duration-100 hover:text-gray-500 active:text-gray-600"
            >
              <Icon name="fa:github" size="25" />
            </a>
          </div>
        </div>

        <div class="py-8 text-right text-sm text-gray-400">
          <p class="align-center -mb-4 flex justify-end self-center text-right">
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
    </footer>
  </div>
</template>

<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

const user = useUser();
const route = useRoute();

const breadcrumbsStore = useBreadcrumbsStore();

const devMode = process.env.NODE_ENV === "development";
const showMobileMenu = ref(false);

watchEffect(() => {
  if (route.params.owner) {
    breadcrumbsStore.setOwner(route.params.owner as string);
  }
  if (route.params.repo) {
    breadcrumbsStore.setRepo(route.params.repo as string);
  }
});

const toggleMobileMenu = () => {
  showMobileMenu.value = !showMobileMenu.value;
};
</script>

<template>
  <div
    class="relative mx-auto flex h-full min-h-screen w-full flex-col bg-slate-50"
    :class="{ 'debug-screens': devMode }"
  >
    <!-- <div
      class="absolute left-0 top-0 z-0 h-full w-full bg-auto bg-center bg-repeat"
      style="background-image: url(&quot;/Hexagon.svg&quot;)"
    ></div> -->

    <div class="relative z-20 mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <header class="mb-0 flex items-center justify-between py-6">
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

          Codefair
        </a>

        <nav class="hidden items-center gap-8 lg:flex">
          <NuxtLink
            to="/codefair"
            class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
          >
            About
          </NuxtLink>

          <NuxtLink
            to="/fairsoftware"
            class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
          >
            FAIR Software
          </NuxtLink>

          <NuxtLink
            to="https://github.com/fairdataihub/codefair-app"
            class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
          >
            GitHub
          </NuxtLink>

          <n-badge v-if="user?.username" value="beta" type="warning">
            <!-- Using a here to request a page reload -->
            <a
              :href="`/dashboard/${user?.username}`"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
            >
              <span class=""> Dashboard </span>
            </a>
          </n-badge>

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

            Codefair
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
              to="/codefair"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
              @click="toggleMobileMenu"
            >
              About
            </NuxtLink>

            <NuxtLink
              to="/fairsoftware"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
              @click="toggleMobileMenu"
            >
              FAIR Software
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

    <!-- <div
      class="absolute top-0 z-0 w-full transform-gpu overflow-hidden bg-gradient-to-b from-blue-500 to-red-500"
      aria-hidden="true"
    >
      <div
        class="relative z-0 h-full border border-red-600 bg-gradient-to-b from-blue-500 to-red-500"
      >
        <img
          src="/Hexagon.svg"
          alt=""
          class="z-0 max-h-[600px] w-full bg-gradient-to-b from-blue-500 to-red-500 object-cover object-top"
        />
      </div>
    </div> -->

    <div class="relative z-10 grow">
      <div class="mx-auto max-w-screen-xl px-8">
        <ClientOnly>
          <template #fallback>
            <div class="h-[25px] w-full"></div>
          </template>

          <n-breadcrumb
            v-if="breadcrumbsStore.shouldShowBreadcrumbs"
            class="pb-3"
          >
            <n-breadcrumb-item>
              <Icon name="ri:dashboard-fill" />

              Dashboard
            </n-breadcrumb-item>

            <n-breadcrumb-item
              v-if="breadcrumbsStore.owner"
              :href="`/dashboard/${breadcrumbsStore.owner}`"
            >
              <Icon name="uil:github" />
              {{ breadcrumbsStore.owner }}
            </n-breadcrumb-item>

            <n-breadcrumb-item
              v-if="breadcrumbsStore.repo"
              :href="`/dashboard/${breadcrumbsStore.owner}/${breadcrumbsStore.repo}`"
            >
              <Icon name="vscode-icons:folder-type-git" />
              {{ breadcrumbsStore.repo }}
            </n-breadcrumb-item>

            <n-breadcrumb-item
              v-if="breadcrumbsStore.feature.id"
              :clickable="false"
            >
              <Icon :name="breadcrumbsStore.feature.icon" />
              {{ breadcrumbsStore.feature.name }}
            </n-breadcrumb-item>
          </n-breadcrumb>
        </ClientOnly>
      </div>

      <slot />
    </div>

    <footer class="mx-auto max-w-screen-xl border-t px-5 pt-3">
      <div
        class="grid grid-rows-1 items-center gap-12 pb-4 pt-8 lg:grid-cols-3 lg:grid-rows-1"
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

              Codefair
            </a>
          </div>

          <p class="mb-6 text-gray-500 sm:pr-8">
            With Codefair by your side, you're not just managing repositories
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

        <n-flex vertical size="small" class="py-8 text-base text-gray-400">
          <div class="flex items-center justify-end">
            <span class="text-right"> Made with </span>

            <svg
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

            <span class="text-right"> by the </span>

            <NuxtLink
              to="https://fairdataihub.org"
              class="pl-1 text-indigo-500 transition-all hover:text-indigo-600 active:text-indigo-700"
              target="_blank"
            >
              FAIR Data Innovations Hub
            </NuxtLink>
          </div>

          <span class="text-right text-sm">
            © 2024 - FAIR Data Innovations Hub. All rights reserved.
          </span>
        </n-flex>
      </div>
    </footer>

    <div class="fixed bottom-6 right-6 z-30">
      <n-button
        strong
        circle
        type="info"
        size="large"
        data-tally-open="3E0dao"
        data-tally-overlay="1"
        data-tally-emoji-text="👋"
        data-tally-emoji-animation="tada"
      >
        <template #icon>
          <Icon name="material-symbols:contact-support" size="25" />
        </template>
      </n-button>
    </div>
  </div>
</template>

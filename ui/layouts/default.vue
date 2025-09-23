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
    class="relative mx-auto flex h-full min-h-screen w-full flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-200"
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
          class="inline-flex items-center gap-2.5 text-2xl font-bold text-black dark:text-white md:text-3xl"
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
            class="relative inline-block text-lg font-bold text-[var(--gray-600-400)] transition-colors duration-150 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-0 after:rounded-lg after:bg-indigo-500 after:transition-all after:duration-300 after:content-[''] hover:text-indigo-500 hover:after:w-full active:text-indigo-700"
          >
            About
          </NuxtLink>

          <NuxtLink
            to="/fairsoftware"
            class="relative inline-block text-lg font-bold text-[var(--gray-600-400)] transition-colors duration-150 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-0 after:bg-indigo-500 after:transition-all after:duration-300 after:content-[''] hover:text-indigo-500 hover:after:w-full active:text-indigo-700"
          >
            FAIR Software
          </NuxtLink>

          <NuxtLink
            v-if="user?.username"
            to="/dashboard"
            class="relative inline-block text-lg font-bold text-[var(--gray-600-400)] transition-colors duration-150 after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-0 after:bg-indigo-500 after:transition-all after:duration-300 after:content-[''] hover:text-indigo-500 hover:after:w-full active:text-indigo-700"
          >
            Dashboard
          </NuxtLink>

          <ProfileStatus />

          <n-flex justify="center" gap="4" class="-ml-4">
            <NuxtLink
              to="https://docs.codefair.io/"
              target="_blank"
              class="text-lg font-bold text-[var(--gray-600-400)] transition duration-100 hover:text-indigo-500 active:text-indigo-700"
            >
              <n-popover trigger="hover" placement="top" :show-arrow="false">
                <template #trigger>
                  <Icon name="solar:documents-bold" size="22" />
                </template>

                <template #default>
                  <div class="w-48 text-center">
                    <p
                      class="text-sm font-semibold text-indigo-900 dark:text-indigo-200"
                    >
                      Documentation
                    </p>

                    <p class="text-xs text-gray-500 dark:text-gray-100">
                      Explore the documentation for Codefair.
                      <Icon
                        name="mdi:emoji-robot-happy"
                        size="14"
                        class="text-indigo-500"
                      />
                    </p>
                  </div>
                </template>
              </n-popover>
            </NuxtLink>

            <NuxtLink
              to="https://github.com/fairdataihub/codefair-app"
              target="_blank"
              class="text-lg font-bold text-[var(--gray-600-400)] transition duration-100 hover:text-indigo-500 active:text-indigo-700"
            >
              <n-popover trigger="hover" placement="top" :show-arrow="false">
                <template #trigger>
                  <Icon name="ri:github-fill" size="22" />
                </template>

                <template #default>
                  <div class="w-48 text-center">
                    <p
                      class="text-sm font-semibold text-indigo-900 dark:text-indigo-200"
                    >
                      GitHub Repository
                    </p>

                    <p class="text-xs text-gray-500 dark:text-gray-100">
                      View the source code and contribute to the project!
                      <Icon
                        name="mdi:emoji-robot-happy"
                        size="14"
                        class="text-indigo-500"
                      />
                    </p>
                  </div>
                </template>
              </n-popover>
            </NuxtLink>

            <SwitchColorSwitch />
          </n-flex>
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

    <div
      class="relative z-10 grow bg-gradient-to-b from-white to-codefair-light dark:from-gray-900 dark:to-codefair-grid"
    >
      <div class="mx-auto max-w-screen-xl px-8">
        <ClientOnly>
          <template #fallback>
            <div class="h-[25px] w-full"></div>
          </template>

          <n-breadcrumb
            v-if="breadcrumbsStore.shouldShowBreadcrumbs"
            class="pb-3"
          >
            <n-breadcrumb-item :href="`/dashboard`">
              <Icon name="ri:dashboard-fill" />

              Dashboard
            </n-breadcrumb-item>

            <n-breadcrumb-item
              v-if="breadcrumbsStore.owner"
              style="color: white !important"
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
              v-if="
                breadcrumbsStore.repo &&
                breadcrumbsStore.feature.id === 'release-zenodo'
              "
              :clickable="false"
            >
              <Icon name="material-symbols:package-2" />
              Release
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

    <footer
      style="
        background: radial-gradient(
          circle at bottom,
          var(--radial-start) 0%,
          var(--radial-end) 90%
        );
      "
    >
      <div
        class="mx-auto max-w-screen-xl border-t-2 border-indigo-200 px-5 py-4"
      >
        <div class="flex items-center justify-between">
          <!-- Logo -->
          <div class="flex items-center gap-2.5">
            <img
              src="/assets/images/codefair_logo.png"
              alt="codefair"
              class="h-10 w-10 md:h-12 md:w-12"
            />

            <span
              class="text-2xl font-bold text-black dark:text-white md:text-3xl"
            >
              Codefair
            </span>
          </div>

          <!-- Status Badge -->
          <div>
            <n-badge dot type="success" :show="true" :size="20">
              <n-tag type="info" class="dark:bg-[#4068BF] dark:text-stone-100">
                <NuxtLink
                  to="https://status.codefair.io/status/all"
                  target="_blank"
                  rel="noopener"
                >
                  <div class="flex items-center align-middle">
                    <span class="mr-[.2rem]"
                      >Monitor Codefair service status
                    </span>

                    <Icon name="ri:external-link-line" size="14" />
                  </div>
                </NuxtLink>
              </n-tag>
            </n-badge>
          </div>
        </div>

        <div
          class="mt-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center"
        >
          <div>
            <p class="mb-3 max-w-lg text-[var(--gray-600-400)]">
              With Codefair by your side, you're not just managing repositories
              but you are advocating for the development of FAIR software
            </p>

            <!-- Social icons -->
            <div class="flex gap-4">
              <a
                href="https://twitter.com/fairdataihub"
                target="_blank"
                class="text-gray-400 transition duration-100 hover:text-[var(--gray-500-300)] active:text-gray-600"
              >
                <Icon name="fa:twitter" size="25" />
              </a>

              <a
                href="https://github.com/fairdataihub"
                target="_blank"
                class="text-gray-400 transition duration-100 hover:text-[var(--gray-500-300)] active:text-gray-600"
              >
                <Icon name="fa:github" size="25" />
              </a>
            </div>
          </div>

          <div class="text-sm text-[var(--gray-600-400)] md:text-right">
            <div class="flex items-center gap-1 md:justify-end">
              <span>Made with</span>
              <!-- Heart SVG -->
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="16"
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

              <span>by the</span>

              <a
                href="https://fairdataihub.org"
                class="pl-1 text-[var(--link-color)] transition-all hover:text-[var(--link-hover)] hover:underline active:text-[var(--link-color)]"
                target="_blank"
              >
                FAIR Data Innovations Hub
              </a>
            </div>

            <!-- Year -->
            <div class="mt-2">
              © 2025 - FAIR Data Innovations Hub. All rights reserved.
            </div>
          </div>
        </div>
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

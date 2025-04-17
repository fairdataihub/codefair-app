<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.hideBreadcrumbs();
</script>

<template>
  <main class="min-h-screen bg-purple-50">
    <!-- HERO SECTION -->
    <section
      class="relative overflow-hidden bg-gradient-to-b from-white to-codefair-light py-12 md:py-24"
    >
      <!-- Grid pattern behind hero content -->
      <UiInteractiveGridPattern
        :class="[
          '[mask-image:radial-gradient(1000px_circle_at_center,white,transparent)]',
          'absolute',
          'inset-0',
          'w-full',
          'h-full',
          'z-10',
        ]"
        :width="60"
        :height="60"
        :squares="[80, 80]"
        squares-class-name="hover:fill-codefair-grid transition-colors duration-200"
      />
      <!-- Content container (pointer-events disabled so grid behind can be hovered) -->
      <div
        class="pointer-events-none relative z-20 mx-auto flex max-w-screen-xl flex-col-reverse items-center gap-10 px-4 sm:px-8 md:flex-row md:gap-16"
      >
        <div
          class="mt-0 flex flex-col items-center text-center md:w-1/2 md:items-start md:text-left"
        >
          <h1
            class="mb-4 text-4xl font-extrabold leading-tight text-indigo-900 md:text-6xl"
          >
            Make your research software reusable
            <br class="hidden md:block" />

            <span class="text-indigo-700">without breaking a sweat!</span>
          </h1>

          <p class="font-onest text-gray-700 md:text-lg lg:text-xl">
            Let Codefair handle the complexities of making your research
            software FAIR, so you can focus on what matters most to you.
          </p>

          <div class="pointer-events-auto mt-8">
            <NuxtLink
              to="https://github.com/marketplace/codefair-app"
              target="_blank"
              class="inline-block rounded-lg bg-indigo-500 px-8 py-3 text-base font-semibold text-white outline-none ring-indigo-300 transition duration-200 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-lg"
            >
              Get Codefair ->
            </NuxtLink>
          </div>
        </div>
        <!-- Hero images -->
        <div
          class="pointer-events-none relative hidden justify-center md:flex md:w-1/2"
        >
          <div class="relative w-[18rem] md:w-[25rem]">
            <img
              src="/assets/images/second_layer_hero.png"
              alt="Hero image"
              loading="lazy"
              class="absolute -top-16 left-12 w-[18rem] animate-float-opposite object-cover md:w-[25rem]"
            />

            <img
              src="/assets/images/first_layer_hero.png"
              alt="Hero image"
              loading="lazy"
              class="relative w-[18rem] animate-float-item object-cover md:w-[25rem]"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 1: What is Codefair? -->
    <section
      style="
        background: radial-gradient(
          circle at bottom,
          white 0%,
          var(--codefair-light) 90%
        );
      "
      class="p-8 md:py-16"
    >
      <!-- Content container -->
      <div
        class="z-10 mx-auto flex max-w-screen-xl flex-col items-center gap-8 md:flex-row"
      >
        <div class="pointer-events-none flex justify-center md:w-1/2">
          <img
            src="/assets/images/Saly-38.png"
            alt="Info image"
            loading="lazy"
            class="w-[15rem] md:w-[23rem]"
          />
        </div>

        <div class="md:w-1/2">
          <h2 class="mb-4 text-3xl font-bold text-indigo-900 sm:text-4xl">
            What is Codefair?
          </h2>

          <p class="font-onest text-lg text-slate-800">
            Codefair is a free and open source GitHub app that acts as your
            personal assistant when it comes to making your research software
            reusable and especially complying with the
            <NuxtLink
              to="https://www.nature.com/articles/s41597-022-01710-x"
              target="_blank"
              class="text-indigo-700 hover:text-indigo-500 active:text-indigo-700"
              >Findable, Accessible, Interoperable, Reusable (FAIR) Principles
              for Research Software (FAIR4RS Principles)</NuxtLink
            >. Whether you are developing AI/ML models with Python, data
            visualization tools with Jupyter notebook, or data analysis code
            with R, Codefair is here to assist you.
          </p>

          <div class="mt-6">
            <NuxtLink
              to="https://github.com/fairdataihub/codefair-app"
              target="_blank"
              class="inline-block rounded-lg bg-indigo-500 px-8 py-3 text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-200 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
            >
              View the source code ->
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Border bottom -->
      <!-- <div
        class="mx-auto max-w-screen-xl border-b-2 border-b-slate-300 bg-transparent"
      ></div> -->
    </section>

    <!-- SECTION 2: Why make research software reusable? -->
    <section
      style="
        background: radial-gradient(
          circle at top,
          white 0%,
          var(--codefair-light) 90%
        );
      "
      class="p-8 md:py-16"
    >
      <div
        class="mx-auto flex max-w-screen-xl flex-col-reverse items-center gap-8 md:flex-row"
      >
        <div class="md:w-1/2">
          <h2 class="mb-4 text-3xl font-bold text-indigo-900 sm:text-4xl">
            Why make research software reusable?
          </h2>

          <p class="font-onest text-lg text-slate-800">
            Making research software FAIR, i.e. optimally reusable, is critical
            to enable reproducible and transparent research, prevent duplicate
            effort, and ultimately increase the pace of new discoveries. Also,
            more funding agencies such as the NIH and NSF require software to be
            reusable.
          </p>

          <div class="mt-6">
            <NuxtLink
              to="fairsoftware"
              target="_blank"
              class="inline-block rounded-lg bg-indigo-500 px-8 py-3 text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-200 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
            >
              Learn more about FAIR software ->
            </NuxtLink>
          </div>
        </div>

        <div class="pointer-events-none flex justify-center md:w-1/2">
          <img
            src="/assets/images/Other 08.png"
            alt="Info image"
            loading="lazy"
            class="w-[15rem] md:w-[21rem]"
          />
        </div>
      </div>

      <!-- Border bottom -->
      <!-- <div
        class="mx-auto max-w-screen-xl border-b-2 border-b-slate-300 bg-transparent"
      ></div> -->
    </section>

    <!-- SECTION 3: Why should you use Codefair? -->
    <section
      style="
        background: radial-gradient(
          circle at bottom,
          white 0%,
          var(--codefair-light) 90%
        );
      "
      class="p-8 md:py-16"
    >
      <div
        class="mx-auto flex max-w-screen-xl flex-col items-center gap-8 md:flex-row"
      >
        <div class="pointer-events-none flex justify-center md:w-1/2">
          <img
            src="/assets/images/Saly-16.png"
            alt="Info image"
            loading="lazy"
            class="w-[15rem] md:w-[22rem]"
          />
        </div>

        <div class="md:w-1/2">
          <h2 class="mb-4 text-3xl font-bold text-indigo-900 sm:text-4xl">
            Why should you use Codefair?
          </h2>

          <p class="text-lg text-slate-800">
            With Codefair, you do not have to think about making your software
            FAIR. Just install Codefair from the GitHub marketplace on your
            repository. Then track FAIR-compliance issues in the Codefair
            dashboard and address them through the Codefair website. Through
            intuitive interfaces and automated pull requests, Codefair helps
            ensure best coding practices, standard metadata, a proper license,
            archival on
            <NuxtLink
              to="https://zenodo.org/"
              target="_blank"
              class="text-indigo-700 hover:text-indigo-500 active:text-indigo-700"
              >Zenodo</NuxtLink
            >, and much more to align with FAIR4RS principles.
          </p>

          <div class="mt-6">
            <NuxtLink
              to="codefair"
              target="_blank"
              class="inline-block rounded-lg bg-indigo-500 px-8 py-3 text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-200 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
            >
              Learn more about Codefair ->
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Border bottom -->
      <!-- <div
        class="mx-auto max-w-screen-xl border-b-2 border-b-slate-300 bg-transparent"
      ></div> -->
    </section>

    <!-- SECTION 4: Who are we? -->
    <section
      style="
        background: radial-gradient(
          circle at top,
          white 0%,
          var(--codefair-light) 90%
        );
      "
      class="p-8 md:py-16"
    >
      <div
        class="z-10 mx-auto flex max-w-screen-xl flex-col items-center gap-8 md:flex-row"
      >
        <div class="md:w-1/2">
          <h2 class="mb-4 text-3xl font-bold text-indigo-900 sm:text-4xl">
            Who are we?
          </h2>

          <p class="text-lg text-slate-800">
            Codefair is developed by the FAIR Data Innovations Hub team, part of
            the nonprofit biomedical research facility, California Medical
            Innovations Institute. We experienced firsthand the challenges of
            making software FAIR, which prompted us to create Codefair. We hope
            to secure funding so we can dedicate more time and effort to this
            much-needed tool—and welcome contributions from others!
          </p>

          <div class="mt-6">
            <NuxtLink
              to="https://fairdataihub.org/"
              target="_blank"
              class="inline-block rounded-lg bg-indigo-500 px-8 py-3 text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-200 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
            >
              Learn more about us ->
            </NuxtLink>
          </div>
        </div>

        <div class="pointer-events-none flex justify-center md:w-1/2">
          <img
            src="/assets/images/DRIP_18.png"
            alt="Info image"
            loading="lazy"
            class="w-[15rem] md:w-[20rem]"
          />
        </div>
      </div>

      <!-- Border bottom -->
      <!-- <div
        class="mx-auto max-w-screen-xl border-b-2 border-b-slate-300 bg-transparent"
      ></div> -->
    </section>

    <!-- SECTION 5: Need help? -->
    <section
      style="
        background: radial-gradient(
          circle at center,
          white 0%,
          var(--codefair-light) 80%
        );
      "
      class="p-8 md:py-16"
    >
      <div class="z-10 mx-auto max-w-screen-xl">
        <div class="flex flex-col gap-8 md:flex-row-reverse md:items-center">
          <div class="md:w-1/2">
            <h2 class="mb-4 text-3xl font-bold text-indigo-900 sm:text-4xl">
              Need help? Have suggestions? Want to contribute?
            </h2>

            <p class="mb-6 text-lg text-slate-800">
              Reach out via the GitHub issues of the Codefair repo and we’ll be
              happy to connect with you. You can also use the Contact Us form at
              the bottom right of this page. We’re always looking for ways to
              make Codefair better!
            </p>

            <n-flex>
              <div class="flex flex-col gap-3 sm:flex-row">
                <NuxtLink
                  to="https://github.com/fairdataihub/codefair-app/issues"
                  target="_blank"
                  class="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-200 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700"
                >
                  <Icon name="fa:github" size="16" />

                  <span>Open a GitHub issue</span>
                </NuxtLink>

                <NuxtLink
                  to="https://docs.codefair.io/"
                  target="_blank"
                  class="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-3 text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-200 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700"
                >
                  <span>Read the Documentation</span>

                  <Icon
                    name="material-symbols:arrow-forward-rounded"
                    size="16"
                  />
                </NuxtLink>
              </div>
            </n-flex>
          </div>

          <div class="pointer-events-none flex justify-center md:w-1/2">
            <div class="p-4">
              <img
                src="/assets/images/Other 02.png"
                alt="Info image"
                loading="lazy"
                class="w-[15rem] md:w-[20rem]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

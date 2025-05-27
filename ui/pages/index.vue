<script setup lang="ts">
import CountUp from "vue-countup-v3";
import { ref } from "vue";

import type { CountUpOptions } from "vue-countup-v3";
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.hideBreadcrumbs();

const statsList = ref<StatItem[]>([
  {
    id: "repositories-managed",
    endValue: 400,
    icon: "ri:git-repository-fill",
    startValue: 0,
    suffix: "+",
    text: "Repositories managed",
  },
  {
    id: "user-installations",
    endValue: 35,
    icon: "ri:team-fill",
    startValue: 0,
    text: "Individual users and organizations using Codefair",
  },
]);

const countupOptions: CountUpOptions = {
  enableScrollSpy: true, // only start when scrolled into view
  scrollSpyDelay: 0, // optional delay (ms)
  scrollSpyOnce: true, // animate just once
  separator: ",", // grouping separator
};
</script>

<template>
  <main class="min-h-screen bg-purple-50">
    <!-- HERO SECTION -->
    <section
      class="relative overflow-hidden bg-gradient-to-b from-white to-codefair-light py-12 dark:from-gray-900 dark:to-codefair-grid md:py-24"
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
            class="mb-4 text-4xl font-extrabold leading-tight text-[var(--header-color)] md:text-6xl"
          >
            Make your research software reusable
            <br class="hidden md:block" />

            <span class="text-[var(--indigo-700-500)]"
              >without breaking a sweat!</span
            >
          </h1>

          <p
            class="font-onest font-medium text-[var(--text-color)] md:text-lg lg:text-xl"
          >
            Let Codefair handle the complexities of making your research
            software FAIR, so you can focus on what matters most to you.
          </p>

          <n-flex
            justify="between"
            class="align-center pointer-events-auto mt-8 justify-center md:justify-start"
          >
            <NuxtLink
              to="https://github.com/marketplace/codefair-app"
              target="_blank"
              class="inline-block items-center rounded-lg bg-[var(--btn-bg)] px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--btn-bg-hover)] active:bg-[var(--btn-bg-active)] md:text-lg"
            >
              Get Codefair ->
            </NuxtLink>

            <NuxtLink
              to="https://docs.codefair.io/"
              target="_blank"
              class="inline-block items-center rounded-lg bg-[var(--btn-bg)] px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--btn-bg-hover)] active:bg-[var(--btn-bg-active)] md:text-lg"
            >
              Read the Documentation
              <Icon name="solar:documents-bold" size="18" />
            </NuxtLink>
          </n-flex>
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
          var(--radial-start) 0%,
          var(--radial-end) 90%
        );
      "
      class="p-8 backdrop-blur-xl md:py-16"
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
          <h2
            class="mb-4 text-3xl font-bold text-[var(--header-color)] sm:text-4xl"
          >
            What is Codefair?
          </h2>

          <p class="font-onest text-lg text-[var(--text-color)]">
            Codefair is a free and open source GitHub app that acts as your
            personal assistant when it comes to making your research software
            reusable and especially complying with the
            <NuxtLink
              to="https://www.nature.com/articles/s41597-022-01710-x"
              target="_blank"
              class="text-[var(--link-color)] hover:text-[var(--link-hover)] active:text-[var(--link-color)]"
              >Findable, Accessible, Interoperable, Reusable (FAIR) Principles
              for Research Software (FAIR4RS Principles)</NuxtLink
            >. Whether you are developing AI/ML models with Python, data
            visualization tools with Jupyter notebook, or data analysis code
            with R, Codefair is here to assist you.
          </p>

          <n-flex justify="between" class="mt-6">
            <NuxtLink
              to="https://github.com/fairdataihub/codefair-app"
              target="_blank"
              class="inline-block rounded-lg bg-[var(--btn-bg)] px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--btn-bg-hover)] active:bg-[var(--btn-bg-active)] md:text-base"
            >
              <n-flex justify="between" align="center">
                <span>View the source code</span>

                <Icon
                  name="fluent:code-block-edit-24-filled"
                  size="18"
                  class="-ml-1"
                />
              </n-flex>
            </NuxtLink>

            <NuxtLink
              to="codefair"
              target="_blank"
              class="inline-block rounded-lg bg-[var(--btn-bg)] px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--btn-bg-hover)] active:bg-[var(--btn-bg-active)] md:text-base"
            >
              Learn more about Codefair ->
            </NuxtLink>
          </n-flex>
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
          var(--radial-start) 0%,
          var(--radial-end) 90%
        );
      "
      class="p-8 md:py-16"
    >
      <div
        class="mx-auto flex max-w-screen-xl flex-col-reverse items-center gap-8 md:flex-row"
      >
        <div class="md:w-1/2">
          <h2
            class="mb-4 text-3xl font-bold text-[var(--header-color)] sm:text-4xl"
          >
            Why make research software reusable?
          </h2>

          <p class="font-onest text-lg text-[var(--text-color)]">
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
              class="inline-block rounded-lg bg-[var(--btn-bg)] px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--btn-bg-hover)] active:bg-[var(--btn-bg-active)] md:text-base"
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
          var(--radial-start) 0%,
          var(--radial-end) 90%
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
          <h2
            class="mb-4 text-3xl font-bold text-[var(--header-color)] sm:text-4xl"
          >
            Why should you use Codefair?
          </h2>

          <p class="text-lg text-[var(--text-color)]">
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
              class="text-[var(--link-color)] hover:text-[var(--link-hover)] active:text-[var(--link-color)]"
              >Zenodo</NuxtLink
            >, and much more to align with FAIR4RS principles.
          </p>
        </div>
      </div>

      <!-- Border bottom -->
      <!-- <div
        class="mx-auto max-w-screen-xl border-b-2 border-b-slate-300 bg-transparent"
      ></div> -->
    </section>

    <!-- SECTION 4: Codefair Stats -->
    <section
      style="
        background: radial-gradient(
          circle at center,
          var(--radial-start) 10%,
          var(--radial-end) 90%
        );
      "
      class="p-8 md:py-16"
    >
      <div class="mx-auto max-w-screen-xl px-4">
        <div
          class="relative overflow-hidden rounded-2xl border border-white/20 bg-[var(--stats-bg)] p-8 shadow-md md:p-12"
        >
          <!-- Floating blobs -->
          <div
            class="absolute -right-16 -top-16 h-48 w-48 animate-float-item rounded-full bg-[var(--blob-color-1)] mix-blend-multiply"
          ></div>

          <div
            class="absolute -bottom-16 -left-16 h-48 w-48 animate-float-item rounded-full bg-[var(--blob-color-2)] mix-blend-multiply"
          ></div>

          <dl class="relative grid grid-cols-1 gap-8 md:grid-cols-2">
            <div
              v-for="stat in statsList"
              :key="stat.endValue"
              class="group flex flex-col items-center space-y-4"
            >
              <!-- Icon circle -->
              <div
                class="rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 p-4 transition-transform duration-300 group-hover:scale-110"
              >
                <Icon :name="stat.icon" class="h-8 w-8 text-indigo-600" />
              </div>

              <!-- Count -->
              <dt class="text-5xl font-extrabold text-[var(--indigo-600-400)]">
                <count-up
                  :end-val="stat.endValue"
                  :start-val="stat.startValue"
                  :duration="2"
                  :autoplay="false"
                  :options="countupOptions"
                >
                  <template v-if="stat.suffix" #suffix>{{
                    stat.suffix
                  }}</template>
                </count-up>
              </dt>

              <!-- Label -->
              <dd class="text-lg font-medium text-[var(--text-color)]">
                {{ stat.text }}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>

    <!-- SECTION 5: Who are we? -->
    <section
      style="
        background: radial-gradient(
          circle at top,
          var(--radial-start) 0%,
          var(--radial-end) 90%
        );
      "
      class="backdrop-blur-xs p-8 md:py-16"
    >
      <div
        class="z-10 mx-auto flex max-w-screen-xl flex-col items-center gap-8 md:flex-row"
      >
        <div class="md:w-1/2">
          <h2
            class="mb-4 text-3xl font-bold text-[var(--header-color)] sm:text-4xl"
          >
            Who are we?
          </h2>

          <p class="text-lg text-[var(--text-color)]">
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
              class="inline-block rounded-lg bg-[var(--btn-bg)] px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--btn-bg-hover)] active:bg-[var(--btn-bg-active)] md:text-base"
            >
              <n-flex justify="between" align="center">
                <span>Learn more about us</span>

                <Icon name="ri:team-fill" size="16" />
              </n-flex>
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

    <!-- SECTION 6: Need help? -->
    <section
      style="
        background: radial-gradient(
          circle at center,
          var(--radial-start) 0%,
          var(--radial-end) 80%
        );
      "
      class="p-8 md:py-16"
    >
      <div class="z-10 mx-auto max-w-screen-xl">
        <div class="flex flex-col gap-8 md:flex-row-reverse md:items-center">
          <div class="md:w-1/2">
            <h2
              class="mb-4 text-3xl font-bold text-[var(--header-color)] sm:text-4xl"
            >
              Need help? Have suggestions? Want to contribute?
            </h2>

            <p class="mb-6 text-lg text-[var(--text-color)]">
              Reach out via the GitHub issues of the Codefair repo and we’ll be
              happy to connect with you. You can also use the Contact Us form at
              the bottom right of this page. We’re always looking for ways to
              make Codefair better!
            </p>

            <n-flex>
              <NuxtLink
                to="https://github.com/fairdataihub/codefair-app/issues"
                target="_blank"
                class="inline-block rounded-lg bg-[var(--btn-bg)] px-6 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-[var(--btn-bg-hover)] active:bg-[var(--btn-bg-active)] md:text-base"
              >
                <n-flex justify="between" align="center">
                  <Icon name="fa:github" size="16" />

                  <span>Open a GitHub issue</span>
                </n-flex>
              </NuxtLink>
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

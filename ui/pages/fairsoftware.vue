<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.hideBreadcrumbs();
</script>

<template>
  <section class="min-h-screen bg-purple-50">
    <!-- HERO SECTION: "FAIR Software" -->
    <section
      class="relative overflow-hidden bg-gradient-to-b from-white to-codefair-light py-12 md:py-24"
    >
      <!-- Grid pattern -->
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

      <div
        class="pointer-events-none relative z-20 mx-auto flex max-w-screen-xl flex-col items-center gap-10 px-4 sm:px-8 md:flex-row md:gap-16"
      >
        <div
          class="mt-8 flex flex-col items-center text-center md:mt-0 md:w-1/2 md:items-start md:text-left"
        >
          <h1
            class="mb-4 text-6xl font-extrabold leading-tight text-indigo-900 sm:text-5xl md:text-6xl"
          >
            FAIR Software
          </h1>

          <p class="font-onest text-gray-700 md:text-lg lg:text-xl">
            Making your research software FAIR doesn't have to be complicated!
            Embrace the guidelines and discover how Codefair can simplify the
            process.
          </p>
        </div>
      </div>
    </section>

    <!-- SECTION 1: "What is a research software?" -->
    <section
      style="
        background: radial-gradient(
          circle at bottom,
          white 0%,
          var(--codefair-light) 90%
        );
      "
    >
      <div class="relative z-10 mx-auto max-w-screen-xl py-10 md:px-8">
        <div class="flex flex-col py-8">
          <h2 class="mb-4 text-3xl font-bold text-indigo-900 sm:text-4xl">
            What is a research software?
          </h2>

          <p class="font-onest text-lg text-slate-800">
            The commonly accepted definition of research software is “Any
            software created during the research process or for a research
            purpose.” It can come in many formats and could be developed for
            different applications such as artificial intelligence (AI)/machine
            learning (ML) models with Python, data visualization tools with
            Jupyter notebook, or data analysis code with R.
          </p>

          <div class="mt-6">
            <a
              href="https://doi.org/10.5281/zenodo.5504016"
              target="_blank"
              class="inline-block rounded-lg bg-indigo-500 px-8 py-3 text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
            >
              Learn more ->
            </a>
          </div>
        </div>
      </div>

      <div
        class="mx-auto max-w-screen-xl border-b-2 border-b-indigo-200 bg-transparent"
      ></div>
    </section>

    <!-- SECTION 2: "What does making a research software FAIR mean?" -->
    <section
      style="
        background: radial-gradient(
          circle at top,
          white 0%,
          var(--codefair-light) 90%
        );
      "
      class="px-4 md:px-0"
    >
      <div class="mx-auto max-w-screen-xl py-10 md:px-8">
        <div class="flex flex-col py-8">
          <h2 class="mb-4 text-3xl font-bold text-indigo-900 sm:text-4xl">
            What does making a research software FAIR mean?
          </h2>

          <p class="text-lg text-slate-800">
            The FAIR (Findable, Accessible, Interoperable, Reusable) Principles
            for Research Software (FAIR4RS Principles) are a set of high-level
            instructions established by the research software community to make
            software reusable. Making research software FAIR means complying
            with each of the 17 FAIR principles.
          </p>

          <div class="mt-6">
            <NuxtLink
              to="https://doi.org/10.1038/s41597-022-01710-x"
              target="_blank"
              class="inline-block rounded-lg bg-indigo-500 px-8 py-3 text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
            >
              Learn more about the FAIR4RS principles ->
            </NuxtLink>
          </div>
        </div>
      </div>

      <div
        class="mx-auto max-w-screen-xl border-b-2 border-b-indigo-200 bg-transparent"
      ></div>
    </section>

    <!-- SECTION 3: "Why should you make your research software FAIR?" -->
    <section
      style="
        background: radial-gradient(
          circle at top,
          white 0%,
          var(--codefair-light) 90%
        );
      "
      class="px-4 md:px-0"
    >
      <div class="mx-auto max-w-screen-xl py-10 md:px-8">
        <div class="flex flex-col py-8">
          <h2 class="mb-4 text-3xl font-bold text-indigo-900 sm:text-4xl">
            Why should you make your research software FAIR?
          </h2>

          <p class="text-lg text-slate-800">
            Making software reusable is critical for many reasons including:
          </p>

          <ul class="list-inside list-disc text-lg text-slate-800">
            <li>Enable reproducible, transparent research</li>

            <li>Prevent duplicate effort</li>

            <li>Increase the pace of scientific discoveries and innovations</li>
          </ul>

          <p class="pt-2 text-lg text-slate-800">
            In addition to promoting good software development practices, making
            software FAIR can also benefit you personally:
          </p>

          <ol class="list-inside list-disc text-lg text-slate-800">
            <li>
              Gain recognition when your software is reused (proper citation)
            </li>

            <li>Increase collaboration opportunities</li>

            <li>
              Position yourself for more funding, as agencies like NIH and NSF
              are progressively requiring funded projects to make their software
              FAIR
            </li>
          </ol>
        </div>
      </div>

      <div
        class="mx-auto max-w-screen-xl border-b-2 border-b-indigo-200 bg-transparent"
      ></div>
    </section>

    <!-- SECTION 4: "What are the challenges of making software FAIR?" -->
    <section
      style="
        background: radial-gradient(
          circle at center,
          white 0%,
          var(--codefair-light) 90%
        );
      "
      class="px-4 md:px-0"
    >
      <div class="mx-auto max-w-screen-xl py-10 md:px-8">
        <div class="flex flex-col py-8">
          <h2 class="mb-4 text-3xl font-bold text-indigo-900 sm:text-4xl">
            What are the challenges of making software FAIR?
          </h2>

          <p class="text-lg text-slate-800">
            The FAIR4RS Principles, by design, are intended to provide a
            high-level framework for making software reusable and do not provide
            clear actionable instructions. Therefore, making software FAIR
            requires an in-depth understanding of each of the FAIR4RS Principles
            and figuring out how to practically comply with them.
          </p>
        </div>

        <!-- Solution 1: FAIR-BioRS guidelines -->
        <div class="flex flex-col py-8">
          <h2
            class="mb-4 text-xl font-bold text-indigo-900 md:mb-4 md:text-3xl"
          >
            Solution 1: FAIR-BioRS guidelines
          </h2>

          <p class="text-lg text-slate-800">
            To fill this gap, we established the FAIR Biomedical Research
            Software (FAIR-BioRS) guidelines, which are clear, step-by-step
            instructions for making biomedical research software FAIR. Although
            developed with biomedical software in mind, most elements apply to
            all research disciplines.
          </p>

          <div class="mt-6">
            <a
              href="https://doi.org/10.1038/s41597-022-01710-x"
              target="_blank"
              class="inline-block rounded-lg bg-indigo-500 px-8 py-3 text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
            >
              Learn more about the FAIR-BioRS guidelines ->
            </a>
          </div>
        </div>

        <!-- Solution 2: Codefair -->
        <div class="flex flex-col py-8">
          <h2
            class="mb-4 text-xl font-bold text-indigo-900 md:mb-4 md:text-3xl"
          >
            Solution 2: Codefair
          </h2>

          <p class="text-lg text-slate-800">
            While these guidelines are designed to be easy to follow, they can
            still be time-consuming to implement (we experienced this
            firsthand). That's why we developed Codefair: to make software FAIR
            without the hassle.
          </p>

          <div class="mt-6">
            <a
              href="/codefair"
              class="inline-block rounded-lg bg-indigo-500 px-8 py-3 text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
            >
              Learn more about Codefair ->
            </a>
          </div>
        </div>
      </div>

      <!-- Border bottom -->
      <!-- <div
        class="mx-auto max-w-screen-xl border-b-2 border-b-slate-300 bg-transparent"
      ></div> -->
    </section>
  </section>
</template>

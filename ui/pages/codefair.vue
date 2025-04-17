<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.hideBreadcrumbs();
</script>

<template>
  <main class="min-h-screen bg-purple-50">
    <!-- HERO SECTION for Codefair -->
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
            Codefair
          </h1>

          <p class="font-onest text-gray-700 md:text-lg lg:text-xl">
            Codefair automates the process of making your research software
            FAIR, so you can focus on innovation instead of administration.
          </p>

          <div class="pointer-events-auto mt-8">
            <NuxtLink
              to="http://fair-biors.org/"
              target="_blank"
              class="inline-block rounded-lg bg-indigo-500 px-8 py-3 text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
            >
              Learn more about the FAIR4RS principles ->
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- SECTION 1: How Codefair Works -->
    <section
      style="
        background: radial-gradient(
          circle at bottom,
          white 0%,
          var(--codefair-light) 90%
        );
      "
      class="px-4 md:px-0"
    >
      <!-- Content -->
      <div class="z-10 mx-auto max-w-screen-xl py-12 text-center">
        <h2 class="mb-4 text-3xl font-bold text-indigo-900 sm:text-4xl">
          How Codefair Works
        </h2>

        <p class="text-justify font-onest text-lg text-slate-800">
          Codefair is a free and open-source GitHub app that integrates with
          your GitHub repositories to monitor key activities, generate key
          metadata files and automatically generate pull requests for
          compliance. It is design to help make your research software FAIR by
          checking for compliance with the FAIR4RS principles.
        </p>

        <div class="mt-6">
          <NuxtLink
            to="https://github.com/fairdataihub/codefair-app"
            target="_blank"
            class="inline-block rounded-lg bg-indigo-500 px-8 py-3 text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-200 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
          >
            Get Codefair ->
          </NuxtLink>
        </div>
      </div>

      <!-- 3 Images -->
      <div
        class="mx-auto grid max-w-screen-xl grid-cols-1 gap-8 pb-16 sm:grid-cols-3"
      >
        <div class="relative aspect-square w-[26rem]">
          <n-image
            src="/assets/images/latest-dashboard.png"
            alt="Dashboard"
            loading="lazy"
            class="rounded-lg object-contain shadow-lg"
          />
        </div>

        <div class="relative aspect-square w-[26rem]">
          <n-image
            src="/assets/images/metadata-ui.png"
            alt="Metadata UI"
            loading="lazy"
            class="rounded-lg object-contain shadow-lg"
          />
        </div>

        <div class="relative aspect-square w-[26rem]">
          <n-image
            src="/assets/images/zenodo-top.png"
            alt="Zenodo Release UI"
            loading="lazy"
            class="rounded-lg object-contain shadow-lg"
          />
        </div>
      </div>
    </section>

    <!-- SECTION 2: Who should use Codefair? -->
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
      <!-- Border top -->
      <div
        class="mx-auto max-w-screen-xl border-t-2 border-t-indigo-200 bg-transparent px-4"
      ></div>

      <!-- Content -->
      <div
        class="mx-auto flex max-w-screen-xl flex-col-reverse items-center gap-8 py-16 md:flex-row"
      >
        <div class="md:w-1/2">
          <h2 class="mb-4 text-3xl font-bold text-indigo-900 sm:text-4xl">
            Who should use Codefair?
          </h2>

          <p class="font-onest text-lg text-slate-800">
            Currently, Codefair helps make software FAIR by following the FAIR
            Biomedical Research Software (FAIR-BioRS) guidelines. However, most
            of the steps in the FAIR-BioRS guidelines are applicable to any
            research software, regardless of the field. This means that anyone
            developing research software can use Codefair. Whether you are
            developing artificial intelligence (AI)/machine learning (ML) models
            with Python, data visualization tools with Jupyter Notebook, or data
            analysis code with R, Codefair is here to assist you.
          </p>
        </div>

        <div class="pointer-events-none flex justify-center md:w-1/2">
          <img
            src="/assets/images/Saly-22.png"
            alt="Info image"
            loading="lazy"
            class="w-[15rem] md:w-[20rem]"
          />
        </div>
      </div>

      <!-- Border bottom -->
      <div
        class="mx-auto max-w-screen-xl border-b-2 border-b-indigo-200 bg-transparent px-4"
      ></div>
    </section>

    <!-- SECTION 3: How is Codefair developed? -->
    <section
      style="
        background: radial-gradient(
          circle at bottom,
          white 0%,
          var(--codefair-light) 90%
        );
      "
      class="px-4 md:px-0"
    >
      <div
        class="mx-auto flex max-w-screen-xl flex-col items-center gap-8 py-16 md:flex-row"
      >
        <div class="pointer-events-none flex justify-center md:w-1/2">
          <img
            src="/assets/images/Saly-39.png"
            alt="Info image"
            loading="lazy"
            class="w-[15rem] md:w-[20rem]"
          />
        </div>

        <div class="md:w-1/2">
          <h2 class="mb-4 text-3xl font-bold text-indigo-900 sm:text-4xl">
            How is Codefair developed?
          </h2>

          <p class="font-onest text-lg text-slate-800">
            Codefair is developed using
            <NuxtLink
              to="https://probot.github.io"
              target="_blank"
              class="text-indigo-700 hover:text-indigo-500 active:text-indigo-700"
              >Probot</NuxtLink
            >
            and is deployed on our own servers. The GitHub app is configured to
            receive webhooks for important actions such as pushing code, opening
            or closing issues, opening or merging pull requests, and commenting
            on discussions. The app is written in
            <NuxtLink
              to="https://nodejs.org/en"
              target="_blank"
              class="text-indigo-700 hover:text-indigo-500 active:text-indigo-700"
              >Node.js</NuxtLink
            >

            and utilizes the
            <NuxtLink
              to="https://github.com/octokit/octokit.js"
              target="_blank"
              class="text-indigo-700 hover:text-indigo-500 active:text-indigo-700"
              >Octokit Library</NuxtLink
            >
            to interact with the GitHub API, enabling seamless integration with
            GitHub's features and functionality.
            <NuxtLink
              to="https://zenodo.org/"
              target="_blank"
              class="text-indigo-700 hover:text-indigo-500 active:text-indigo-700"
              >Zenodo Archival</NuxtLink
            >, metadata generation, and pull request creation are all handled by
            the app.
          </p>
        </div>
      </div>

      <!-- Border bottom -->
      <!-- <div
        class="mx-auto max-w-screen-xl border-b-2 border-b-slate-300 bg-transparent px-4"
      ></div> -->
    </section>
  </main>
</template>

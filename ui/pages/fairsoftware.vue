<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.hideBreadcrumbs();
</script>

<template>
  <section>
    <div class="bg-[#e7ddfa4f] py-8">
      <div class="mx-auto max-w-screen-xl px-4 md:px-8">
        <div class="flex justify-start">
          <h1
            class="font-inter mb-4 text-4xl font-bold text-black sm:text-5xl md:text-5xl"
          >
            FAIR Software
          </h1>
        </div>
      </div>
    </div>

    <div class="mx-auto flex max-w-screen-xl justify-start px-4 md:px-8">
      <div class="flex max-w-screen-xl flex-col py-8">
        <div class="flex flex-col">
          <h2
            class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
          >
            What is a research software?
          </h2>

          <p class="font-onest text-lg text-slate-800">
            The commonly accepted definition of research software is “Any
            software created during the research process or for a research
            purpose”. It can come in many formats and could be developed for
            different applications such as artificial intelligence (AI)/machine
            learning (ML) models with Python, data visualization tools with
            Jupyter notebook, or data analysis code with R.
          </p>
        </div>

        <div
          class="flex flex-col gap-2.5 py-8 sm:flex-row sm:justify-center lg:justify-start"
        >
          <a
            href="https://doi.org/10.5281/zenodo.5504016"
            class="inline-block w-3/5 self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:w-auto md:text-base"
            >Learn more -></a
          >
        </div>
      </div>
    </div>

    <div class="bg-[#e7ddfa4f]">
      <div class="mx-auto flex max-w-screen-xl justify-start px-4 md:px-8">
        <div class="mt-8 flex h-auto max-w-screen-xl flex-col py-8">
          <div class="flex flex-col">
            <h2
              class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
            >
              What does making a research software FAIR means?
            </h2>

            <p class="font-onest text-lg text-slate-800">
              The FAIR (Findable, Accessible, Interoperable, Reusable)
              Principles for Research Software (FAIR4RS Principles) are a set of
              high-level instructions established by the research software
              community to make software reusable. Making research software FAIR
              means complying with each of the 17 FAIR principles.
            </p>
          </div>

          <div
            class="flex flex-col gap-2.5 py-8 sm:flex-row sm:justify-center lg:justify-start"
          >
            <a
              href="https://doi.org/10.1038/s41597-022-01710-x"
              class="inline-block w-3/5 self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:w-auto md:text-base"
              >Learn more about the FAIR4RS principles -></a
            >
          </div>
        </div>
      </div>
    </div>

    <div class="">
      <div class="mx-auto flex max-w-screen-xl justify-start px-4 md:px-8">
        <div class="my-8 flex h-auto max-w-screen-xl flex-col py-8">
          <div class="flex flex-col">
            <h2
              class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
            >
              Why should you make your research software FAIR?
            </h2>

            <div>
              <p class="font-onest text-lg text-slate-800">
                Making software reusable is critical for many reason including
                to:
              </p>

              <ul
                class="font-onest list-inside list-disc text-base text-slate-800"
              >
                <li>Enable reproducible, transparent research</li>

                <li>Prevent duplicate effort</li>

                <li>
                  Increase the pace of scientific discoveries and innovations
                </li>
              </ul>

              <p class="font-onest pt-2 text-lg text-slate-800">
                In addition to promoting software development practices, making
                software FAIR can also benefit you personally:
              </p>

              <ol
                class="font-onest list-inside list-disc text-base text-slate-800"
              >
                <li>
                  Get recognition when your software is reused through proper
                  citation
                </li>

                <li>Increase collaboration opportunities</li>

                <li style="text-wrap: nowrap">
                  Position yourself for more funding opportunities as funding
                  agencies such as NIH and NSF are progressively requiring
                  funded projects to make their software FAIR
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-[#e7ddfa4f]">
      <div
        class="mx-auto flex max-w-screen-xl flex-col justify-start px-4 py-4 md:px-8 md:py-8"
      >
        <div class="my-4 flex flex-col">
          <h2
            class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
          >
            What are the challenges of making software FAIR?
          </h2>

          <p class="font-onest text-lg text-slate-800">
            The FAIR4RS Principles, by design, are intended to provide a
            high-level framework for making software reusable and do not provide
            clear actionable instructions. Therefore, making software FAIR
            requires an in-depth understanding of each of the FAIR4RS
            Principles, and finding out how to practically comply with them.
          </p>
        </div>

        <div class="flex flex-col py-8">
          <h2 class="mb-4 text-xl font-bold text-black md:mb-4 md:text-3xl">
            Solution 1: FAIR-BioRS guidelines
          </h2>

          <p class="font-onest text-lg text-slate-800">
            To fill this gap, we established the FAIR Biomedical Research
            Software (FAIR-BioRS) guideline, which are clear, actionable, and
            step-by-step guidelines for making biomedical research software
            FAIR. Although they were developed with biomedical research software
            in mind, most elements of the guidelines are applicable to all
            software irrespective of their research discipline.
          </p>
        </div>

        <div
          class="flex flex-col gap-2.5 sm:flex-row sm:justify-center lg:justify-start"
        >
          <a
            href="https://doi.org/10.1038/s41597-022-01710-x"
            class="inline-block w-3/5 self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:w-auto md:text-base"
            >Learn more about the FAIR-BioRS guidelines -></a
          >
        </div>

        <div class="flex flex-col py-8" style="margin-top: 2rem">
          <h2 class="mb-4 text-xl font-bold text-black md:mb-4 md:text-3xl">
            Solution 2: Codefair
          </h2>

          <p class="font-onest text-lg text-slate-800">
            While these guidelines are designed to be easy to follow, they can
            still be time consuming and difficult to implement (we experienced
            this firsthand). This is why we are developing Codefair, so that
            making your software FAIR is seamless.
          </p>
        </div>

        <div
          class="flex flex-col gap-2.5 sm:flex-row sm:justify-center lg:justify-start"
        >
          <a
            href="/codefair"
            class="inline-block w-3/5 self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:w-auto md:text-base"
            >Learn more about Codefair -></a
          >
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.hideBreadcrumbs();
</script>

<template>
  <section>
    <div class="">
      <div class="mx-auto flex max-w-screen-xl justify-start px-4 md:px-8">
        <div class="flex w-full flex-col py-8">
          <div class="flex flex-col">
            <h2
              class="mb-4 self-center bg-gradient-to-b from-[#6366f1] to-[#64748b] bg-clip-text text-xl font-bold text-transparent sm:text-5xl md:mb-4 md:text-4xl"
            >
              What is Codefair?
            </h2>

            <p
              class="font-onest max-w-screen-sm self-center text-center text-lg"
            >
              Codefair is a free and open source GitHub app that acts as your
              personal assistant when it comes to making your research software
              reusable and especially complying with the Findable, Accessible,
              Interoperable, Reusable (FAIR) Principles for Research Software
              (FAIR4RS Principles).
            </p>
          </div>

          <div
            class="flex flex-col gap-2.5 pb-10 pt-4 sm:flex-row sm:justify-center lg:justify-center"
          >
            <a
              href="http://fair-biors.org/"
              class="inline-block w-auto self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
              >Learn more about the FAIR4RS principles -></a
            >
          </div>

          <n-flex justify="space-around">
            <img
              src="/assets/images/dashboard.png"
              loading="lazy"
              alt="Info image"
              style="height: 30rem"
              class="rounded-lg"
            />

            <img
              src="/assets/images/metadata-ui.png"
              loading="lazy"
              alt="Info image"
              style="height: 30rem"
              class="rounded-lg"
            />
          </n-flex>
        </div>
      </div>
    </div>

    <div class="bg-[#e7ddfa4f]">
      <div class="mx-auto flex max-w-screen-xl justify-start px-4 md:px-8">
        <div class="my-8 flex h-auto max-w-screen-xl flex-col py-8">
          <div class="flex flex-col">
            <h2
              class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
            >
              How does Codefair work?
            </h2>

            <p class="font-onest text-lg text-slate-800">
              Simply install Codefair from the GitHub marketplace on your
              software's GitHub repository. By communicating with you through
              GitHub issues and submitting pull requests, Codefair will ensure
              that your software follows best coding practices, provides
              metadata in standard formats, includes a license file, is archived
              on Zenodo, and much more to align with the FAIR4RS principles.
            </p>
          </div>

          <div
            class="flex flex-col gap-2.5 py-8 sm:flex-row sm:justify-center lg:justify-start"
          >
            <a
              href="https://github.com/fairdataihub/codefair-app"
              class="inline-block w-auto self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
              >View the source code -></a
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
              Who should use Codefair?
            </h2>

            <p class="font-onest text-lg text-slate-800">
              Currently, Codefair helps make software FAIR by following the FAIR
              Biomedical Research Software (FAIR-BioRS) guidelines. Therefore,
              it is designed mainly for biomedical research software. However,
              most of the steps in the FAIR-BioRS guidelines are applicable to
              any research software, regardless of the field. This means that
              anyone developing research software can use Codefair. Whether you
              are developing artificial intelligence (AI)/machine learning (ML)
              models with Python, data visualization tools with Jupyter
              Notebook, or data analysis code with R, Codefair is here to assist
              you.
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-[#e7ddfa4f]">
      <div class="mx-auto flex max-w-screen-xl justify-start px-4 md:px-8">
        <div class="my-8 flex h-auto max-w-screen-xl flex-col py-8">
          <h2
            class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
          >
            How is Codefair developed?
          </h2>

          <p class="font-onest text-lg text-slate-800">
            Codefair is developed using Probot and is deployed on our own
            servers. The GitHub app is configured to receive webhooks for
            important actions such as pushing code, opening or closing issues,
            opening or merging pull requests, and commenting on discussions. The
            app is written in Node.js and utilizes the Octokit library to
            interact with the GitHub API, enabling seamless integration with
            GitHub's features and functionality.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

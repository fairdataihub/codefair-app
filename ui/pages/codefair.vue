<script setup lang="ts"></script>

<template>
  <section>
    <div class="bg-[#e7ddfa4f] py-8">
      <div class="mx-auto max-w-screen-xl px-4 md:px-8">
        <div class="flex justify-start">
          <h1
            class="font-inter mb-4 text-4xl font-bold text-black sm:text-5xl md:mb-4 md:text-5xl"
          >
            About codefair
          </h1>
        </div>
      </div>
    </div>

    <div class="">
      <div class="mx-auto flex max-w-screen-xl justify-start px-4 md:px-8">
        <div class="flex max-w-screen-xl flex-col py-8">
          <div class="flex flex-col">
            <h2
              class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
            >
              What is codefair?
            </h2>

            <p>
              codefair is a free and open source GitHub app that acts as your
              personal assistant when it comes to making your research software
              reusable and especially complying with the Findable, Accessible,
              Interoperable, Reusable (FAIR) Principles for Research Software
              (FAIR4RS Principles).
            </p>
          </div>

          <div
            class="flex flex-col gap-2.5 py-8 sm:flex-row sm:justify-center lg:justify-start"
          >
            <a
              href="http://fair-biors.org/"
              class="inline-block w-auto self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
              >Learn more about the FAIR4RS principles -></a
            >
          </div>
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
              How does codefair work?
            </h2>

            <p>
              Just install codefair from the GitHub marketplace on your
              software's GitHub repository. By communicating with you through
              GitHub issues and submitting pull requests, codefair will then
              make sure that your software follows best coding practices,
              provides metadata in standard format, includes a license file, is
              archived on Zenodo, and much more to align with the FAIR4RS
              principles.
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
              Who should use codefair?
            </h2>

            <div>
              <p>
                Currently, codefair helps make software FAIR by following the
                FAIR Biomedical Research software (FAIR-BioRS) guidelines.
                Therefore it is design mainly for biomedical research software.
                However, most of the steps of the FAIR-BioRS guidelines are
                applicable to any research software irrespective of the field of
                research. Therefore, anyone developing a research software can
                use codefair. Whether you are developing artificial intelligence
                (AI)/machine learning (ML) models with Python, data
                visualization tools with Jupyter notebook, or data analysis code
                with R, codefair is here to assist you.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-[#e7ddfa4f]">
      <div class="mx-auto flex max-w-screen-xl justify-start px-4 md:px-8">
        <div class="my-8 flex max-w-lg flex-col py-8">
          <h2
            class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
          >
            How is codefair developed?
          </h2>

          <p>
            codefair is developed using Probot and is deployed on Vercel as a
            serverless function. The GitHub app is configured to receive
            webhooks for important actions such as pushing code, opening or
            closing issues, opening or merging pull requests, and commenting on
            discussions. By leveraging a serverless environment on Vercel,
            codefair can automatically scale to handle the workload of the
            GitHub app. The app is written in Node.js and utilizes the Octokit
            library to interact with the GitHub API, enabling seamless
            integration with GitHub's features and functionality.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

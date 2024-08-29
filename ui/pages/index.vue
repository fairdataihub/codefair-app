<script setup lang="ts">
import { useBreadcrumbsStore } from "@/stores/breadcrumbs";

const breadcrumbsStore = useBreadcrumbsStore();

breadcrumbsStore.hideBreadcrumbs();
</script>

<template>
  <main>
    <section
      class="mx-auto mt-10 flex max-w-screen-xl flex-col justify-between gap-6 px-4 sm:gap-10 md:gap-16 md:px-8 lg:flex-row"
    >
      <div
        class="flex flex-col justify-center sm:text-center lg:pb-12 lg:text-left xl:w-5/12 xl:pb-24"
      >
        <h1
          class="mb-4 text-4xl font-bold text-black sm:text-5xl md:mb-4 md:text-5xl"
        >
          Make your research software reusable without breaking a sweat!
        </h1>

        <p class="font-onest text-gray-600 lg:w-full xl:text-xl">
          Let Codefair handle the complexities of making your research software
          FAIR, so you can focus on what matters most to you.
        </p>

        <div
          class="mt-8 flex flex-col gap-2.5 sm:flex-row sm:justify-center md:mt-8 lg:justify-start"
        >
          <NuxtLink
            to="https://github.com/marketplace/codefair-app"
            target="_blank"
            class="mb-4 inline-block w-4/5 self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-base font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:w-auto md:text-lg lg:mb-0"
          >
            Get Codefair ->
          </NuxtLink>
        </div>
      </div>

      <div
        class="animate-float-item relative hidden h-48 lg:flex lg:h-auto xl:w-5/12"
      >
        <img
          src="/assets/images/second_layer_hero.png"
          loading="lazy"
          alt="Hero image"
          class="animate-float-opposite absolute left-24 top-8 h-[25rem] w-[25rem] object-cover object-center"
        />

        <img
          src="/assets/images/first_layer_hero.png"
          loading="lazy"
          alt="Hero image"
          class="animate-float-item h[25rem]- absolute -left-[4rem] top-10 w-[25rem] object-cover object-center"
        />
      </div>
    </section>

    <section class="w-full bg-[#e7ddfa4f] py-4 md:py-8">
      <div
        class="mx-auto flex max-w-screen-xl flex-col-reverse justify-between md:flex-row"
      >
        <div class="flex-2 self-center">
          <img
            src="/assets/images/Saly-38.png"
            loading="lazy"
            alt="Info image"
            class="h-[15rem] w-[15rem] md:h-[25rem] md:w-[25rem]"
          />
        </div>

        <div class="flex max-w-2xl flex-1 flex-col justify-evenly p-4">
          <div class="flex flex-col">
            <h2
              class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
            >
              What is Codefair?
            </h2>

            <p class="font-onest text-lg text-slate-800">
              Codefair is a free and open source GitHub app that acts as your
              personal assistant when it comes to making your research software
              reusable and especially complying with the
              <NuxtLink
                to="https://www.nature.com/articles/s41597-022-01710-x"
                class="text-indigo-700 hover:text-indigo-500 active:text-indigo-700"
                >Findable, Accessible, Interoperable, Reusable (FAIR) Principles
                for Research Software (FAIR4RS Principles)</NuxtLink
              >. Whether you are developing artificial intelligence (AI)/machine
              learning (ML) models with Python, data visualization tools with
              Jupyter notebook, or data analysis code with R, Codefair is here
              to assist you.
            </p>
          </div>

          <div
            class="flex flex-col gap-2.5 py-8 sm:flex-row sm:justify-center lg:justify-start lg:py-0"
          >
            <NuxtLink
              to="https://github.com/fairdataihub/codefair-app"
              target="_blank"
              class="inline-block w-3/5 self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:w-auto md:text-base"
            >
              View the source code ->
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <section class="py-4 md:py-8">
      <div
        class="mx-auto flex max-w-screen-xl flex-col justify-between md:flex-row"
      >
        <div class="flex max-w-2xl flex-1 flex-col justify-evenly p-4">
          <div class="flex flex-col">
            <h2
              class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
            >
              Why make research software reusable?
            </h2>

            <p class="font-onest text-lg text-slate-800">
              Making research software FAIR, i.e. optimally reusable, is
              critical to enable reproducible and transparent research, prevent
              duplicate effort and ultimately increase the pace of new
              scientific discoveries. Also, more and more funding agencies such
              as the NIH and NSF are requiring research software to be reusable.
            </p>
          </div>

          <div
            class="flex flex-col gap-2.5 py-8 sm:flex-row sm:justify-center lg:justify-start lg:py-0"
          >
            <NuxtLink
              to="fairsoftware"
              class="inline-block w-auto self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
            >
              Learn more about FAIR software ->
            </NuxtLink>
          </div>
        </div>

        <div class="flex-2 self-center">
          <img
            src="/assets/images/Other 08.png"
            loading="lazy"
            alt="Info image"
            class="h-[15rem] w-[15rem] md:h-[25rem] md:w-[25rem]"
          />
        </div>
      </div>
    </section>

    <section class="bg-[#e7ddfa4f] py-4 md:py-8">
      <div
        class="mx-auto flex max-w-screen-xl flex-col-reverse justify-between lg:flex-row"
      >
        <div class="flex-2 self-center">
          <img
            src="/assets/images/Saly-16.png"
            loading="lazy"
            alt="Info image"
            class="h-[15rem] w-[15rem] md:h-[25rem] md:w-[25rem]"
          />
        </div>

        <div class="flex max-w-2xl flex-1 flex-col justify-evenly p-4">
          <div class="flex flex-col">
            <h2
              class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
            >
              Why should you use Codefair?
            </h2>

            <p class="font-onest text-lg text-slate-800">
              With Codefair, you do not have to think about making your software
              FAIR. Just install Codefair from the GitHub marketplace on your
              software's GitHub repository. You can then track FAIR-compliance
              issues through the Codefair issue dashboard and address them
              through the Codefair website. Through intuitive interfaces and
              automated pull requests, Codefair will allow you to make sure that
              your software follows best coding practices, provides metadata in
              standard format, includes a license file, is archived on
              <NuxtLink
                to="https://zenodo.org/"
                class="text-indigo-700 hover:text-indigo-500 active:text-indigo-700"
                >Zenodo</NuxtLink
              >, and much more to align with the FAIR4RS principles.
            </p>
          </div>

          <div
            class="flex flex-col gap-2.5 py-8 sm:flex-row sm:justify-center md:py-0 lg:justify-start"
          >
            <NuxtLink
              to="codefair"
              class="inline-block w-auto self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:text-base"
            >
              Learn more about Codefair ->
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <section class="py-4 md:py-8">
      <div
        class="mx-auto flex max-w-screen-xl flex-col justify-between lg:flex-row"
      >
        <div class="flex max-w-2xl flex-1 flex-col justify-evenly p-4">
          <div>
            <h2
              class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
            >
              Who are we?
            </h2>

            <p class="font-onest text-lg text-slate-800">
              Codefair is being developed by the FAIR Data Innovations Hub team,
              a division of the nonprofit biomedical research facility,
              California Medical Innovations Institute. As developers of
              research software, we have experienced firsthand the challenges of
              making software FAIR, which prompted us to develop Codefair. The
              project is not receiving any financial support yet, but we hope to
              secure funding in the future so we can dedicate more time and
              effort to this much-needed tool. We would also love for others to
              join us in this effort!
            </p>
          </div>

          <div
            class="flex flex-col gap-2.5 py-8 sm:flex-row sm:justify-center md:py-0 lg:justify-start"
          >
            <NuxtLink
              to="https://fairdataihub.org/"
              target="_blank"
              class="inline-block w-3/5 self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:w-auto md:text-base"
            >
              Learn more about us ->
            </NuxtLink>
          </div>
        </div>

        <div class="self-center">
          <img
            src="/assets/images/DRIP_18.png"
            loading="lazy"
            alt="Info image"
            class="h-[15rem] w-[15rem] md:h-[25rem] md:w-[25rem]"
          />
        </div>
      </div>
    </section>

    <section class="bg-[#e7ddfa4f] py-4 md:py-8">
      <div
        class="mx-auto flex max-w-screen-xl flex-col-reverse justify-between lg:flex-row"
      >
        <div class="self-center">
          <img
            src="/assets/images/Other 02.png"
            loading="lazy"
            alt="Info image"
            class="h-[15rem] w-[15rem] md:h-[25rem] md:w-[25rem]"
          />
        </div>

        <div class="flex max-w-2xl flex-1 flex-col justify-evenly p-4">
          <div>
            <h2
              class="mb-4 text-xl font-bold text-black sm:text-5xl md:mb-4 md:text-4xl"
            >
              Need help? Have suggestions? Want to contribute?
            </h2>

            <p class="font-onest text-lg text-slate-800">
              Reach out to us via the GitHub issues of the Codefair repo and we
              will be happy to connect with you. You may also use the Contact Us
              form at the bottom right of this page to send us a message. We are
              always looking for ways to make Codefair better!
            </p>
          </div>

          <div
            class="flex flex-col gap-2.5 py-8 sm:flex-row sm:justify-center md:-mt-8 md:py-0 lg:justify-start"
          >
            <NuxtLink
              to="https://github.com/fairdataihub/codefair-app/issues"
              target="_blank"
              class="align-center flex w-3/5 justify-center self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:w-auto md:text-base"
            >
              <span class="ml-4">Open a GitHub issue</span>

              <Icon name="fa:github" size="25" />
            </NuxtLink>

            <NuxtLink
              to="https://docs.codefair.io/"
              target="_blank"
              class="inline-block w-3/5 self-center rounded-lg bg-indigo-500 px-8 py-3 text-center text-sm font-semibold text-white outline-none ring-indigo-300 transition duration-100 hover:bg-indigo-600 focus-visible:ring active:bg-indigo-700 md:w-auto md:text-base"
            >
              Read the Documentation ->
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

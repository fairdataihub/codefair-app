<script setup lang="ts"></script>

<template>
  <section>
    <div class="py-8">
      <div class="mx-auto max-w-screen-xl px-4 md:px-8">
        <div class="flex justify-start">
          <h1
            class="font-inter mb-4 text-4xl font-bold text-black sm:text-5xl md:text-5xl"
          >
            Frequently Asked Questions
          </h1>
        </div>
      </div>
    </div>

    <div
      class="mx-auto grid max-w-screen-xl px-4 pt-8 text-left md:grid-cols-2 md:gap-x-8 md:px-8 dark:border-gray-700"
    >
      <div class="mb-10">
        <h3
          class="mb-4 flex items-start text-lg font-medium text-gray-900 dark:text-white"
        >
          <Icon name="ri:question-fill" class="mr-2 mt-1" />
          Why are there two GitHub apps with Codefair?
        </h3>

        <p class="ml-4 text-gray-500 dark:text-gray-400">
          Codefair has two GitHub apps to provide different features. The main
          app is used to handle the main tasks of Codefair, such as creating
          issues, checking your repositories, and more. We also use a GitHub
          OAuth app to allow you to sign in with GitHub. This OAuth app is used
          to ensure that only you have access to the data that you provide to
          Codefair. If you add Codefair to an organization, we also use the
          OAuth app to ensure that we have the correct permissions to access the
          organization's data.
        </p>
      </div>

      <div class="mb-10">
        <h3
          class="mb-4 flex items-start text-lg font-medium text-gray-900 dark:text-white"
        >
          <Icon name="ri:question-fill" class="mr-2 mt-1" />
          Why am I having trouble accessing my Organization's repositories on
          Codefair?
        </h3>

        <p class="ml-4 text-gray-500 dark:text-gray-400">
          You may need to grant Codefair access to your organization so that we
          can verify you have access to the organization you are trying to
          access. If we are unable to verify your access, you will not be able
          to access any data on the organization's repositories. To grant
          Codefair access to your organization, you can visit the organization's
          settings page on GitHub and add Codefair as an OAuth app.
        </p>
      </div>
    </div>
  </section>
</template>

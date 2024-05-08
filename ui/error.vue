<script setup lang="ts"></script>

<template>
  <NuxtLayout name="default">
    <main class="grid place-items-center px-6 lg:px-8">
      <div class="text-center">
        <img
          src="/assets/images/error/404.svg"
          alt="Page not found"
          class="mx-auto w-96"
        />

        <h1
          class="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-5xl"
        >
          Something went wrong
        </h1>

        <p class="mt-6 text-base leading-7 text-gray-600">
          The page you are looking for might have been removed or is temporarily
          unavailable.
        </p>
      </div>
    </main>
  </NuxtLayout>
</template>

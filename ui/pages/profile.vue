<script setup lang="ts">
definePageMeta({
  //   layout: "public",
  middleware: ["protected"],
});
const user = useUser();
</script>

<template>
  <section
    class="container mx-auto flex max-w-screen-xl flex-col justify-between gap-6 px-4 sm:gap-10 md:gap-16 md:px-8 lg:flex-row"
  >
    <h1>Profile</h1>
    <pre>{{ user }}</pre>

    <!-- <pre>{{ user.username }}</pre> -->
    <!-- <ProfileStatus /> -->
  </section>
</template>

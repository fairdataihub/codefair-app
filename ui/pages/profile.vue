<script setup lang="ts">
definePageMeta({
  //   layout: "public",
  middleware: ["protected"],
});
const user = useUser();
</script>

<template>
  <section class="mx-auto max-w-screen-xl p-4">
    <h1>Profile</h1>
    <pre>{{ user }}</pre>

    <!-- <pre>{{ user.username }}</pre> -->
    <!-- <ProfileStatus /> -->
  </section>
</template>

<script setup lang="ts">
definePageMeta({
//   layout: "public",
  middleware: ['protected'],
});
</script>

<template>
    <section
    class="container mx-auto flex max-w-screen-xl flex-col justify-between gap-6 px-4 sm:gap-10 md:gap-16 md:px-8 lg:flex-row"
    >
        <!-- <pre>{{ user.username }}</pre> -->
        <ProfileStatus />
    </section>
</template>
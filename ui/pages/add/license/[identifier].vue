<script setup lang="ts">
definePageMeta({
  // middleware: ["protected"],
});

const { data, error } = await useFetch("/api/workspaces", {
  headers: useRequestHeaders(["cookie"]),
});

if (error.value) {
  console.log(error.value);

  push.error({
    title: "Something went wrong",
    message: "Please contact support",
  });

  navigateTo("/");
}
</script>

<template>
  <main class="">hello</main>
</template>

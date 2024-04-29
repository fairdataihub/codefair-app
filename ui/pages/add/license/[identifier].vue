<script setup lang="ts">
// definePageMeta({
// middleware: ["protected"],
// });

const route = useRoute();

const { identifier } = route.params as { identifier: string };

const { data, error } = await useFetch(`/api/license/${identifier}`, {
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
  <main class="">
    {{ data }}
  </main>
</template>

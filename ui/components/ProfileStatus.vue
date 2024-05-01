<script setup lang="ts">
const user = useUser();
console.log(user);

async function logout() {
  await $fetch("/api/logout", {
    method: "POST",
  });
  await navigateTo("/");
}
</script>

<template>
  <pre>{{ user }}</pre>
  <NuxtLink
    v-if="user"
    @click="logout"
    class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
  >
    Logout
  </NuxtLink>
  <NuxtLink
    v-else
    href="/login"
    class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
  >
    Sign In
  </NuxtLink>

</template>
<script setup lang="ts">
definePageMeta({
  // layout: "public",
  // middleware: ['protected', 'auth'],
});
const user = useUser();

async function logout() {
  await $fetch("/api/logout", {
    method: "POST",
  });
  await navigateTo("/");
}
</script>

<template>
            <NuxtLink
              v-if="user"
              @click="logout"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
            >
              Logout
            </NuxtLink>
            <NuxtLink
              v-else
              href="login"
              class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
            >
              Sign In
            </NuxtLink>

</template>
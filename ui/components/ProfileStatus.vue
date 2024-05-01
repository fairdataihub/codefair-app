<script setup lang="ts">
const user = useAuthenticatedUser();
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
  <button
    v-if="user"
    @click="logout"
    class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
  >
    Logout
</button>
  <button
    v-else
    href="/login"
    class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
  >
    Sign In
  </button>

</template>
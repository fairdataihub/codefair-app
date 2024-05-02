<script setup lang="ts">
const user = useUser();

const loggedIn = computed(() => !!user.value);

async function logout() {
  await $fetch("/api/logout", {
    method: "POST",
  });
  window.location.href = "/";
}
</script>

<template>
  <n-flex v-if="loggedIn" align="center">
    <NuxtLink
      to="/profile"
      class="text-lg font-bold text-gray-600 transition duration-100 hover:text-indigo-500 active:text-indigo-700"
    >
      Profile
    </NuxtLink>

    <n-button color="black" @click="logout"> Sign Out </n-button>
  </n-flex>

  <NuxtLink to="/login" v-else>
    <n-button color="black"> Sign In </n-button>
  </NuxtLink>
</template>

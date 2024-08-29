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
    <NuxtLink :to="`/`" class="flex items-center">
      <n-avatar
        round
        :src="`https://avatars.githubusercontent.com/u/${user?.github_id}?v=4`"
        :fallback-src="`https://api.dicebear.com/8.x/adventurer/svg?seed=${user?.github_id}`"
        class="transition-all hover:opacity-90"
      />
    </NuxtLink>

    <n-button color="black" @click="logout"> Sign Out </n-button>
  </n-flex>

  <div v-else>
    <a href="/login/github">
      <n-button color="black">
        <template #icon>
          <Icon name="bi:github" />
        </template>

        Sign in with GitHub
      </n-button>
    </a>
  </div>
</template>

<script setup lang="ts">
const user = useUser();

watchEffect(() => {
  if (user.value) {
    return navigateTo("/");
  }
});
</script>

<template>
  <main class="flex h-full w-full justify-center">
    <div
      class="mt-20 flex h-max max-w-lg flex-col items-center rounded-lg border bg-white p-6 shadow-sm"
    >
      <img
        src="https://www.svgrepo.com/show/219383/login.svg"
        alt="login"
        class="my-3 h-20 w-20"
      />

      <a href="/login/github" class="py-4">
        <n-button color="black" size="large">
          <template #icon>
            <Icon name="bi:github" />
          </template>

          Sign in with GitHub
        </n-button>
      </a>

      <p class="pt-3 text-center">
        Your GitHub account is also your login on codefair!
      </p>
    </div>
  </main>
</template>

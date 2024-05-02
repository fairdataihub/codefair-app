<script setup lang="ts">
const user = useUser();

watchEffect(() => {
  if (user.value) {
    return navigateTo("/profile");
  }
});
</script>

<template>
  <div>
    <h1>Sign in</h1>
    <a href="/login/github">Sign in with GitHub</a>

    <pre>
      User: {{ user }}
    </pre>
  </div>
</template>

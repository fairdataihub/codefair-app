<script setup lang="ts">
const user = useUser();

console.log(user.value);
if (user.value) {
  navigateTo("/profile");
}
</script>

<template>
  <div>
    <h1>Sign in</h1>
    <a href="/login/github">Sign in with GitHub</a>
  </div>
</template>

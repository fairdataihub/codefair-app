<script setup lang="ts">
import { computed } from "vue";
import { useColorMode } from "#imports";

const colorMode = useColorMode();
const isDark = computed({
  get: () => colorMode.value === "dark",
  set: (v) => (colorMode.preference = v ? "dark" : "light"),
});
</script>

<template>
  <ClientOnly>
    <n-switch v-model:value="isDark" size="medium">
      <template #checked>
        <Icon name="material-symbols:moon-stars-outline" />
      </template>

      <template #unchecked>
        <Icon name="material-symbols:sunny-rounded" />
      </template>
    </n-switch>

    <template #fallback>
      <!-- reserve the space during SSR -->
      <div class="h-6 w-12"></div>
    </template>
  </ClientOnly>
</template>

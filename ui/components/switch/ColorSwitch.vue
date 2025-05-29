<script setup lang="ts">
import { computed } from "vue";
import { Icon } from "@iconify/vue";
import { useColorMode } from "#imports";

const colorMode = useColorMode();
const isDark = computed({
  get: () => colorMode.value === "dark",
  set: (v) => (colorMode.preference = v ? "dark" : "light"),
});

// tweak on/off track colors and thumb size
const switchStyle = computed(() => ({
  "--n-switch-button-size": "1.25rem",
  "--n-switch-checked-bg-color": isDark.value ? "#374151" : undefined,
  "--n-switch-unchecked-bg-color": !isDark.value ? "#fbbf24" : undefined,
}));
</script>

<template>
  <ClientOnly>
    <n-switch
      v-model:value="isDark"
      size="medium"
      round
      bordered
      aria-label="Toggle dark/light mode"
      :style="switchStyle"
      class="mt-[.3rem] transition-colors duration-300 ease-in-out"
    >
      <template #checked-icon>
        <Icon icon="material-symbols:moon-stars-outline" class="icon" />
      </template>

      <template #unchecked-icon>
        <Icon icon="material-symbols:sunny-rounded" class="icon" />
      </template>
    </n-switch>
  </ClientOnly>
</template>

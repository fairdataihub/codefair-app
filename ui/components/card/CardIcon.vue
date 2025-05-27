<script setup lang="ts">
defineProps({
  title: {
    default: "Card Title",
    type: String,
  },
  editLink: {
    default: "",
    type: String,
  },
  icon: {
    default: "",
    type: String,
  },
});

const showClicked = ref(false);
</script>

<template>
  <div
    class="relative flex h-40 w-40 flex-col items-center justify-center rounded-lg border border-gray-300 bg-white shadow-md"
    @click="showClicked = !showClicked"
  >
    <!-- Edit Icon (NuxtLink) -->
    <NuxtLink
      :to="editLink"
      class="absolute right-2 top-2 text-indigo-500 hover:text-indigo-700"
    >
      <Icon name="mdi:pencil" size="1.5rem" />
    </NuxtLink>

    <div
      v-if="showClicked"
      :to="editLink"
      class="absolute left-2 top-2 text-green-500"
    >
      <Icon name="mdi:checkbox-marked-circle" size="1.5rem" />
    </div>

    <!-- Main Icon (Slot) -->
    <Icon :name="icon" size="3rem" />

    <!-- Title -->
    <h3 class="mt-4 select-none text-center text-lg font-semibold">
      {{ title }}
    </h3>
  </div>
</template>

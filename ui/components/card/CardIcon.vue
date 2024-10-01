<script setup lang="ts">
defineProps({
  icon: {
    default: "",
    type: String,
  },
  editLink: {
    default: "",
    type: String,
  },
  title: {
    default: "Card Title",
    type: String,
  },
})

const showClicked = ref(false);

</script>

<template>
    <div @click="showClicked = !showClicked" class="relative flex flex-col items-center justify-center w-40 h-40 border border-gray-300 rounded-lg shadow-md bg-white">
    
      <!-- Edit Icon (NuxtLink) -->
    <NuxtLink :to="editLink" class="absolute top-2 right-2 text-indigo-500 hover:text-indigo-700">
      <Icon name="mdi:pencil" size="1.5rem" />
    </NuxtLink>

    <div v-if="showClicked" :to="editLink" class="absolute top-2 left-2 text-green-500">
      <Icon name="mdi:checkbox-marked-circle" size="1.5rem" />
    </div>
    
    <!-- Main Icon (Slot) -->
    <Icon :name="icon" size="3rem" />
    
    <!-- Title -->
    <h3 class="text-center text-lg font-semibold mt-4 select-none">{{ title }}</h3>
  </div>
</template>
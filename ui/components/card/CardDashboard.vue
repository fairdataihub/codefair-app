<script setup lang="ts">
defineProps({
  title: {
    default: "Card Title",
    type: String,
  },
  deactivated: {
    default: false,
    type: Boolean,
  },
  subheader: {
    default: "",
    type: String,
  },
});

const slots = useSlots();
</script>

<template>
  <div class="relative">
    <!-- Card wrapper -->
    <div
      :class="[
        'relative flex w-full gap-4 rounded-lg border border-slate-200 px-5 py-6 shadow-sm',
        deactivated ? 'cursor-not-allowed bg-gray-100 opacity-50' : 'bg-white',
      ]"
    >
      <div>
        <slot name="icon"></slot>
      </div>

      <div class="flex w-full flex-col">
        <div class="flex flex-col border-b border-slate-100 pb-2">
          <div class="flex items-center justify-between">
            <h2 v-if="!slots.title" name="title" class="text-xl font-bold">
              {{ title }}
            </h2>

            <slot v-else name="title"></slot>

            <slot name="header-extra"></slot>
          </div>

          <p v-if="!slots.subheader" class="text-sm text-slate-500">
            {{ subheader }}
          </p>

          <slot v-else name="subheader"></slot>
        </div>

        <div class="flex items-center justify-between gap-8 pt-6">
          <slot name="content"></slot>

          <slot name="action"></slot>
        </div>
      </div>
    </div>

    <!-- Overlay for Coming Soon when deactivated -->
    <div
      v-if="deactivated"
      class="absolute inset-0 flex items-center justify-center rounded-lg bg-black bg-opacity-15"
    >
      <p class="text-lg font-bold text-white">Coming Soon</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  bottomLine: {
    default: true,
    type: Boolean,
  },
});
</script>

<template>
  <div class="grid grid-cols-12 border-b py-5">
    <div class="col-span-4 pt-2">
      <slot name="info"></slot>
    </div>

    <div class="col-span-8">
      <slot name="form"></slot>
    </div>
  </div>
</template>

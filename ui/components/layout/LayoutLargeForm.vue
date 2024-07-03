<script setup lang="ts">
defineProps({
  bottomLine: {
    default: true,
    type: Boolean,
  },
});

const collapsed = ref(false);

const collapseContent = () => {
  collapsed.value = !collapsed.value;
};
</script>

<template>
  <div
    class="grid grid-cols-12 gap-5 py-5"
    :class="{
      'border-b': bottomLine,
    }"
  >
    <div
      class="flex items-start space-x-2 pt-2 transition-opacity"
      :class="{
        'col-span-4': !collapsed,
        'col-span-8': collapsed,
      }"
    >
      <div
        class="cursor-pointer rounded-full pt-1 hover:bg-indigo-100"
        @click="collapseContent"
      >
        <Icon
          name="icon-park-outline:right"
          size="25"
          class="transition-all hover:text-indigo-500"
          :class="{
            'text-gray-600': !collapsed,
            'rotate-90 text-gray-400': collapsed,
          }"
        />
      </div>

      <div>
        <slot name="info"></slot>
      </div>
    </div>

    <div
      :class="{
        'col-span-8': !collapsed,
        'col-span-2 opacity-0': collapsed,
      }"
    >
      <n-collapse-transition :show="!collapsed">
        <div>
          <slot name="form"></slot>
        </div>
      </n-collapse-transition>
    </div>
  </div>
</template>

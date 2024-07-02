<script setup lang="ts">
const props = defineProps({
  title: {
    default: "Card Title",
    type: String,
  },
  bordered: {
    default: false,
    type: Boolean,
  },
  collapse: {
    default: false,
    type: Boolean,
  },
  subheader: {
    default: "",
    type: String,
  },
});

const slots = useSlots();

const contentCollapsed = ref(false);

const hasHeaderExtra = computed(() => {
  return !!slots["header-extra"];
});

const hasAction = computed(() => {
  return !!slots.action;
});

onBeforeMount(() => {
  contentCollapsed.value = props.collapse;
});

const toggleCollapse = () => {
  contentCollapsed.value = !contentCollapsed.value;
};
</script>

<template>
  <div
    class="rounded-lg shadow-sm"
    :class="{
      border: bordered,
      'border-slate-200': bordered,
    }"
  >
    <div
      class="flex items-center justify-between rounded-lg px-6 py-4 transition-all"
      :class="{
        'bg-white': contentCollapsed,
        'bg-slate-50/50': !contentCollapsed,
      }"
    >
      <div>
        <div class="text-xl font-bold">{{ title }}</div>

        <div class="text-sm text-slate-500">{{ subheader }}</div>
      </div>

      <div class="flex items-center">
        <slot name="header-extra"></slot>

        <n-divider v-if="hasHeaderExtra" vertical class="!mx-3" />

        <n-button
          text
          class="rounded-full p-2 text-3xl transition-all hover:!bg-indigo-100"
          type="info"
          @click="toggleCollapse"
        >
          <!-- <Icon
            v-if="contentCollapsed"
            name="fluent:arrow-maximize-vertical-24-filled"
          /> -->
          <Icon
            name="icon-park-outline:up"
            size="25"
            class="transition-all hover:text-indigo-500"
            :class="{
              'text-gray-600': !contentCollapsed,
              'rotate-180 text-gray-400': contentCollapsed,
            }"
          />

          <!-- <Icon v-else name="fluent:arrow-minimize-vertical-24-filled" /> -->
        </n-button>
      </div>
    </div>

    <n-collapse-transition :show="!contentCollapsed">
      <n-divider class="!m-0" />

      <div class="px-6 py-4">
        <slot></slot>
      </div>
    </n-collapse-transition>

    <div
      v-if="hasAction"
      class="flex items-center justify-start rounded-lg bg-slate-50 px-6 py-4"
    >
      <slot name="action"></slot>
    </div>
  </div>
</template>

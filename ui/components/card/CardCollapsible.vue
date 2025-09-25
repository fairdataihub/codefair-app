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
    type: Boolean,
  },
  horizontal: {
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

const isCollapsed = computed(() => {
  return contentCollapsed.value;
});

onBeforeMount(() => {
  contentCollapsed.value = props.collapse || false;
});

const toggleCollapse = () => {
  contentCollapsed.value = !contentCollapsed.value;
};
</script>

<template>
  <div
    class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-500 dark:bg-[oklch(23%_0.02_260)]"
  >
    <div
      class="flex items-center justify-between rounded-lg px-6 py-4 transition-all"
      :class="{
        'bg-white dark:bg-[oklch(27%_0.02_260)]': contentCollapsed,
        'rounded-none border-b border-gray-200 bg-slate-50/50 dark:border-gray-500 dark:bg-[oklch(23%_0.02_260)]':
          !contentCollapsed,
      }"
    >
      <div>
        <div class="text-xl font-bold dark:text-[oklch(96%_0.01_260)]">
          {{ title }}
        </div>

        <div class="text-sm text-slate-500 dark:text-[oklch(78%_0.01_260)]">
          {{ subheader }}
        </div>
      </div>

      <div class="flex items-center">
        <slot name="header-extra"></slot>

        <n-divider v-if="hasHeaderExtra" vertical class="!mx-3" />

        <n-button
          text
          class="rounded-full p-2 text-3xl transition-all hover:!bg-indigo-100 dark:hover:!bg-[oklch(36%_0.05_265)]"
          type="info"
          @click="toggleCollapse"
        >
          <Icon
            name="icon-park-outline:down"
            size="25"
            class="transition-all"
            :class="{
              'rotate-180 text-gray-600 dark:text-[oklch(90%_0.01_260)]':
                !isCollapsed,
              'rotate-0 text-gray-400 dark:text-[oklch(78%_0.01_260)]':
                isCollapsed,
            }"
          />
        </n-button>
      </div>
    </div>

    <n-collapse-transition :show="!contentCollapsed">
      <n-divider class="!m-0" />

      <div class="px-6 py-4 dark:text-[oklch(90%_0.01_260)]">
        <slot></slot>
      </div>
    </n-collapse-transition>

    <div
      v-if="hasAction"
      class="flex flex-row items-center justify-start rounded-lg bg-slate-50 px-6 py-4 dark:bg-[oklch(23%_0.02_260)]"
    >
      <slot name="action"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";

const props = defineProps({
  title: {
    default: "Untitled",
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
  icon: {
    default: "",
    type: String,
  },
  required: {
    default: false,
    type: Boolean,
  },
  status: {
    default: null,
    type: String as PropType<"complete" | "incomplete" | "error" | null>,
  },
  subtitle: {
    default: "",
    type: String,
  },
  variant: {
    default: "default",
    type: String as PropType<"default" | "inset">,
  },
});

const slots = useSlots();

const contentCollapsed = ref(false);

const hasAction = computed(() => !!slots.action);
const isCollapsed = computed(() => contentCollapsed.value);

onBeforeMount(() => {
  contentCollapsed.value = props.collapse ?? false;
});

const toggleCollapse = () => {
  contentCollapsed.value = !contentCollapsed.value;
};

defineExpose({
  open() {
    contentCollapsed.value = false;
  },
});
</script>

<template>
  <div
    class="overflow-hidden rounded-lg border transition-colors"
    :class="{
      'border-[var(--cf-card-border)] bg-[var(--cf-card-bg)]':
        variant === 'default',
      'border-l-[5px] border-[var(--cf-divider)] border-l-indigo-400 dark:border-l-indigo-500':
        variant === 'inset',
    }"
  >
    <!-- Header -->
    <div
      class="flex cursor-pointer select-none items-center gap-3 px-4 py-3 transition-colors hover:bg-[oklch(97%_0.01_260)] dark:hover:bg-[oklch(26%_0.02_260)]"
      @click="toggleCollapse"
    >
      <!-- Section icon pill (only on default variant when icon provided) -->
      <div
        v-if="icon && variant === 'default'"
        class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-[oklch(30%_0.05_265)] dark:text-[oklch(78%_0.08_265)]"
      >
        <Icon :name="icon" size="16" />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span
            class="truncate text-base font-semibold text-[var(--cf-text-1)]"
          >
            {{ title }}
          </span>

          <n-tag
            v-if="required && status !== 'complete'"
            type="warning"
            size="small"
            :bordered="false"
            class="shrink-0"
          >
            Required
          </n-tag>
        </div>

        <div
          v-if="subtitle"
          class="mt-0.5 truncate text-xs text-[var(--cf-text-3)]"
        >
          {{ subtitle }}
        </div>
      </div>

      <div class="flex items-center gap-2" @click.stop>
        <slot name="header-extra" />
      </div>

      <!-- Status dot -->
      <span
        v-if="status && required"
        class="size-2.5 shrink-0 rounded-full"
        :class="{
          'bg-green-500': status === 'complete',
          'bg-orange-400': status === 'incomplete',
          'bg-red-500': status === 'error',
        }"
      />

      <Icon
        name="tabler:chevron-down"
        size="16"
        class="shrink-0 text-[var(--cf-text-3)] transition-transform duration-200"
        :class="{ 'rotate-180': !isCollapsed }"
      />
    </div>

    <!-- Body -->
    <n-collapse-transition :show="!isCollapsed">
      <div class="border-t border-[var(--cf-divider)] px-4 py-4">
        <slot />
      </div>
    </n-collapse-transition>

    <!-- Action footer -->
    <div v-if="hasAction" class="border-t border-[var(--cf-divider)] px-4 py-3">
      <slot name="action" />
    </div>
  </div>
</template>

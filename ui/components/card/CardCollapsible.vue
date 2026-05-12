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
</script>

<template>
  <div
    class="overflow-hidden rounded-lg border transition-colors"
    :class="{
      'border-[var(--cf-card-border)] bg-[var(--cf-card-bg)]':
        variant === 'default',
      'border-[var(--cf-divider)] bg-[var(--cf-field-bg)]': variant === 'inset',
    }"
  >
    <!-- Header -->
    <div
      class="flex cursor-pointer select-none items-center gap-3 px-4 py-3 transition-colors hover:bg-[oklch(97%_0.01_260)] dark:hover:bg-[oklch(26%_0.02_260)]"
      @click="toggleCollapse"
    >
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold text-[var(--cf-text-1)]">
          {{ title }}
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

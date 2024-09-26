<script setup lang="ts">
import { faker } from "@faker-js/faker";

const nums = useState(useId(), () => [
  Math.random(),
  Math.random(),
  Math.random(),
]);

const getRandomPastelColor = () => {
  // Generate random values for red, green, and blue with a higher base (127) to ensure the color is light
  let r = Math.floor(nums.value[0] * 128 + 127);
  let g = Math.floor(nums.value[1] * 128 + 127);
  let b = Math.floor(nums.value[2] * 128 + 127);

  // Reduce saturation by averaging the random color with white
  r = Math.floor((r + 255) / 2);
  g = Math.floor((g + 255) / 2);
  b = Math.floor((b + 255) / 2);

  return `rgb(${r}, ${g}, ${b})`;
};

defineProps({
  placeholder: {
    default: faker.lorem.sentence(5),
    type: String,
  },
});
</script>

<template>
  <div
    class="my-10 flex h-[100px] w-full items-center justify-center rounded-lg border border-dashed border-slate-600"
    :style="{ backgroundColor: getRandomPastelColor() }"
  >
    {{ placeholder }}
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps({
  error: {
    default: null,
    required: true,
    type: Object as PropType<NuxtError>,
  },
});

const statusCode = props.error?.statusCode ?? 500;

console.log(props.error.data);

const showNotAuthorizedError = ref(false);
const requestClosed = ref(false);

if (props.error) {
  const errorCode = props.error.statusMessage ?? "Something went wrong";

  if (statusCode === 403) {
    showNotAuthorizedError.value = true;
  } else if (statusCode === 400) {
    if (errorCode === "request-closed") {
      requestClosed.value = true;

      push.error({
        title: "Request closed",
        message: "This request has been closed. You can't edit it anymore.",
      });
    }
  } else {
    push.error({
      title: "Something went wrong",
    });

    throw new Error("Failed to fetch license details");
  }
}
</script>

<template>
  <NuxtLayout name="default">
    <main
      class="grid place-items-center px-6 text-center text-lg text-slate-700 lg:px-8"
    >
      <img
        src="/assets/images/error/404.svg"
        alt="Page not found"
        class="mx-auto w-96"
      />

      <h1 class="mt-4 text-2xl font-bold">
        {{ error.statusCode }}
      </h1>

      <n-flex vertical size="large">
        <n-flex v-if="showNotAuthorizedError" vertical size="large">
          <h1 class="text-5xl font-bold">
            You are not authorized to view this page.
          </h1>

          <p class="text-lg">
            Please contact the owner of the repository to get access to this
            page.
          </p>
        </n-flex>

        <n-flex v-else-if="requestClosed" vertical size="large">
          <h1 class="text-5xl font-bold">This request has been closed</h1>

          <p class="text-lg">
            This is due to the fact that the request has been completed or the
            request has been closed by the owner of the repository.
          </p>
        </n-flex>

        <n-flex v-else class="grid place-items-center px-6 lg:px-8">
          <h1 class="text-5xl font-bold">Something went wrong</h1>

          <p class="text-lg">
            The page you are looking for might have been removed or is
            temporarily unavailable.
          </p>
        </n-flex>
      </n-flex>
    </main>
  </NuxtLayout>
</template>

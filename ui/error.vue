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

console.error(props.error);
console.error(props.error.statusMessage);

const showNotAuthorizedError = ref(false);
const orgNotAuthorizedError = ref(false);
const accountNotAuthorizedError = ref(false);
const requestClosed = ref(false);

const githubOAuthClientId = ref("");

if (props.error) {
  const errorCode = props.error.statusMessage ?? "Something went wrong";

  if (statusCode === 403) {
    showNotAuthorizedError.value = true;

    if (errorCode.startsWith("unauthorized-org-access")) {
      orgNotAuthorizedError.value = true;

      githubOAuthClientId.value = errorCode.split("|")[1];
    } else if (errorCode === "unauthorized-account-access") {
      accountNotAuthorizedError.value = true;
    }
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

    throw new Error("Failed to fetch details from the database");
  }
}
</script>

<template>
  <NuxtLayout name="default">
    <main
      class="grid place-items-center px-6 pb-8 text-center text-lg text-slate-700 lg:px-8"
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

          <n-alert
            v-if="orgNotAuthorizedError"
            type="error"
            class="mx-auto mt-4 max-w-screen-lg"
            title="Unauthorized organization access"
          >
            We are unable to verify if you are a member of this GitHub
            organization. You may need to grant our application access to your
            GitHub organization. You can do this by visiting your
            <NuxtLink
              :href="`https://github.com/settings/connections/applications/${githubOAuthClientId}`"
              target="_blank"
              rel="noopener noreferrer"
              class="underline"
              >GitHub settings</NuxtLink
            >
            page.
          </n-alert>

          <n-alert
            v-else-if="accountNotAuthorizedError"
            type="error"
            title="Unauthorized account access"
            class="mx-auto mt-4 w-full max-w-screen-lg"
          >
            You are not authorized to view the contents of this page.
          </n-alert>

          <p v-else class="text-lg">
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

        <n-flex v-else vertical size="large">
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

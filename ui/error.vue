<script setup lang="ts">
import { ref } from "vue";
import type { NuxtError } from "#app";

// Define error prop with types
const props = defineProps({
  error: {
    default: null,
    required: true,
    type: Object as PropType<NuxtError>,
  },
});

// Capture key properties from error
const statusCode = props.error?.statusCode ?? 500;
const errorMessage = props.error?.statusMessage ?? "Something went wrong";
const urlVisiting = (props.error as NuxtError & { url?: string }).url ?? "/";

// Enhanced debugging: Log complete error info if in development mode
if (process.dev && props.error) {
  console.groupCollapsed("[Error Debug Info]");
  console.error("Status Code:", statusCode);
  console.error("Error Message:", errorMessage);
  console.error("URL Visiting:", urlVisiting);
  console.error("Full Error Object:", props.error);
  if (props.error.stack) {
    console.error("Stack Trace:", props.error.stack);
  }
  console.groupEnd();
}

const showNotAuthorizedError = ref(false);
const orgNotAuthorizedError = ref(false);
const accountNotAuthorizedError = ref(false);
const requestClosed = ref(false);
const githubOAuthOrgUrl = ref("");

// Determine error type and handle accordingly
if (props.error) {
  if (statusCode === 403) {
    showNotAuthorizedError.value = true;

    if (errorMessage.startsWith("unauthorized-org-access")) {
      orgNotAuthorizedError.value = true;
      githubOAuthOrgUrl.value = errorMessage.split("|")[1];

      // Log details about organization access failure
      if (process.dev) {
        console.error(
          "Unauthorized organization access. GitHub OAuth URL:",
          githubOAuthOrgUrl.value,
        );
      }
    } else if (errorMessage === "unauthorized-account-access") {
      accountNotAuthorizedError.value = true;
      if (process.dev) {
        console.error("Unauthorized account access encountered.");
      }
    }
  } else if (statusCode === 400) {
    if (errorMessage === "request-closed") {
      requestClosed.value = true;
      if (process.dev) {
        console.error("Request closed error encountered:", errorMessage);
      }
      push.error({
        title: "Request closed",
        message: "This request has been closed. You can't edit it anymore.",
      });
    }
  } else if (statusCode === 401 && errorMessage === "not-signed-in") {
    const redirectPath = encodeURIComponent(urlVisiting);
    if (process.dev) {
      console.error(
        "User not signed in. Redirecting to login page with redirect path:",
        redirectPath,
      );
    }
    try {
      await navigateTo({
        path: "/login/github",
        query: { redirect: redirectPath },
      });
    } catch (error) {
      console.error("Redirection error:", error);
    }
  } else {
    push.error({
      title: "Something went wrong",
    });
    if (process.dev) {
      console.error(
        "Unhandled error case. Throwing error for insufficient access.",
      );
    }
    throw new Error("You may not have access to this page.");
  }
}
</script>

<template>
  <NuxtLayout name="default">
    <main class="mx-auto flex h-full max-w-screen-xl grow justify-center">
      <div
        class="grid place-items-center px-6 pb-8 text-center text-lg text-slate-700 lg:px-8"
      >
        <img src="/assets/images/error/404.svg" alt="Page not found" />

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
              organization. You may need to grant read access to your GitHub
              organization. You can do this by visiting your
              <NuxtLink
                :href="githubOAuthOrgUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="underline"
                >Organization's GitHub settings</NuxtLink
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

            <n-flex justify="center">
              <p class="text-center">
                Please visit the
                <NuxtLink
                  to="/faq"
                  class="text-indigo-500 transition-all hover:text-indigo-700 hover:underline"
                  >FAQ</NuxtLink
                >
                page for more information.
              </p>
            </n-flex>
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

            <p class="mx-auto w-full max-w-screen-lg text-lg">
              The page you are looking for might have been removed or is
              inaccessible. <br />
              If you think this is a mistake, please contact the owner of the
              repository.
            </p>

            <n-flex justify="center">
              <p>
                Please visit the
                <NuxtLink
                  to="/faq"
                  class="text-purple-500 transition-all hover:text-purple-700 hover:underline"
                  >FAQ</NuxtLink
                >
                page for more information.
              </p>
            </n-flex>
          </n-flex>
        </n-flex>
      </div>
    </main>
  </NuxtLayout>
</template>

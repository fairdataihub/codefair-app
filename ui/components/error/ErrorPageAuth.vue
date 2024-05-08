<script setup lang="ts">
const props = defineProps({
  errorContent: {
    required: true,
    type: Object as PropType<ApiError | null>,
  },
  statusCode: {
    default: 500,
    required: true,
    type: Number,
  },
});

const showNotAuthorizedError = ref(false);
const requestClosed = ref(false);

if (props.errorContent) {
  const statusCode = props.statusCode ?? 500;
  const code = props.errorContent.data.code ?? "Something went wrong";

  if (statusCode === 403) {
    showNotAuthorizedError.value = true;
  } else if (statusCode === 400) {
    if (code === "request-closed") {
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
  <div v-if="showNotAuthorizedError">
    <div class="flex items-center space-x-4">
      <img
        src="https://www.svgrepo.com/show/406101/locked.svg"
        alt="Not authorized"
        class="h-20 w-20"
      />

      <n-flex vertical>
        <h1>You are not authorized to view this page.</h1>

        <p>
          Please contact the owner of the repository to get access to this page.
        </p>
      </n-flex>
    </div>
  </div>

  <div v-else-if="requestClosed">
    <div class="flex items-center space-x-4">
      <img
        src="https://www.svgrepo.com/show/235034/close-sign.svg"
        alt="Not authorized"
        class="h-20 w-20"
      />

      <n-flex vertical>
        <h1>This request has been closed</h1>

        <p>
          This request has been marked as closed. This is due to the fact that
          the request has been completed or the request has been closed by the
          owner of the repository.
        </p>
      </n-flex>
    </div>
  </div>
</template>

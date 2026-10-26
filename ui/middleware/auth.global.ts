export default defineNuxtRouteMiddleware(async () => {
  const user = useUser();

  if (user.value) return; // already loaded, skip

  const logwatch = useLogwatch();
  const { data, error } = await useFetch("/api/user");

  if (error.value) {
    console.error("Failed to fetch the current user:", error.value);
    logwatch.error("auth.fetchUser", "Failed to fetch the current user", {
      error: error.value,
    });
  }

  if (data.value) {
    user.value = data.value;
  }
});

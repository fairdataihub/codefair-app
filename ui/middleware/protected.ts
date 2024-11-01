export default defineNuxtRouteMiddleware(async (to) => {
  const user = useUser();

  // Add paths will be in the form of /add/license/:identifier
  // We need to redirect back to this path after login
  if (!user.value) {
    const redirectPath = encodeURIComponent(to.path);

    try {
      await navigateTo({
        path: "/login/github",
        query: { redirect: redirectPath },
      });
    } catch (error) {
      console.error("Redirection error:", error);
    }
  }
});

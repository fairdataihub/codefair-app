export default defineNuxtRouteMiddleware(async (to) => {
  const user = useUser();

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

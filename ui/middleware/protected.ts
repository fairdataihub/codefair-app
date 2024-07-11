export default defineNuxtRouteMiddleware((to) => {
  const user = useUser();

  if (!user.value) {
    // Add paths will be in the form of `/add/license/:identifier`
    // We need to redirect back to this path after login
    const redirectPath = to.path;

    return navigateTo({
      path: "/login/github",
      query: {
        redirect: encodeURIComponent(redirectPath),
      },
    });
  }
});

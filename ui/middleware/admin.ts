// Keeps non-admins off /admin. This only hides the page: every /api/admin
// route checks the admin role on the server, so the page has no data to show
// anyone else. Runs after auth.global.ts has loaded the user.
export default defineNuxtRouteMiddleware((to) => {
  const user = useUser();

  if (!user.value) {
    return navigateTo({
      path: "/login/github",
      query: { redirect: encodeURIComponent(to.path) },
    });
  }

  // A 404 rather than a 403, so the page's existence is not advertised
  if (user.value.role !== "admin") {
    return abortNavigation(
      createError({ statusCode: 404, statusMessage: "Page Not Found" }),
    );
  }
});

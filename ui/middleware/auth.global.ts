export default defineNuxtRouteMiddleware(async () => {
  const user = useUser();

  const { data, error } = await useFetch("/api/user");

  if (error.value) {
    console.error(error);
  }

  if (data.value) {
    user.value = data.value;
  }
});

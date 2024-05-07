export default defineEventHandler(async (event) => {
  await protectRoute(event);

  return event.context.user;
});

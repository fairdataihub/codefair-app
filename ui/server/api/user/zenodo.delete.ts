import type { User } from "lucia";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const user = event.context.user as User | null;

  if (!user) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request. Missing user in the URL params",
    });
  }

  // Delete only the Zenodo token from the zenodoToken table
  await prisma.zenodoToken.deleteMany({
    where: {
      user_id: user.id,
    },
  });

  return {
    message: "Zenodo token purged",
  };
});

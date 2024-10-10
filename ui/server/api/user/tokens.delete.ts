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

  await prisma.zenodoToken.deleteMany({
    where: {
      user_id: user.id,
    },
  });

  await prisma.user.update({
    data: {
      access_token: "",
    },
    where: {
      id: user.id,
    },
  });

  return {
    message: "Tokens purged",
  };
});

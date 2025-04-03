// Returns the token of the user
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

  const userDetails = await prisma.user.findUnique({
    select: {
      access_token: true,
    },
    where: {
      id: user.id,
    },
  });

  return {
    access_token: userDetails?.access_token || "",
  };
});

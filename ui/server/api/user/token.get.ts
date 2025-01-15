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

  const user_details = await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    select: {
      access_token: true,
    },
  });

  return {
    access_token: user_details?.access_token || "",
  };
});

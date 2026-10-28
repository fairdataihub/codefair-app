// Returns the token of the user
import type { User } from "lucia";
import { decryptToken, githubTokenContext } from "~/server/utils/tokenCrypto";

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
      github_id: true,
    },
    where: {
      id: user.id,
    },
  });

  // Stored encrypted (server/utils/tokenCrypto.ts)
  const accessToken = userDetails
    ? decryptToken(
        userDetails.access_token,
        githubTokenContext(userDetails.github_id),
      )
    : null;

  return {
    access_token: accessToken || "",
  };
});

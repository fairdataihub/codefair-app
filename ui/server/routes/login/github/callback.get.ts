import { OAuth2RequestError } from "arctic";
import { generateIdFromEntropySize } from "lucia";
import { PrismaClient } from "@prisma/client";
import { github } from "~/server/utils/auth";
import { encryptToken, githubTokenContext } from "~/server/utils/tokenCrypto";
const prisma = new PrismaClient();

interface GitHubUser {
  id: string;
  login: string;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const code = query.code?.toString() ?? null;
  const state = query.state?.toString() ?? null;
  const requestedRedirect = query.redirect?.toString() ?? null;

  const storedState = getCookie(event, "github_oauth_state") ?? null;

  if (!code || !state || !storedState || state !== storedState) {
    throw createError({
      status: 400,
    });
  }

  try {
    const tokens = await github.validateAuthorizationCode(code);

    const githubUserResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });
    const githubUser: GitHubUser = await githubUserResponse.json();
    const githubId = parseInt(githubUser.id);

    // Stored encrypted, bound to this GitHub account
    const encryptedAccessToken = encryptToken(
      tokens.accessToken,
      githubTokenContext(githubId),
    );

    const existingUser = await prisma.user.findFirst({
      where: {
        github_id: githubId,
      },
    });

    if (existingUser) {
      const { id } = existingUser;

      const session = await lucia.createSession(id, {});

      // Add a last login timestamp to the user
      await prisma.user.update({
        data: {
          access_token: encryptedAccessToken,
          last_login: new Date(),
        },
        where: {
          id,
        },
      });

      appendHeader(
        event,
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize(),
      );

      return sendRedirect(
        event,
        requestedRedirect
          ? decodeURIComponent(requestedRedirect)
          : `/dashboard`,
      );
    }

    const userId = generateIdFromEntropySize(10); // 16 characters long

    await prisma.user.create({
      data: {
        id: userId,
        username: githubUser.login,
        access_token: encryptedAccessToken,
        github_id: githubId,
        last_login: new Date(),
      },
    });

    const session = await lucia.createSession(userId, {});

    appendHeader(
      event,
      "Set-Cookie",
      lucia.createSessionCookie(session.id).serialize(),
    );
    return sendRedirect(
      event,
      requestedRedirect ? decodeURIComponent(requestedRedirect) : "/",
    );
  } catch (e) {
    // the specific error message depends on the provider
    if (e instanceof OAuth2RequestError) {
      // invalid code
      throw createError({
        status: 400,
      });
    }

    throw createError({
      message: (e as any) ?? "An error occurred",
      status: 500,
    });
  }
});

import { OAuth2RequestError } from "arctic";
import { generateIdFromEntropySize } from "lucia";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import { github } from "~/server/utils/auth";

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

    const existingUser = await prisma.user.findFirst({
      where: {
        github_id: parseInt(githubUser.id),
      },
    });

    if (existingUser) {
      const { id } = existingUser;

      const session = await lucia.createSession(id, {});

      // Add a last login timestamp to the user
      await prisma.user.update({
        data: {
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
        requestedRedirect ? decodeURIComponent(requestedRedirect) : "/",
      );
    }

    const userId = generateIdFromEntropySize(10); // 16 characters long

    await prisma.user.create({
      data: {
        id: userId,
        username: githubUser.login,
        access_token: tokens.accessToken,
        github_id: parseInt(githubUser.id),
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

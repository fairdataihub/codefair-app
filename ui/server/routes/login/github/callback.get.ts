import { OAuth2RequestError } from "arctic";
import { generateIdFromEntropySize } from "lucia";
import clientPromise from "~/server/utils/mongodb";
import { github } from "~/server/utils/auth";

interface GitHubUser {
  id: string;
  login: string;
}

export default defineEventHandler(async (event) => {
  const client = await clientPromise;
  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);

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

    const existingUser = await db.collection("users").findOne({
      github_id: githubUser.id,
    });

    if (existingUser) {
      const { _id } = existingUser;

      const session = await lucia.createSession(_id, {});

      // Add a last login timestamp to the user
      await db.collection("users").updateOne(
        {
          _id,
          access_token: tokens.accessToken,
        },
        {
          $set: {
            last_login: Date.now(),
          },
        },
      );

      // Update the session in the DB

      // await sessions.updateOne({ _id: session.id }, { $set: { _id: _id } });

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

    await db.collection("users").insertOne({
      username: githubUser.login,
      _id: userId,
      access_token: tokens.accessToken,
      created_at: Date.now(),
      github_id: githubUser.id,
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

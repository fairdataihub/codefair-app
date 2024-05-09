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

  const db = client.db();

  const query = getQuery(event);

  const code = query.code?.toString() ?? null;
  const state = query.state?.toString() ?? null;

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

      const session = await lucia.createSession(_id, {
        access_token: tokens.accessToken, // todo: should we store this in session or user?
      });

      // Add a last login timestamp to the user
      await db.collection("users").updateOne(
        {
          _id,
        },
        {
          $set: {
            last_login: new Date(),
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

      return sendRedirect(event, "/");
    }

    const userId = generateIdFromEntropySize(10); // 16 characters long

    await db.collection("users").insertOne({
      username: githubUser.login,
      _id: userId,
      access_token: tokens.accessToken,
      created_at: new Date(),
      github_id: githubUser.id,
    });

    const session = await lucia.createSession(userId, {
      access_token: tokens.accessToken, // todo: should we store this in sesstion or user?
    });

    appendHeader(
      event,
      "Set-Cookie",
      lucia.createSessionCookie(session.id).serialize(),
    );
    return sendRedirect(event, "/");
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

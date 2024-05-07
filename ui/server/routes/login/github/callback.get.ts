import { OAuth2RequestError } from "arctic";
import { DatabaseUser, generateIdFromEntropySize } from "lucia";
import clientPromise from "~/server/utils/mongodb";
import { github, sessions, users } from "~/server/utils/auth";
import mongoose from "mongoose";

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

    console.log("TOKENS: " + JSON.stringify(tokens));

    const githubUserResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });
    const githubUser: GitHubUser = await githubUserResponse.json();

    const existingUser = await users.findOne({ github_id: githubUser.id });

    if (existingUser) {
      const { _id } = existingUser;

      const session = await lucia.createSession(_id, {
        access_token: tokens.accessToken, // todo: should we store this in sesstion or user?
      });

      // Update the session in the DB
      // Replace this with your own DB client.
      // await sessions.updateOne({ _id: session.id }, { $set: { _id: _id } });
      console.log("SESSION: " + JSON.stringify(session));
      appendHeader(
        event,
        "Set-Cookie",
        lucia.createSessionCookie(session.id).serialize(),
      );

      return sendRedirect(event, "/profile");
    }

    const userId = generateIdFromEntropySize(10); // 16 characters long

    // Replace this with your own DB client.
    await db.collection("users").insertOne({
      _id: userId,
      github_id: githubUser.id,
      username: githubUser.login,
      access_token: tokens.accessToken,
    });

    const session = await lucia.createSession(userId, {
      access_token: tokens.accessToken, // todo: should we store this in sesstion or user?
    });

    appendHeader(
      event,
      "Set-Cookie",
      lucia.createSessionCookie(session.id).serialize(),
    );
    return sendRedirect(event, "/profile");
  } catch (e) {
    // the specific error message depends on the provider
    if (e instanceof OAuth2RequestError) {
      // invalid code
      throw createError({
        status: 400,
      });
    }

    throw createError({
      status: 500,
      message: (e as any) ?? "An error occurred",
    });
  }
});

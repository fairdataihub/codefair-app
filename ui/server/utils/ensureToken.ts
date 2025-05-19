/* eslint-disable camelcase */
import { createError } from "h3";

const { ZENODO_CLIENT_ID, ZENODO_CLIENT_SECRET, ZENODO_ENDPOINT } = process.env;

const TOKEN_URL = `${ZENODO_ENDPOINT}/oauth/token`;

export async function ensureZenodoToken(userId: string): Promise<string> {
  const record = await prisma.zenodoToken.findFirst({
    where: { user_id: userId },
  });
  if (!record) {
    // no token at all, prompt user to login
    throw createError({
      message: "Please log in to Zenodo",
      statusCode: 401,
    });
  }

  const now = new Date();
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev && now < record.expires_at) {
    // still valid
    return record.token;
  }

  // token expired (or dev override) → try a refresh
  const params = new URLSearchParams({
    client_id: ZENODO_CLIENT_ID!,
    client_secret: ZENODO_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: record.refresh_token,
  });
  const res = await fetch(TOKEN_URL, {
    body: params.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body.error === "invalid_grant") {
      // refresh token itself is invalid therefore delete it & prompt to re-login
      await prisma.zenodoToken.delete({ where: { id: record.id } });
      throw createError({
        message: "Your Zenodo session has expired. Please log in again.",
        statusCode: 401,
      });
    }
    // some other error
    const text = JSON.stringify(body) || (await res.text());
    throw createError({
      message: `Zenodo refresh failed: ${res.status} ${res.statusText} — ${text}`,
      statusCode: 500,
    });
  }

  // successful refresh
  const {
    access_token,
    expires_in,
    refresh_token: newRefresh,
  } = await res.json();
  const expiresSec =
    typeof expires_in === "string" ? parseInt(expires_in, 10) : expires_in;
  const newExpiry = new Date(Date.now() + expiresSec * 1000);

  await prisma.zenodoToken.update({
    data: {
      expires_at: newExpiry,
      refresh_token: newRefresh || record.refresh_token,
      token: access_token,
    },
    where: { id: record.id },
  });

  return access_token;
}

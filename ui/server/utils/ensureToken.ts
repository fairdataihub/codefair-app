import { createError } from "h3";

const { ZENODO_CLIENT_ID, ZENODO_CLIENT_SECRET, ZENODO_ENDPOINT } = process.env;
const TOKEN_URL = `${ZENODO_ENDPOINT}/oauth/token`;

export async function ensureZenodoToken(
  userId: string,
  forceRefresh: boolean = false,
): Promise<string> {
  console.log("TOKEN_URL", TOKEN_URL);
  console.log("Ensuring Zenodo token for user:", userId);
  const record = await prisma.zenodoToken.findFirst({
    where: { user_id: userId },
  });
  if (!record) {
    throw createError({
      message: `Please log in to Zenodo for ${userId}`,
      statusCode: 401,
    });
  }

  const now = new Date();
  const shouldRefresh =
    forceRefresh || now.getTime() >= new Date(record.expires_at).getTime();
  if (!shouldRefresh) {
    return record.token;
  }

  const params = new URLSearchParams({
    client_id: ZENODO_CLIENT_ID!,
    client_secret: ZENODO_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: record.refresh_token,
  });
  const res = await fetch(TOKEN_URL, {
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  const body = await res.json();
  console.log("🔄 /oauth/token response:", body);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.log("Zenodo refresh error:", body);
    if (body.error === "invalid_grant") {
      // await prisma.zenodoToken.delete({ where: { id: record.id } });
      throw createError({
        message: `Your Zenodo session has expired for ${userId}. Please log in again.`,
        statusCode: 401,
        statusMessage: JSON.stringify(body),
      });
    }
    const text = JSON.stringify(body) || (await res.text());
    throw createError({
      message: `Zenodo refresh failed: ${res.status} ${res.statusText} — ${text}`,
      statusCode: 500,
    });
  }

  const expiresSec =
    typeof body.expires_in === "string"
      ? parseInt(body.expires_in, 10)
      : body.expires_in;
  const newExpiry = new Date(Date.now() + expiresSec * 1000);

  await prisma.zenodoToken.update({
    data: {
      expires_at: newExpiry,
      refresh_token: body.refresh_token || record.refresh_token,
      token: body.access_token,
    },
    where: { id: record.id },
  });

  return body.access_token;
}

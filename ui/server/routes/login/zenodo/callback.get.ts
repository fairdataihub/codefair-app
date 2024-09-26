export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const ZENODO_ENDPOINT = process.env.ZENODO_ENDPOINT || "";
  const ZENODO_CLIENT_ID = process.env.ZENODO_CLIENT_ID || "";
  const ZENODO_CLIENT_SECRET = process.env.ZENODO_CLIENT_SECRET || "";
  const ZENODO_REDIRECT_URI = process.env.ZENODO_REDIRECT_URI || "";

  const code = query.code?.toString() ?? null;
  const state = query.state?.toString() ?? null;

  if (!code || !state) {
    throw createError({
      status: 400,
    });
  }

  if (state.split(":").length !== 3) {
    throw createError({
      status: 400,
    });
  }

  const userId = state?.split(":")[0];
  const owner = state?.split(":")[1];
  const repo = state?.split(":")[2];

  // Generate a refresh token for the user
  const urlEncoded = new URLSearchParams();
  urlEncoded.append("grant_type", "authorization_code");
  urlEncoded.append("code", code);
  urlEncoded.append("client_id", ZENODO_CLIENT_ID);
  urlEncoded.append("client_secret", ZENODO_CLIENT_SECRET);
  urlEncoded.append("redirect_uri", ZENODO_REDIRECT_URI);
  urlEncoded.append(
    "scope",
    encodeURIComponent("deposit:write deposit:actions"),
  );

  console.log(urlEncoded);

  const oauthToken = await fetch(`${ZENODO_ENDPOINT}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: urlEncoded,
  });

  if (!oauthToken.ok) {
    console.log(oauthToken.status);
    console.log(oauthToken.statusText);
    // console.log(oauthToken.json());
    throw createError({
      status: 500,
      statusMessage: "Failed to fetch OAuth token",
    });
  }

  const oauthTokenJson = await oauthToken.json();

  const accessToken = oauthTokenJson.access_token;
  const refreshToken = oauthTokenJson.refresh_token;

  const existingToken = await prisma.zenodoToken.findFirst({
    where: {
      user_id: userId,
    },
  });

  if (existingToken) {
    // update the token
    await prisma.zenodoToken.update({
      data: {
        token: accessToken,
        expires_at: new Date(Date.now() + 3600 * 1000),
        refresh_token: refreshToken,
      },
      where: {
        user_id: userId,
      },
    });
  } else {
    await prisma.zenodoToken.create({
      data: {
        user_id: userId,
        token: accessToken,
        expires_at: new Date(Date.now() + 3600 * 1000),
        refresh_token: refreshToken,
      },
    });
  }

  return sendRedirect(event, `/dashboard/${owner}/${repo}/release/zenodo`);
});

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

  let parsedState;
  try {
    parsedState = JSON.parse(decodeURIComponent(state));
  } catch (error) {
    throw createError({
      status: 400,
      statusMessage: "Invalid state format",
    });
  }

  // Extract values from the parsed state
  const userId = parsedState.userId;
  const owner = parsedState.owner;
  const repo = parsedState.repo;
  const githubDetails = parsedState.githubDetails;

  if (!userId || !owner || !repo || !githubDetails) {
    throw createError({
      status: 400,
      statusMessage: "Missing required state information",
    });
  }

  console.log("User ID:", userId);
  console.log("Owner:", owner);
  console.log("Repo:", repo);
  console.log("GitHub Details:", githubDetails);

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

  const oauthToken = await fetch(`${ZENODO_ENDPOINT}/oauth/token`, {
    body: urlEncoded,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!oauthToken.ok) {
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
        expires_at: new Date(Date.now() + 3600 * 1000),
        refresh_token: refreshToken,
        token: accessToken,
      },
      where: {
        user_id: userId,
      },
    });
  } else {
    await prisma.zenodoToken.create({
      data: {
        expires_at: new Date(Date.now() + 3600 * 1000),
        refresh_token: refreshToken,
        token: accessToken,
        user_id: userId,
      },
    });
  }

  return sendRedirect(
    event,
    `/dashboard/${owner}/${repo}/release/zenodo?githubTag=${githubDetails.githubTag || ""}&githubRelease=${githubDetails.githubRelease || ""}`,
  );
});

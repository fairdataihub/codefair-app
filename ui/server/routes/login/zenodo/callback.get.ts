export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  const ZENODO_ENDPOINT = process.env.ZENODO_ENDPOINT || "";
  const ZENODO_CLIENT_ID = process.env.ZENODO_CLIENT_ID || "";
  const ZENODO_CLIENT_SECRET = process.env.ZENODO_CLIENT_SECRET || "";
  const ZENODO_REDIRECT_URI = process.env.ZENODO_REDIRECT_URI || "";

  const { code, state } = query;

  if (!code || !state) {
    throw createError({
      status: 400,
      statusMessage: "Missing code or state parameter",
    });
  }

  let parsedState;
  try {
    parsedState = JSON.parse(decodeURIComponent(state as string));
  } catch (error) {
    console.error("Error parsing state:", error);
    throw createError({
      status: 400,
      statusMessage: "Invalid state format",
    });
  }

  const { githubDetails, owner, repo, userId } = parsedState;

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
  const urlEncoded = new URLSearchParams({
    client_id: ZENODO_CLIENT_ID,
    client_secret: ZENODO_CLIENT_SECRET,
    code: code as string,
    grant_type: "authorization_code",
    redirect_uri: ZENODO_REDIRECT_URI,
    scope: "deposit:actions deposit:write",
  });

  const oauthTokenRes = await fetch(`${ZENODO_ENDPOINT}/oauth/token`, {
    body: urlEncoded,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!oauthTokenRes.ok) {
    console.log(oauthTokenRes);
    console.log(oauthTokenRes.json());
    console.log(oauthTokenRes.body);
    console.error("OAuth token request failed:", oauthTokenRes.statusText);
    throw createError({
      status: 500,
      statusMessage: "Failed to fetch OAuth token",
    });
  }

  const { access_token, refresh_token } = await oauthTokenRes.json();

  const tokenData = {
    expires_at: new Date(Date.now() + 3600 * 1000),
    refresh_token,
    token: access_token,
    user_id: userId,
  };

  const existingToken = await prisma.zenodoToken.findFirst({
    where: { user_id: userId },
  });

  if (existingToken) {
    await prisma.zenodoToken.update({
      data: tokenData,
      where: { id: existingToken.id },
    });
  } else {
    await prisma.zenodoToken.create({
      data: { ...tokenData, user_id: userId },
    });
  }

  return sendRedirect(
    event,
    `/dashboard/${owner}/${repo}/release/zenodo?githubTag=${githubDetails.githubTag || ""}&githubRelease=${githubDetails.githubRelease || ""}`,
  );
});

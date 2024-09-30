import { el } from "@faker-js/faker";
import type { User } from "lucia";

export default defineEventHandler(async (event) => {
  const ZENODO_ENDPOINT = process.env.ZENODO_ENDPOINT || "";
  const ZENODO_API_ENDPOINT = process.env.ZENODO_API_ENDPOINT || "";
  const ZENODO_CLIENT_ID = process.env.ZENODO_CLIENT_ID || "";
  const ZENODO_REDIRECT_URI = process.env.ZENODO_REDIRECT_URI || "";

  protectRoute(event);

  const user = event.context.user as User | null;

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  // Check if the user has write permissions to the repository
  await repoWritePermissions(event, owner, repo);
  const isOrg = await ownerIsOrganization(event, owner);
  await isOrganizationMember(event, isOrg, owner);

  const userId = user?.id;

  const state = `${userId}:${owner}:${repo}`;

  const zenodoLoginUrl = `${ZENODO_ENDPOINT}/oauth/authorize?response_type=code&client_id=${ZENODO_CLIENT_ID}&scope=${encodeURIComponent("deposit:write deposit:actions")}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(ZENODO_REDIRECT_URI)}`;

  let haveValidZenodoToken = false;

  const zenodoTokenInfo = {
    token: "",
    expires_at: new Date("2024-09-20 18:34:54.961"),
  };

  if (!zenodoTokenInfo) {
    haveValidZenodoToken = false;
  } else if (zenodoTokenInfo && zenodoTokenInfo.expires_at < new Date()) {
    haveValidZenodoToken = false;
  } else {
    // Check if the token is valid
    const zenodoTokenInfoResponse = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions?access_token=${zenodoTokenInfo.token}`,
      {
        method: "GET",
      },
    );

    if (!zenodoTokenInfoResponse.ok) {
      haveValidZenodoToken = false;
    } else {
      haveValidZenodoToken = true;
    }
  }

  return {
    zenodoLoginUrl: zenodoLoginUrl || "",
    haveValidZenodoToken,
  };
});

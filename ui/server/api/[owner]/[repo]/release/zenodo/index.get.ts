import type { User } from "lucia";

export default defineEventHandler(async (event) => {
  const ZENODO_ENDPOINT = process.env.ZENODO_ENDPOINT || "";
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

  return {
    zenodoLoginUrl: zenodoLoginUrl || "",
  };
});

import type { User } from "lucia";

interface ZenodoDeposition {
  id: number;
  title: string;
  conceptrecid: string;
  state: string;
  submitted: string;
}

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

  const zenodoTokenInfo = await prisma.zenodoToken.findFirst({
    where: {
      user_id: userId,
    },
  });

  const existingDepositions: ZenodoDeposition[] = [];

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

      const response = await zenodoTokenInfoResponse.json();

      for (const item of response) {
        existingDepositions.push({
          id: item.id,
          title: item.title,
          conceptrecid: item.conceptrecid,
          state: item.state,
          submitted: item.submitted,
        });
      }
    }
  }

  const zenodoDeposition = await prisma.zenodoDeposition.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  return {
    existingZenodoDepositionId:
      zenodoDeposition?.existing_zenodo_deposition_id || null,
    haveValidZenodoToken,
    token: zenodoTokenInfo?.token || "",
    zenodoDepositions: existingDepositions,
    zenodoLoginUrl: zenodoLoginUrl || "",
  };
});

import { MongoClient } from "mongodb";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner } = event.context.params as {
    owner: string;
  };

  if (!owner) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request. Missing owner in the URL params",
    });
  }

  const isOrg = await ownerIsOrganization(event, owner);
  await isOrganizationMember(event, isOrg, owner);

  const client = new MongoClient(process.env.MONGODB_URI as string, {});

  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);
  const installationCollection = db.collection("installation");

  // Get all installations for the owner
  const installations = await installationCollection
    .find({
      owner,
    })
    .toArray();

  return installations.map((installation) => ({
    action_count: installation.action_count as number,
    installationId: installation.installationId as number,
    latestCommitDate: installation.latestCommitDate as string,
    latestCommitMessage: installation.latestCommitMessage as string,
    latestCommitSha: installation.latestCommitSha as string,
    latestCommitUrl: installation.latestCommitUrl as string,
    ownerIsOrganization,
    repo: installation.repo as string,
    repositoryId: installation.repositoryId as number,
  }));
});

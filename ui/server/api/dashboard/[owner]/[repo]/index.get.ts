import { MongoClient } from "mongodb";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  // Check if the user has write permissions to the repository
  await repoWritePermissions(event, owner, repo);

  const client = new MongoClient(process.env.MONGODB_URI as string, {});

  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);
  const installationCollection = db.collection("installation");

  // Check if the installation exists in the database
  const installation = await installationCollection.findOne({
    owner,
    repo,
  });

  if (!installation) {
    throw createError({
      statusCode: 404,
      statusMessage: "installation-not-found",
    });
  }

  const { repositoryId } = installation;

  const licenseRequestsCollection = db.collection("licenseRequests");

  // Get all license requests for the repository sorted by timestamp
  const licenseRequest = await licenseRequestsCollection.findOne({
    repositoryId,
  });

  const codeMetadataCollection = db.collection("codeMetadata");

  // Get the code metadata request for the repository

  const codeMetadataRequest = await codeMetadataCollection.findOne({
    repositoryId,
  });

  const cwlValidationCollection = db.collection("cwlValidation");

  // Get the CWL validation data for the repository

  const cwlValidation = await cwlValidationCollection.findOne({
    repositoryId,
  });

  return {
    codeMetadataRequest: codeMetadataRequest
      ? {
          citationStatus:
            (codeMetadataRequest.citation_status as string) || "invalid",
          codemetaStatus:
            (codeMetadataRequest.codemeta_status as string) || "invalid",
          containsCitation: codeMetadataRequest.contains_citation as boolean,
          containsCodemeta: codeMetadataRequest.contains_codemeta as boolean,
          containsMetadata: codeMetadataRequest.contains_metadata as boolean,
          identifier: codeMetadataRequest.identifier as string,
          open: codeMetadataRequest.open as boolean,
          owner: codeMetadataRequest.owner as string,
          pullRequest: (codeMetadataRequest.pullRequestURL as string) || "",
          repo: codeMetadataRequest.repo as string,
          timestamp: codeMetadataRequest.updated_at as string,
        }
      : null,
    cwlValidation: cwlValidation
      ? {
          containsCWL: cwlValidation.contains_cwl_files as boolean,
          identifier: cwlValidation.identifier as string,
          open: cwlValidation.open as boolean,
          owner: cwlValidation.owner as string,
          repo: cwlValidation.repo as string,
        }
      : null,
    installationId: installation.installationId as number,
    isOrganization: installation.ownerIsOrganization as boolean,
    licenseRequest: licenseRequest
      ? {
          containsLicense:
            (licenseRequest.contains_license as boolean) || false,
          identifier: licenseRequest.identifier as string,
          licenseId: licenseRequest.licenseId as string,
          licenseStatus: (licenseRequest.license_status as string) || "invalid",
          open: licenseRequest.open as boolean,
          owner: licenseRequest.owner as string,
          pullRequest: (licenseRequest.pullRequestURL as string) || "",
          repo: licenseRequest.repo as string,
          timestamp: licenseRequest.updated_at as string,
        }
      : null,
  };
});

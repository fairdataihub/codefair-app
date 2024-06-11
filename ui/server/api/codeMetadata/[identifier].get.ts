import { MongoClient } from "mongodb";

export default defineEventHandler(async (event) => {
  await protectRoute(event);

  const { identifier } = event.context.params as { identifier: string };

  const client = new MongoClient(process.env.MONGODB_URI as string, {});

  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);
  const collection = db.collection("codeMetadata");

  // Check if the request identifier exists in the database
  const codeMetadataRequest = await collection.findOne({
    identifier,
  });

  if (!codeMetadataRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "license-request-not-found",
    });
  }

  // Check if the user is authorized to access the codeMetadata request
  await repoWritePermissions(
    event,
    codeMetadataRequest.owner,
    codeMetadataRequest.repo,
  );

  const rawMetadata = codeMetadataRequest.metadata;

  // Convert the creationDate and firstReleaseDate to a number
  if (rawMetadata.creationDate) {
    rawMetadata.creationDate = new Date(rawMetadata.creationDate).getTime();
  }

  if (rawMetadata.firstReleaseDate) {
    rawMetadata.firstReleaseDate = new Date(
      rawMetadata.firstReleaseDate,
    ).getTime();
  }

  if (rawMetadata.currentVersionReleaseDate) {
    rawMetadata.currentVersionReleaseDate = new Date(
      rawMetadata.currentVersionReleaseDate,
    ).getTime();
  }

  if (rawMetadata.authors) {
    for (const author of rawMetadata.authors) {
      if (author.roles) {
        for (const role of author.roles) {
          if (role.startDate) {
            role.startDate = new Date(role.startDate).getTime();
          }
          if (role.endDate) {
            role.endDate = new Date(role.endDate).getTime();
          }
        }
      }
    }
  }

  if (rawMetadata.contributors) {
    for (const contributor of rawMetadata.contributors) {
      if (contributor.roles) {
        for (const role of contributor.roles) {
          if (role.startDate) {
            role.startDate = new Date(role.startDate).getTime();
          }
          if (role.endDate) {
            role.endDate = new Date(role.endDate).getTime();
          }
        }
      }
    }
  }

  const parsedMetadata = rawMetadata as CodeMetadataRequest;

  const response: CodeMetadataRequestGetResponse = {
    createdAt: codeMetadataRequest.createdAt,
    identifier: codeMetadataRequest.identifier,
    metadata: parsedMetadata,
    owner: codeMetadataRequest.owner,
    repo: codeMetadataRequest.repo,
    updatedAt: codeMetadataRequest.updatedAt,
  };

  // return the valid license request
  return response;
});

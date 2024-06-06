import { MongoClient } from "mongodb";
import type { User } from "lucia";

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

  // Check if the license request is still open
  if (!codeMetadataRequest.open) {
    throw createError({
      statusCode: 400,
      statusMessage: "request-closed",
    });
  }

  const response: CodeMetadataRequestGetResponse = {
    licenseId: codeMetadataRequest.licenseId,
    licenseContent: codeMetadataRequest.licenseContent,
    identifier: codeMetadataRequest.identifier,
    owner: codeMetadataRequest.owner,
    repo: codeMetadataRequest.repo,
    timestamp: codeMetadataRequest.timestamp,
  };

  // return the valid license request
  return response;
});

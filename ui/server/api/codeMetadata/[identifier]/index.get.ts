import { MongoClient } from "mongodb";

export default defineEventHandler(async (event) => {
  protectRoute(event);

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
      statusMessage: "codemetadata-request-not-found",
    });
  }

  // Check if the user is authorized to access the codeMetadata request
  await repoWritePermissions(
    event,
    codeMetadataRequest.owner,
    codeMetadataRequest.repo,
  );

  const rawMetadata = codeMetadataRequest.metadata;

  // to do conversions on the metadata if needed
  // -- none for now --

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

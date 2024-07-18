import { MongoClient } from "mongodb";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { identifier } = event.context.params as { identifier: string };

  const client = new MongoClient(process.env.MONGODB_URI as string, {});

  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);
  const collection = db.collection("cwlRequests");

  // Check if the request identifier exists in the database
  const cwlRequest = await collection.findOne({
    identifier,
  });

  if (!cwlRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "cwl-request-not-found",
    });
  }

  // Check if the user is authorized to access the license request
  await repoWritePermissions(event, cwlRequest.owner, cwlRequest.repo);

  // Check if the license request is still open
  if (!cwlRequest.open) {
    throw createError({
      statusCode: 400,
      statusMessage: "request-closed",
    });
  }

  const response: CwlRequestGetResponse = {
    cwlContent: cwlRequest.cwlContent,
    identifier: cwlRequest.identifier,
    owner: cwlRequest.owner,
    repo: cwlRequest.repo,
    timestamp: cwlRequest.timestamp,
    validation_message: cwlRequest.validation_message,
  };

  // return the valid license request
  return response;
});

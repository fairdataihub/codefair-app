import { MongoClient } from "mongodb";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { identifier } = event.context.params as { identifier: string };

  const client = new MongoClient(process.env.MONGODB_URI as string, {});

  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);
  const collection = db.collection("cwlValidation");

  // Check if the request identifier exists in the database
  const cwlValidationEntry = await collection.findOne({
    identifier,
  });

  if (!cwlValidationEntry) {
    throw createError({
      statusCode: 404,
      statusMessage: "cwl-validation-request-not-found",
    });
  }

  // Check if the user is authorized to access the request
  // probably not needed for this endpoint
  // await repoWritePermissions(
  //   event,
  //   cwlValidationEntry.owner,
  //   cwlValidationEntry.repo,
  // );

  const files = cwlValidationEntry.files as CWLValidationResults;

  const response: CWLValidationGetResponse = {
    createdAt: cwlValidationEntry.createdAt,
    files,
    identifier: cwlValidationEntry.identifier,
    owner: cwlValidationEntry.owner,
    repo: cwlValidationEntry.repo,
    updatedAt: cwlValidationEntry.updatedAt,
  };

  // return the valid license request
  return response;
});

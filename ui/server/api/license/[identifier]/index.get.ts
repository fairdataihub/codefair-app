import { MongoClient } from "mongodb";

export default defineEventHandler(async (event) => {
  const { identifier } = event.context.params as { identifier: string };

  const client = new MongoClient(process.env.MONGODB_URI as string, {});
  // Check if the request identifier exists in the database
  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);
  const collection = db.collection("licenseRequests");

  const licenseRequest = await collection.findOne({
    identifier,
  });

  if (!licenseRequest) {
    throw createError({
      statusCode: 404,
      message: "License request not found",
    });
  }

  // Check if the license request is still open
  if (!licenseRequest.open) {
    throw createError({
      statusCode: 400,
      message: "License request is not open",
    });
  }

  const response: LicenseRequestGetResponse = {
    licenseId: licenseRequest.licenseId,
    licenseContent: licenseRequest.licenseContent,
    identifier: licenseRequest.identifier,
    owner: licenseRequest.owner,
    repo: licenseRequest.repo,
    timestamp: licenseRequest.timestamp,
  };

  // return the valid license request
  return response;
});
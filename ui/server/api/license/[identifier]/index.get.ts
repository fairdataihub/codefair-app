import { MongoClient } from "mongodb";
import type { User } from "lucia";

export default defineEventHandler(async (event) => {
  await protectRoute(event);

  const { identifier } = event.context.params as { identifier: string };

  const client = new MongoClient(process.env.MONGODB_URI as string, {});

  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);
  const collection = db.collection("licenseRequests");

  // Check if the request identifier exists in the database
  const licenseRequest = await collection.findOne({
    identifier,
  });

  if (!licenseRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "license-request-not-found",
    });
  }

  // Check if the user is authorized to access the license request
  await repoWritePermissions(event, licenseRequest.owner, licenseRequest.repo);

  // Check if the license request is still open
  if (!licenseRequest.open) {
    throw createError({
      statusCode: 400,
      statusMessage: "request-closed",
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

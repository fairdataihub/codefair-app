import { MongoClient } from "mongodb";
import { z } from "zod";

export default defineEventHandler(async (event) => {
  await protectRoute(event);

  const bodySchema = z.object({
    licenseId: z.string(),
    licenseContent: z.string(),
  });

  const { identifier } = event.context.params as { identifier: string };

  const body = await readBody(event);

  if (!body) {
    throw createError({
      statusCode: 400,
      message: "Missing required fields",
    });
  }

  const parsedBody = bodySchema.safeParse(body);

  if (!parsedBody.success) {
    throw createError({
      message: "The provided parameters are invalid",
      statusCode: 400,
    });
  }

  const { licenseId, licenseContent } = parsedBody.data;

  const client = new MongoClient(process.env.MONGODB_URI as string, {});

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

  // Check if the user is authorized to access the license request
  await repoWritePermissions(event, licenseRequest.owner, licenseRequest.repo);

  if (!licenseRequest.open) {
    throw createError({
      statusCode: 400,
      message: "License request is not open",
    });
  }

  const updatedRecord = await collection.updateOne(
    { identifier },
    {
      $set: {
        licenseId,
        licenseContent,
      },
    },
  );

  if (!updatedRecord) {
    throw createError({
      statusCode: 500,
      message: "license-request-update-failed",
    });
  }

  return {
    licenseId,
    licenseContent,
    identifier,
    owner: licenseRequest.owner,
    repo: licenseRequest.repo,
    timestamp: licenseRequest.timestamp,
  };
});

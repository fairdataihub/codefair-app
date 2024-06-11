import { MongoClient } from "mongodb";
import { z } from "zod";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  // todo: add schema
  const bodySchema = z.object({}).passthrough();

  const { identifier } = event.context.params as { identifier: string };

  const body = await readBody(event);

  if (!body) {
    throw createError({
      message: "Missing required fields",
      statusCode: 400,
    });
  }

  const parsedBody = bodySchema.safeParse(body);

  if (!parsedBody.success) {
    throw createError({
      message: "The provided parameters are invalid",
      statusCode: 400,
    });
  }

  const { metadata: rawMetadata } = parsedBody.data as { metadata: any };

  // Convert the creationDate and firstReleaseDate from number to a string date with the format "YYYY-MM-DD"
  if (rawMetadata.creationDate) {
    rawMetadata.creationDate = new Date(rawMetadata.creationDate).toISOString();
  }

  if (rawMetadata.firstReleaseDate) {
    rawMetadata.firstReleaseDate = new Date(
      rawMetadata.firstReleaseDate,
    ).toISOString();
  }

  if (rawMetadata.currentVersionReleaseDate) {
    rawMetadata.currentVersionReleaseDate = new Date(
      rawMetadata.currentVersionReleaseDate,
    ).toISOString();
  }

  if (rawMetadata.authors) {
    for (const author of rawMetadata.authors) {
      if (author.roles) {
        for (const role of author.roles) {
          if (role.startDate) {
            role.startDate = new Date(role.startDate).toISOString();
          }
          if (role.endDate) {
            role.endDate = new Date(role.endDate).toISOString();
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
            role.startDate = new Date(role.startDate).toISOString();
          }
          if (role.endDate) {
            role.endDate = new Date(role.endDate).toISOString();
          }
        }
      }
    }
  }

  const parsedMetadata = rawMetadata;

  const client = new MongoClient(process.env.MONGODB_URI as string, {});

  await client.connect();

  const db = client.db(process.env.MONGODB_DB_NAME);
  const collection = db.collection("codeMetadata");

  const codeMetadataRequest = await collection.findOne({
    identifier,
  });

  if (!codeMetadataRequest) {
    throw createError({
      message: "Code metadata request not found",
      statusCode: 404,
    });
  }

  // Check if the user is authorized to access the request
  await repoWritePermissions(
    event,
    codeMetadataRequest.owner,
    codeMetadataRequest.repo,
  );

  const updatedRecord = await collection.updateOne(
    { identifier },
    {
      $set: {
        ...parsedMetadata,
      },
    },
  );

  if (!updatedRecord) {
    throw createError({
      message: "code-metadata-request-update-failed",
      statusCode: 500,
    });
  }

  return {
    identifier,
    owner: codeMetadataRequest.owner,
    repo: codeMetadataRequest.repo,
    timestamp: codeMetadataRequest.timestamp,
  };
});

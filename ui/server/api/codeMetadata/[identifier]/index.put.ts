import { MongoClient } from "mongodb";
import { z } from "zod";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    metadata: z.object({
      name: z.string(),
      applicationCategory: z.string().optional().nullable(),
      authors: z.array(
        z.object({
          affiliation: z.string().optional(),
          email: z.string().optional(),
          familyName: z.string().optional(),
          givenName: z.string(),
          roles: z.array(
            z.object({
              endDate: z.number().optional().nullable(),
              role: z.string().nullable(),
              startDate: z.number().optional().nullable(),
            }),
          ),
          uri: z.string().optional(),
        }),
      ),
      codeRepository: z.string().optional(),
      continuousIntegration: z.string().optional(),
      contributors: z.array(
        z.object({
          affiliation: z.string().optional(),
          email: z.string().optional(),
          familyName: z.string().optional(),
          givenName: z.string(),
          roles: z.array(
            z.object({
              endDate: z.union([z.string(), z.number()]).optional().nullable(),
              role: z.string().nullable(),
              startDate: z.number().optional().nullable(),
            }),
          ),
          uri: z.string().optional(),
        }),
      ),
      creationDate: z.union([z.string(), z.number()]).optional().nullable(),
      currentVersion: z.string().optional(),
      currentVersionDownloadURL: z.string().optional(),
      currentVersionReleaseDate: z
        .union([z.string(), z.number()])
        .optional()
        .nullable(),
      currentVersionReleaseNotes: z.string().optional(),
      description: z.string(),
      developmentStatus: z.string().optional().nullable(),
      firstReleaseDate: z.union([z.string(), z.number()]).optional().nullable(),
      fundingCode: z.string().optional(),
      fundingOrganization: z.string().optional(),
      isPartOf: z.string().optional(),
      isSourceCodeOf: z.string().optional(),
      issueTracker: z.string().optional(),
      keywords: z.array(z.string()),
      license: z.string().nullable(),
      operatingSystem: z.array(z.string()).optional(),
      otherSoftwareRequirements: z.array(z.string()).optional(),
      programmingLanguages: z.array(z.string()),
      referencePublication: z.string().optional(),
      relatedLinks: z.array(z.string()).optional(),
      reviewAspect: z.string().optional(),
      reviewBody: z.string().optional(),
      runtimePlatform: z.array(z.string()).optional(),
      uniqueIdentifier: z.string().optional(),
    }),
  });

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
    console.error(parsedBody.error.errors);

    throw createError({
      data: parsedBody.error.errors,
      message: "The provided parameters are invalid",
      statusCode: 400,
    });
  }

  const { metadata: rawMetadata } = parsedBody.data;

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
        metadata: parsedMetadata,
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

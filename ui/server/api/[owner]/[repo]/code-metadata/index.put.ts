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
      license: z.string().nullable().optional(),
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

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  const body = await readBody(event);

  if (!body) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing required fields",
    });
  }

  const parsedBody = bodySchema.safeParse(body);

  if (!parsedBody.success) {
    console.error(parsedBody.error.errors);

    throw createError({
      data: parsedBody.error.errors,
      statusCode: 400,
      statusMessage: "The provided parameters are invalid",
    });
  }

  const { metadata: rawMetadata } = parsedBody.data;

  const parsedMetadata = rawMetadata;

  // remove license if it exists
  if ("license" in parsedMetadata) {
    delete parsedMetadata.license;
  }

  const codeMetadataRequest = await prisma.codeMetadata.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!codeMetadataRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "Code metadata request not found",
    });
  }

  // Check if the user is authorized to access the request
  await repoWritePermissions(event, owner, repo);

  const updatedRecord = await prisma.codeMetadata.update({
    data: {
      metadata: parsedMetadata,
    },
    where: {
      id: codeMetadataRequest.id,
    },
  });

  if (!updatedRecord) {
    throw createError({
      statusCode: 500,
      statusMessage: "code-metadata-request-update-failed",
    });
  }

  return {
    timestamp: updatedRecord.updated_at,
  };
});

import { z } from "zod";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const bodySchema = z.object({
    licenseId: z.string(),
    licenseContent: z.string(),
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
    throw createError({
      statusMessage: "The provided parameters are invalid",
      statusCode: 400,
    });
  }

  const { licenseId, licenseContent } = parsedBody.data;

  const licenseRequest = await prisma.licenseRequest.findFirst({
    where: {
      repository: {
        owner,
        repo,
      },
    },
  });

  if (!licenseRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "License request not found",
    });
  }

  // Check if the user is authorized to access the license request
  await repoWritePermissions(event, owner, repo);

  const updatedLicenseRequest = await prisma.licenseRequest.update({
    data: {
      license_id: licenseId,
      license_content: licenseContent,
      updated_at: new Date(),
    },
    where: {
      id: licenseRequest.id,
    },
  });

  if (!updatedLicenseRequest) {
    throw createError({
      statusCode: 500,
      statusMessage: "license-request-update-failed",
    });
  }

  return {
    licenseId,
    licenseContent,
  };
});

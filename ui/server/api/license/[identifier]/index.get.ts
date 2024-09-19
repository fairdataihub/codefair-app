import dayjs from "dayjs";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { identifier } = event.context.params as { identifier: string };

  const licenseRequest = await prisma.licenseRequest.findFirst({
    where: {
      identifier,
    },
    include: {
      repository: true,
    },
  });

  if (!licenseRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "license-request-not-found",
    });
  }

  // Check if the user is authorized to access the license request
  await repoWritePermissions(
    event,
    licenseRequest.repository.owner,
    licenseRequest.repository.repo,
  );

  const response: LicenseRequestGetResponse = {
    licenseId: licenseRequest.license_id,
    licenseContent: licenseRequest.license_content,
    identifier: licenseRequest.identifier,
    owner: licenseRequest.repository.owner,
    repo: licenseRequest.repository.repo,
    timestamp: Date.parse(licenseRequest.updated_at.toString()),
  };

  // return the valid license request
  return response;
});

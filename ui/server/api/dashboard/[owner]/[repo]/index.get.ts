export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  // Check if the user has write permissions to the repository
  await repoWritePermissions(event, owner, repo);
  const isOrg = await ownerIsOrganization(event, owner);
  await isOrganizationMember(event, isOrg, owner);

  // Check if the installation exists in the database
  const installation = await prisma.installation.findFirst({
    include: {
      codeMetadata: true,
      CwlValidation: true,
      LicenseRequest: true,
    },
    where: {
      owner,
      repo,
    },
  });

  if (!installation) {
    throw createError({
      statusCode: 404,
      statusMessage: "installation-not-found",
    });
  }

  const licenseRequest = installation.LicenseRequest[0];
  const codeMetadataRequest = installation.codeMetadata[0];
  const cwlValidation = installation.CwlValidation[0];

  return {
    codeMetadataRequest: codeMetadataRequest
      ? {
          citationStatus:
            (codeMetadataRequest.citation_status as string) || "invalid",
          codemetaStatus:
            (codeMetadataRequest.codemeta_status as string) || "invalid",
          containsCitation: codeMetadataRequest.contains_citation as boolean,
          containsCodemeta: codeMetadataRequest.contains_codemeta as boolean,
          containsMetadata: codeMetadataRequest.contains_metadata as boolean,
          identifier: codeMetadataRequest.identifier as string,
          owner: installation.owner as string,
          pullRequest: (codeMetadataRequest.pull_request_url as string) || "",
          repo: installation.repo as string,
          timestamp: codeMetadataRequest.updated_at as string,
        }
      : null,
    cwlValidation: cwlValidation
      ? {
          containsCWL: cwlValidation.contains_cwl_files as boolean,
          identifier: cwlValidation.identifier as string,
          open: cwlValidation.open as boolean,
          overallStatus: cwlValidation.overall_status as string,
          owner: cwlValidation.owner as string,
          repo: cwlValidation.repo as string,
        }
      : null,
    installationId: installation.installationId as number,
    isOrganization: isOrg as boolean,
    licenseRequest: licenseRequest
      ? {
          containsLicense:
            (licenseRequest.contains_license as boolean) || false,
          identifier: licenseRequest.identifier as string,
          licenseId: licenseRequest.licenseId as string,
          licenseStatus: (licenseRequest.license_status as string) || "invalid",
          open: licenseRequest.open as boolean,
          owner: licenseRequest.owner as string,
          pullRequest: (licenseRequest.pullRequestURL as string) || "",
          repo: licenseRequest.repo as string,
          timestamp: licenseRequest.updated_at as string,
        }
      : null,
  };
});

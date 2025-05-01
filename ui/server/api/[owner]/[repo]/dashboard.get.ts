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
      CodeMetadata: true,
      CwlValidation: true,
      LicenseRequest: true,
      ReadmeValidation: true,
      ZenodoDeposition: true,
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

  const lrRaw = installation.LicenseRequest;
  const cmRaw = installation.CodeMetadata;
  const cwlRaw = installation.CwlValidation;
  const zenRaw = installation.ZenodoDeposition;
  const rmRaw = installation.ReadmeValidation;

  const codeMetadataRequest = {
    citationStatus: cmRaw?.citation_status ?? "invalid",
    codemetaStatus: cmRaw?.codemeta_status ?? "invalid",
    containsCitation: cmRaw?.contains_citation ?? false,
    containsCodemeta: cmRaw?.contains_codemeta ?? false,
    containsMetadata: cmRaw?.contains_metadata ?? false,
    identifier: cmRaw?.identifier ?? "",
    owner: installation.owner,
    pullRequest: cmRaw?.pull_request_url ?? "",
    repo: installation.repo,
    timestamp: cmRaw?.updated_at ?? null,
  };

  const licenseRequest = {
    containsLicense: lrRaw?.contains_license ?? false,
    identifier: lrRaw?.identifier ?? "",
    licenseId: lrRaw?.license_id ?? null,
    licenseStatus: lrRaw?.license_status ?? "invalid",
    owner: installation.owner,
    pullRequest: lrRaw?.pull_request_url ?? "",
    repo: installation.repo,
    timestamp: lrRaw?.updated_at ?? null,
  };

  const readmeValidation = {
    readmeContent: rmRaw?.readme_content ?? "",
    readmeExists: rmRaw?.contains_readme ?? false,
    readMePath: rmRaw?.readme_path ?? "",
    timestamp: rmRaw?.updated_at ?? null,
  };

  const cwlValidation = {
    containsCWL: cwlRaw?.contains_cwl_files ?? false,
    identifier: cwlRaw?.identifier ?? "",
    overallStatus: cwlRaw?.overall_status ?? "",
    owner: installation.owner,
    repo: installation.repo,
  };

  const zenodoDeposition = {
    lastPublishedZenodoDoi: zenRaw?.last_published_zenodo_doi ?? null,
    zenodoId: zenRaw?.zenodo_id ?? null,
    zenodoStatus: zenRaw?.status ?? null,
  };

  return {
    codeMetadataRequest,
    cwlValidation,
    installationId: installation.installation_id,
    isOrganization: isOrg,
    licenseRequest,
    readmeValidation,
    zenodoDeposition,
  };
});

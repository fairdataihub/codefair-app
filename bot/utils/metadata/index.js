import {
  gatherLanguagesUsed,
  gatherRepoAuthors,
  getDOI,
} from "../tools/index.js";

/**
 * * Gathers metadata to create a citation.cff and codemeta.json file
 *
 * @param {string} context - Event context
 * @param {string} owner - The owner of the repository
 * @param {object} repo - The repository object
 *
 * @returns {object} - An object containing the metadata for the repository
 */
export async function gatherMetadata(context, owner, repo) {
  console.log("Gathering metadata...");
  // Gather the metadata needed to create both citation.cff and codemeta.json files
  const repoData = await context.octokit.repos.get({
    owner,
    repo,
  });

  const releases = await context.octokit.repos.listReleases({
    owner,
    repo,
  });

  const doi = await getDOI(context, owner, repo);
  const languagesUsed = await gatherLanguagesUsed(context, owner, repo);
  const citationAuthors = await gatherRepoAuthors(
    context,
    owner,
    repo,
    "citation",
  );
  let url;
  if (repoData.data.homepage != null) {
    url = repoData.data.homepage;
  }
  const codeMeta = {
    name: repoData.data.name,
    applicationCategory: "",
    authors: citationAuthors || [],
    codeRepository: repoData.data.html_url,
    continuousIntegration: "",
    creationDate: repoData.data.created_at || "",
    currentVersion: releases.data[0]?.tag_name || "",
    currentVersionDownloadURL: releases.data[0]?.html_url || "",
    currentVersionReleaseDate: releases.data[0]?.published_at || null,
    currentVersionReleaseNotes: releases.data[0]?.body || "",
    description: repoData.data.description,
    developmentStatus: "",
    firstReleaseDate: releases.data[0]?.published_at || null,
    fundingCode: "",
    fundingOrganization: "",
    isPartOf: "",
    isSourceCodeOf: "",
    issueTracker: repoData.data.issues_url.replace("{/number}", ""),
    keywords: repoData.data.topics || [],
    license:
      repoData.data.license?.spdx_id === "NOASSERTION"
        ? null
        : repoData.data.license?.spdx_id || null,
    operatingSystem: null,
    otherSoftwareRequirements: [],
    programmingLanguages: languagesUsed || [],
    referencePublication: doi[1] || "",
    relatedLinks: [],
    reviewAspect: "",
    reviewBody: "",
    runtimePlatform: null,
    uniqueIdentifier: "",
  };

  return codeMeta;
}

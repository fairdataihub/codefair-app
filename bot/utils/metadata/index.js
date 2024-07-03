import {
  gatherLanguagesUsed,
  gatherRepoAuthors,
  getDOI,
} from "../tools/index.js";

export function convertMetadataForDB(codemetaContent) {
  // TODO: License is a url, db needs the SPDX identifier
  const metadata = {
    name: codemetaContent?.name || null,
    applicationCategory: codemetaContent?.applicationCategory || null,
    // authors: codemetaContent.author,
    codeRepository: codemetaContent?.codeRepository,
    continuousIntegration:
      codemetaContent?.["codemeta:continuousIntegration"]?.id || "",
    creationDate: codemetaContent?.dateCreated
      ? new Date(codemetaContent.dateCreated).getTime() / 1000
      : null,
    currentVersion: codemetaContent?.version || "",
    currentVersionDownloadURL: codemetaContent?.downloadUrl || "",
    currentVersionReleaseDate: codemetaContent?.dateModified
      ? new Date(codemetaContent?.dateModified).getTime() / 1000
      : null,
    currentVersionReleaseNotes: codemetaContent?.["schema:releaseNotes"] || "",
    description: codemetaContent?.description || "",
    developmentStatus: codemetaContent?.developmentStatus || null,
    firstReleaseDate: codemetaContent?.datePublished
      ? new Date(codemetaContent.datePublished).getTime() / 1000
      : null,
    fundingCode: codemetaContent?.funding || "",
    fundingOrganization: codemetaContent?.funding.name || "",
    isPartOf: codemetaContent?.isPartOf || "",
    isSourceCodeOf: codemetaContent?.["codemeta:isSourceCodeOf"]?.id || "",
    issueTracker: codemetaContent?.issueTracker || "",
    keywords: codemetaContent?.keywords || [],
    license: codemetaContent?.license || null,
    operatingSystem: codemetaContent?.operatingSystem || [],
    otherSoftwareRequirements: codemetaContent?.softwareRequirements || [],
    programmingLanguages: codemetaContent?.programmingLanguage || [],
    referencePublication: codemetaContent?.referencePublication || "",
    relatedLinks: codemetaContent?.relatedLinks || [],
    reviewAspect: codemetaContent?.reviewAspect || "",
    reviewBody: codemetaContent?.reviewBody || "",
    runtimePlatform: codemetaContent?.runtimePlatform || [],
    uniqueIdentifier: codemetaContent?.identifier || "",
  };

  if (codemetaContent.author) {
    // Map the author to the metadata object
    metadata.authors = codemetaContent.author.map((author) => {
      if (author?.type === "Role" && metadata.authors.length > 0) {
        for (let i = 0; i < metadata.authors.length; i++) {
          if (metadata.authors[i].uri === author?.["schema:author"]) {
            metadata.authors[i].roles = {
              endDate: author?.["schema:endDate"],
              role: author?.["schema:roleName"],
              startDate: author?.["schema:startDate"],
            };
          }
        }
      }
      return {
        affiliation: author?.affiliation?.name,
        email: author?.email,
        familyName: author?.familyName,
        givenName: author?.givenName,
        uri: author?.id,
      };
    });
  }

  if (codemetaContent.contributor) {
    metadata.contributors = codemetaContent.contributor.map((contributor) => {
      if (
        contributor?.type === "schema:Role" &&
        metadata.contributors.length > 0
      ) {
        for (let i = 0; i < metadata.contributors.length; i++) {
          if (
            metadata.contributors[i].uri === contributor?.["schema:contributor"]
          ) {
            metadata.contributors[i].roles = {
              endDate: contributor?.["schema:endDate"],
              role: contributor?.["schema:roleName"],
              startDate: contributor?.["schema:startDate"],
            };
          }
        }
      }

      return {
        affiliation: contributor?.affiliation?.name,
        email: contributor?.email,
        familyName: contributor?.familyName,
        givenName: contributor?.givenName,
        uri: contributor?.id,
      };
    });
  }

  return metadata;
}

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

  // Get the metadata of the repo
  const repoData = await context.octokit.repos.get({
    owner,
    repo: repo.name,
  });

  // Get the release data of the repo
  const releases = await context.octokit.repos.listReleases({
    owner,
    repo: repo.name,
  });

  // Get authors, doi and languages used of repo
  const doi = await getDOI(context, owner, repo.name);
  const languagesUsed = await gatherLanguagesUsed(context, owner, repo.name);
  const citationAuthors = await gatherRepoAuthors(
    context,
    owner,
    repo.name,
    "citation",
  );
  let url;
  if (repoData.data.homepage != null) {
    url = repoData.data.homepage;
  }
  const codeMeta = {
    name: repoData.data.name,
    applicationCategory: null,
    authors: citationAuthors || [],
    codeRepository: repoData.data.html_url,
    continuousIntegration: "",
    contributors: [],
    creationDate: Date.parse(repoData.data.created_at) || null,
    currentVersion: releases.data[0]?.tag_name || "",
    currentVersionDownloadURL: releases.data[0]?.html_url || "",
    currentVersionReleaseDate:
      Date.parse(releases.data[0]?.published_at) || null,
    currentVersionReleaseNotes: releases.data[0]?.body || "",
    description: repoData.data.description,
    developmentStatus: null,
    firstReleaseDate: Date.parse(releases.data[0]?.published_at) || null,
    fundingCode: "",
    fundingOrganization: "",
    isPartOf: "",
    isSourceCodeOf: "",
    issueTracker: `https://github.com/${owner}/${repo.name}/issues`,
    keywords: repoData.data.topics || [],
    license:
      repoData.data.license?.spdx_id === "NOASSERTION"
        ? null
        : repoData.data.license?.spdx_id || null,
    operatingSystem: [],
    otherSoftwareRequirements: [],
    programmingLanguages: languagesUsed || [],
    referencePublication: doi[1] || "",
    relatedLinks: [],
    reviewAspect: "",
    reviewBody: "",
    runtimePlatform: [],
    uniqueIdentifier: "",
  };

  return codeMeta;
}

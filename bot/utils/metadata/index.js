import {
  gatherLanguagesUsed,
  gatherRepoAuthors,
  getDOI,
} from "../tools/index.js";

/**
 * * Converts the date to a Unix timestamp
 * 
 * @param {string} date - The date to convert to Unix timestamp 
 * 
 * @returns {number} - The Unix timestamp of the date
 */
export function convertDateToUnix(date) {
  // Convert to a Date object
  const newDate = new Date(date);

  // Convert to Unix timestamp (in milliseconds)
  return Math.floor(newDate.getTime());
}

/**
 * * Converts the codemeta.json file content to a metadata object for the database
 * 
 * @param {JSON} codemetaContent - The codemeta.json file content
 * 
 * @returns {JSON} - The metadata object for the database
 */
export function convertMetadataForDB(codemetaContent) {
  let sortedAuthors = [];
  let sortedContributors = [];

  if (codemetaContent?.author) {
    // Map the author to the metadata object
    codemetaContent.author.forEach((author) => {
      if (author?.type === "Role" && sortedAuthors.length > 0) {
        for (let i = 0; i < sortedAuthors.length; i++) {
          if (sortedAuthors[i].uri === author?.["schema:author"]) {
            sortedAuthors[i].roles = {
              endDate: author?.["endDate"] ? convertDateToUnix(author?.["endDate"]) : null,
              role: author?.["roleName"] || null,
              startDate: author?.["startDate"] ? convertDateToUnix(author?.["startDate"]) : null,
            };
            return;
          }
        }
      }
      sortedAuthors.push({
        affiliation: author?.affiliation?.name || "",
        email: author?.email || "",
        familyName: author?.familyName || "",
        givenName: author?.givenName || "",
        uri: author?.id || "",
        roles: [],
      });
    });
  }

  if (codemetaContent?.contributor) {
    // Map the author to the metadata object
    codemetaContent.contributor.forEach((contributor) => {
      if (contributor?.roleName && sortedContributors.length > 0) {
        for (let i = 0; i < sortedContributors.length; i++) {
          if (sortedContributors[i].uri === contributor?.["schema:contributor"]) {
            sortedContributors[i].roles = {
              endDate: contributor?.["endDate"] ? convertDateToUnix(contributor?.["endDate"]) : null,
              role: contributor?.["roleName"] || null,
              startDate: contributor?.["startDate"] ? convertDateToUnix(contributor?.["startDate"]) : null,
            };
            return;
          }
        }
      }
      sortedContributors.push({
        affiliation: contributor?.affiliation?.name || "",
        email: contributor?.email || "",
        familyName: contributor?.familyName || "",
        givenName: contributor?.givenName || "",
        uri: contributor?.id || "",
        roles: [],
      });
    });
  }

  const regex = /https:\/\/spdx\.org\/licenses\/(.*)/;
  const url = codemetaContent.license;

  const match = url.match(regex);
  let licenseId = null;

  if (match) {
    licenseId = match[1];
  }

  return {
    name: codemetaContent?.name || null,
    applicationCategory: codemetaContent?.applicationCategory || null,
    authors: sortedAuthors,
    contributors: sortedContributors,
    codeRepository: codemetaContent?.codeRepository || "",
    continuousIntegration:
      codemetaContent?.["codemeta:continuousIntegration"]?.id || "",
    creationDate: codemetaContent?.dateCreated
      ? convertDateToUnix(codemetaContent?.dateCreated)
      : null,
    currentVersion: codemetaContent?.version || "",
    currentVersionDownloadURL: codemetaContent?.downloadUrl || "",
    currentVersionReleaseDate: codemetaContent?.dateModified
      ? convertDateToUnix(codemetaContent?.dateModified)
      : null,
    currentVersionReleaseNotes: codemetaContent?.["schema:releaseNotes"] || "",
    description: codemetaContent?.description || "",
    developmentStatus: codemetaContent?.developmentStatus || null,
    firstReleaseDate: codemetaContent?.datePublished
      ? convertDateToUnix(codemetaContent?.datePublished)
      : null,
    fundingCode: codemetaContent?.funding || "",
    fundingOrganization: codemetaContent?.funding.name || "",
    isPartOf: codemetaContent?.isPartOf || "",
    isSourceCodeOf: codemetaContent?.["codemeta:isSourceCodeOf"]?.id || "",
    issueTracker: codemetaContent?.issueTracker || "",
    keywords: codemetaContent?.keywords || [],
    license: licenseId,
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

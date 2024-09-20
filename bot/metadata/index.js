import { consola } from "consola";
import yaml from "js-yaml";
import {
  gatherLanguagesUsed,
  gatherRepoAuthors,
  getDOI,
  createId,
} from "../utils/tools/index.js";
import dbInstance from "../db.js";

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

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
 * @param {JSON} codemetaContent - The codemeta.json file content
 * @returns {JSON} - The metadata object for the database
 */
export function convertMetadataForDB(codemetaContent) {
  // eslint-disable-next-line prefer-const
  let sortedAuthors = [];
  // eslint-disable-next-line prefer-const
  let sortedContributors = [];

  if (codemetaContent?.author) {
    // Map the author to the metadata object
    codemetaContent.author.forEach((author) => {
      if (author?.type === "Role" && sortedAuthors.length > 0) {
        for (let i = 0; i < sortedAuthors.length; i++) {
          if (sortedAuthors[i].uri === author?.["schema:author"]) {
            const roleObj = {};
            if (author?.roleName) {
              roleObj.role = author?.roleName;
            }

            if (author?.startDate) {
              roleObj.startDate = convertDateToUnix(author?.startDate);
            }

            if (author?.endDate) {
              roleObj.endDate = convertDateToUnix(author?.endDate);
            }

            sortedAuthors[i].roles.push(roleObj);

            return;
          }
        }
      }
      sortedAuthors.push({
        affiliation: author?.affiliation?.name || "",
        email: author?.email || "",
        familyName: author?.familyName || "",
        givenName: author?.givenName || "",
        roles: [],
        uri: author?.id || "",
      });
    });
  }

  if (codemetaContent?.contributor) {
    // Map the author to the metadata object
    codemetaContent.contributor.forEach((contributor) => {
      if (contributor?.roleName && sortedContributors.length > 0) {
        for (let i = 0; i < sortedContributors.length; i++) {
          if (
            sortedContributors[i].uri === contributor?.["schema:contributor"]
          ) {
            const roleObj = {};
            if (contributor?.roleName) {
              roleObj.role = contributor?.roleName;
            }

            if (contributor?.startDate) {
              roleObj.startDate = convertDateToUnix(contributor?.startDate);
            }

            if (contributor?.endDate) {
              roleObj.endDate = convertDateToUnix(contributor?.endDate);
            }

            sortedContributors[i].roles.push(roleObj);

            return;
          }
        }
      }
      sortedContributors.push({
        affiliation: contributor?.affiliation?.name || "",
        email: contributor?.email || "",
        familyName: contributor?.familyName || "",
        givenName: contributor?.givenName || "",
        roles: [],
        uri: contributor?.id || "",
      });
    });
  }

  // Now search through sortedAuthors and sortedContributors and check if uri begins with '_:' and if so, delete the key
  for (let i = 0; i < sortedAuthors.length; i++) {
    if (sortedAuthors[i].uri.startsWith("_:")) {
      delete sortedAuthors[i].uri;
    }
  }

  for (let i = 0; i < sortedContributors.length; i++) {
    if (sortedContributors[i].uri.startsWith("_:")) {
      delete sortedContributors[i].uri;
    }
  }

  const regex = /https:\/\/spdx\.org\/licenses\/(.*)/;
  let licenseId = null;
  if (codemetaContent?.license) {
    const url = codemetaContent.license;
    const match = url.match(regex);

    if (match) {
      licenseId = match[1];
    }
  }

  return {
    name: codemetaContent?.name || null,
    applicationCategory: codemetaContent?.applicationCategory || null,
    authors: sortedAuthors,
    codeRepository: codemetaContent?.codeRepository || "",
    continuousIntegration:
      codemetaContent?.["codemeta:continuousIntegration"]?.id || "",
    contributors: sortedContributors,
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
    fundingOrganization: codemetaContent?.funding?.name || "",
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
  consola.start("Gathering metadata...");

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

  consola.success("Metadata gathered!");

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

/**
 * * Applies the metadata template to the base template (CITATION.cff and codemeta.json)
 *
 * @param {object} subjects - The subjects to check for
 * @param {string} baseTemplate - The base template to add to
 * @param {object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 * @param {object} context - The GitHub context object
 *
 * @returns {string} - The updated base template
 */
export async function applyMetadataTemplate(
  subjects,
  baseTemplate,
  repository,
  owner,
  context,
) {
  if ((!subjects.codemeta || !subjects.citation) && subjects.license) {
    // License was found but no codemeta.json or CITATION.cff exists
    const identifier = createId();
    let validCitation = false;
    let validCodemeta = false;

    let url = `${CODEFAIR_DOMAIN}/add/code-metadata/${identifier}`;

    const metadataCollection = dbInstance.codeMetadata;
    const existingMetadata = await metadataCollection.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (subjects.codemeta) {
      try {
        const codemetaFile = await context.octokit.repos.getContent({
          owner,
          path: "codemeta.json",
          repo: repository.name,
        });

        JSON.parse(Buffer.from(codemetaFile.data.content, "base64").toString());

        validCodemeta = true;
      } catch (error) {
        consola.error("Error getting codemeta.json file", error);
      }
    }

    if (subjects.citation) {
      try {
        const citationFile = await context.octokit.repos.getContent({
          owner,
          path: "CITATION.cff",
          repo: repository.name,
        });

        yaml.load(Buffer.from(citationFile.data.content, "base64").toString());
        validCitation = true;
      } catch (error) {
        consola.error("Error getting CITATION.cff file", error);
      }
    }

    if (!existingMetadata) {
      // Entry does not exist in db, create a new one
      const newDate = new Date();
      const gatheredMetadata = await gatherMetadata(context, owner, repository);
      await metadataCollection.create({
        data: {
          citation_status: validCitation ? "valid" : "invalid",
          codemeta_status: validCodemeta ? "valid" : "invalid",
          contains_citation: subjects.citation,
          contains_codemeta: subjects.codemeta,
          contains_metadata: subjects.codemeta && subjects.citation,
          created_at: newDate,
          identifier,
          metadata: gatheredMetadata,
          updated_at: newDate,
          repository: {
            connect: {
              id: repository.id,
            },
          },
        },
      });
    } else {
      // Get the identifier of the existing metadata request
      await metadataCollection.update({
        data: {
          citation_status: validCitation ? "valid" : "invalid",
          codemeta_status: validCodemeta ? "valid" : "invalid",
          contains_citation: subjects.citation,
          contains_codemeta: subjects.codemeta,
          contains_metadata: subjects.codemeta && subjects.citation,
          updated_at: new Date(),
        },
        where: { repository_id: repository.id },
      });

      url = `${CODEFAIR_DOMAIN}/add/code-metadata/${existingMetadata.identifier}`;
    }
    const metadataBadge = `[![Metadata](https://img.shields.io/badge/Add_Metadata-dc2626.svg)](${url})`;
    baseTemplate += `\n\n## Metadata ❌\n\nTo make your software FAIR, a CITATION.cff and codemetada.json are expected at the root level of your repository. These files are not found in the repository. If you would like Codefair to add these files, click the "Add metadata" button below to go to our interface for providing metadata and generating these files.\n\n${metadataBadge}`;
  }

  if (subjects.codemeta && subjects.citation && subjects.license) {
    // Download the codemeta.json file from the repo
    let validCodemeta = false;
    let validCitation = false;

    let codemetaFile = null;
    let citationFile = null;

    try {
      codemetaFile = await context.octokit.repos.getContent({
        owner,
        path: "codemeta.json",
        repo: repository.name,
      });

      JSON.parse(Buffer.from(codemetaFile.data.content, "base64").toString());

      validCodemeta = true;
    } catch (error) {
      consola.error("Error getting codemeta.json file", error);
    }

    try {
      citationFile = await context.octokit.repos.getContent({
        owner,
        path: "CITATION.cff",
        repo: repository.name,
      });

      yaml.load(Buffer.from(citationFile.data.content, "base64").toString());
      validCitation = true;
    } catch (error) {
      consola.error("Error getting CITATION.cff file", error);
    }

    // Convert the content to a json object
    const codemetaContent = JSON.parse(
      Buffer.from(codemetaFile.data.content, "base64").toString(),
    );

    // Convert the content to the structure we use for code metadata
    const metadata = convertMetadataForDB(codemetaContent);

    // License, codemeta.json and CITATION.cff files were found
    const identifier = createId();

    let url = `${CODEFAIR_DOMAIN}/add/code-metadata/${identifier}`;

    const metadataCollection = dbInstance.codeMetadata;
    const existingMetadata = await metadataCollection.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (!existingMetadata) {
      // Entry does not exist in db, create a new one
      const newDate = new Date();
      // const gatheredMetadata = await gatherMetadata(context, owner, repository);
      await metadataCollection.create({
        data: {
          citation_status: validCitation ? "valid" : "invalid",
          codemeta_status: validCodemeta ? "valid" : "invalid",
          contains_citation: subjects.citation,
          contains_codemeta: subjects.codemeta,
          contains_metadata: subjects.codemeta && subjects.citation,
          created_at: newDate,
          identifier,
          metadata,
          owner,
          repo: repository.name,
          repository_id: repository.id,
          updated_at: newDate,
        },
      });
    } else {
      // Get the identifier of the existing metadata request
      await metadataCollection.update({
        data: {
          citation_status: validCitation ? "valid" : "invalid",
          codemeta_status: validCodemeta ? "valid" : "invalid",
          contains_citation: subjects.citation,
          contains_codemeta: subjects.codemeta,
          contains_metadata: subjects.codemeta && subjects.citation,
          metadata,
          updated_at: new Date(),
        },
        where: { repository_id: repository.id },
      });

      url = `${CODEFAIR_DOMAIN}/add/code-metadata/${existingMetadata.identifier}`;
    }
    const metadataBadge = `[![Metadata](https://img.shields.io/badge/Edit_Metadata-0ea5e9.svg)](${url}?)`;
    baseTemplate += `\n\n## Metadata ✔️\n\nA CITATION.cff and a codemeta.json file are found in the repository. They may need to be updated over time as new people are contributing to the software, etc.\n\n${metadataBadge}`;
  }

  if (!subjects.license) {
    // License was not found
    const metadataBadge = `![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`;
    baseTemplate += `\n\n## Metadata\n\nTo make your software FAIR a CITATION.cff and codemetada.json metadata files are expected at the root level of your repository. Codefair will check for these files after a license file is detected.\n\n${metadataBadge}`;
  }

  return baseTemplate;
}

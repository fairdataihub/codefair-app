import { consola } from "consola";
import yaml from "js-yaml";
import {
  gatherLanguagesUsed,
  gatherRepoAuthors,
  getDOI,
  createId,
} from "../utils/tools/index.js";
import dbInstance from "../db.js";
import { logwatch } from "../utils/logwatch.js";

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const { GH_APP_NAME } = process.env;

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
export async function convertCodemetaForDB(codemetaContent, repository) {
  try {
    // eslint-disable-next-line prefer-const
    const sortedAuthors = [];
    // eslint-disable-next-line prefer-const
    const sortedContributors = [];
    if (codemetaContent?.author) {
      codemetaContent?.author.forEach((author) => {
        // If the author is a Person or Organization, we need to add them
        if (author.type === "Person" || author.type === "Organization") {
          sortedAuthors.push({
            affiliation: author?.affiliation?.name || "",
            email: author?.email || "",
            familyName: author?.familyName || "",
            givenName: author?.givenName || "",
            roles: [], // Roles will be added later
            uri: author?.id || "",
          });
        }
      });

      // Loop through the authors again to handle roles
      codemetaContent?.author.forEach((author) => {
        if (author.type === "Role") {
          // Find the author that matches the "schema:author" field of the role
          sortedAuthors.forEach((sortedAuthor) => {
            if (sortedAuthor.uri === author?.["schema:author"]) {
              // Create the role object
              const roleObj = {
                role: author.roleName || "",
                startDate: author.startDate
                  ? convertDateToUnix(author.startDate)
                  : null,
                endDate: author.endDate
                  ? convertDateToUnix(author.endDate)
                  : null,
              };
              // Add the role to the author's roles array
              sortedAuthor.roles.push(roleObj);
            }
          });
        }
      });
    }

    if (codemetaContent?.contributor) {
      // Loop through all contributors
      codemetaContent?.contributor.forEach((contributor) => {
        // If the contributor is a Person or Organization, we need to add them
        if (
          contributor.type === "Person" ||
          contributor.type === "Organization"
        ) {
          sortedContributors.push({
            affiliation: contributor?.affiliation?.name || "",
            email: contributor?.email || "",
            familyName: contributor?.familyName || "",
            givenName: contributor?.givenName || "",
            roles: [], // Roles will be added later
            uri: contributor?.id || "",
          });
        }
      });

      // Loop through the contributors again to handle roles
      codemetaContent?.contributor.forEach((contributor) => {
        if (contributor.type === "Role") {
          // Find the contributor that matches the "contributor" field of the role
          sortedContributors.forEach((sortedContributor) => {
            if (
              sortedContributor.uri === contributor?.contributor ||
              sortedContributor.uri === contributor["schema:contributor"]
            ) {
              // Create the role object
              const roleObj = {
                role: contributor.roleName || "",
                startDate: contributor.startDate
                  ? convertDateToUnix(contributor.startDate)
                  : null,
                endDate: contributor.endDate
                  ? convertDateToUnix(contributor.endDate)
                  : null,
              };
              // Add the role to the contributor's roles array
              sortedContributor.roles.push(roleObj);
            }
          });
        }
      });
    }

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

    if (licenseId === null) {
      // Fetch license details from database
      const license = await dbInstance.licenseRequest.findUnique({
        where: {
          repository_id: repository.id,
        },
      });

      if (license?.license_id) {
        licenseId = `https://spdx.org/licenses/${license.license_id}`;
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
      currentVersionReleaseNotes:
        codemetaContent?.["schema:releaseNotes"] || "",
      description: codemetaContent?.description || "",
      developmentStatus: codemetaContent?.developmentStatus || null,
      firstReleaseDate: codemetaContent?.datePublished
        ? convertDateToUnix(codemetaContent?.datePublished)
        : null,
      fundingCode: codemetaContent?.funding || "",
      fundingOrganization: codemetaContent?.funder?.name || "",
      isPartOf: codemetaContent?.isPartOf || "",
      isSourceCodeOf: codemetaContent?.["codemeta:isSourceCodeOf"]?.id || "",
      issueTracker: codemetaContent?.issueTracker || "",
      keywords: codemetaContent?.keywords || [],
      license: licenseId,
      operatingSystem: codemetaContent?.operatingSystem || [],
      otherSoftwareRequirements: codemetaContent?.softwareRequirements || [],
      programmingLanguages: codemetaContent?.programmingLanguage || [],
      referencePublication: codemetaContent?.referencePublication || "",
      relatedLinks: codemetaContent?.relatedLink || [],
      reviewAspect: codemetaContent?.reviewAspect || "",
      reviewBody: codemetaContent?.reviewBody || "",
      runtimePlatform: codemetaContent?.runtimePlatform || [],
      uniqueIdentifier: codemetaContent?.identifier || "",
    };
  } catch (error) {
    throw new Error("Error converting codemeta.json file to metadata object", {
      cause: error,
    });
  }
}

/**
 * * Converts the CITATION.cff file content to a metadata object for the database
 * @param {YAML} citationContent - The CITATION.cff file content loaded as a YAML object
 * @param {Object} repository - The repository information
 * @returns {Object} - The metadata object for the database
 */
export async function convertCitationForDB(citationContent, repository) {
  try {
    const authors = [];

    if (citationContent?.authors) {
      citationContent.authors.forEach((author) => {
        authors.push({
          affiliation: author.affiliation || "",
          email: author.email || "",
          familyName: author["family-names"] || "",
          givenName: author["given-names"] || "",
        });
      });
    }

    return {
      authors,
      uniqueIdentifier: citationContent?.doi || null,
      license: citationContent?.license || null,
      codeRepository: citationContent["repository-code"] || null,
      description: citationContent.abstract || null,
      currentVersionReleaseDate: citationContent["date-released"] || null,
      currentVersion: citationContent.version || null,
      keywords: citationContent.keywords || null,
    };
  } catch (error) {
    throw new Error("Error converting CITATION.cff file to metadata object", {
      cause: error,
    });
  }
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
  consola.start("Gathering initial metadata from GitHub API...");

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
    description: repoData.data.description || "",
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
 * * Gets the metadata for the repository and returns it as a string
 * @param {Object} context - The GitHub context object
 * @param {String} owner - The owner of the repository
 * @param {Object} repository - Object containing the repository information
 * @returns - The content of the codemeta.json file as a string object
 */
export async function getCodemetaContent(context, owner, repository) {
  try {
    const codemetaFile = await context.octokit.repos.getContent({
      owner,
      path: "codemeta.json",
      repo: repository.name,
    });

    return {
      content: Buffer.from(codemetaFile.data.content, "base64").toString(),
      sha: codemetaFile.data.sha,
      file_path: codemetaFile.data.download_url,
    };

    // return JSON.parse(Buffer.from(codemetaFile.data.content, "base64").toString());
  } catch (error) {
    throw new Error("Error getting codemeta.json file", error);
  }
}

/**
 * * Get the content of the CITATION.cff file
 * @param {Object} context - The GitHub context object
 * @param {String} owner - The owner of the repository
 * @param {Object} repository - The repository information
 * @returns {String} - The content of the CITATION.cff file as a string object (need to yaml load it)
 */
export async function getCitationContent(context, owner, repository) {
  try {
    const citationFile = await context.octokit.repos.getContent({
      owner,
      path: "CITATION.cff",
      repo: repository.name,
    });

    return {
      content: Buffer.from(citationFile.data.content, "base64").toString(),
      sha: citationFile.data.sha,
      file_path: citationFile.data.download_url,
    };
  } catch (error) {
    throw new Error("Error getting CITATION.cff file", error);
  }
}

/**
 * * Ensures the metadata is valid based on certain fields
 * @param {String} content - The content of the metadata file
 * @param {String} fileType - The type of metadata file (codemeta or citation)
 * @param {String} file_path - Raw GitHub file path
 * @returns
 */
export async function validateMetadata(metadataInfo, fileType, repository) {
  if (fileType === "codemeta") {
    try {
      const cleanContent = metadataInfo.content.trim();
      const normalizedContent = cleanContent.replace(/^\uFEFF/, ""); // Remove BOM if present
      let loaded_file = null;
      try {
        loaded_file = JSON.parse(normalizedContent);
      } catch (error) {
        await dbInstance.codeMetadata.update({
          where: {
            repository_id: repository.id,
          },
          data: {
            codemeta_validation_message: "Error parsing the codemeta.json file",
            codemeta_status: "invalid",
          },
        });
        return false;
      }
      // Verify the required fields are present
      if (
        !loaded_file.name ||
        !loaded_file.author ||
        !loaded_file.description
      ) {
        return false;
      }

      consola.start("Sending content to metadata validator");
      try {
        const response = await fetch(
          "https://staging-validator.codefair.io/validate-codemeta",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              file_content: loaded_file,
            }),
          },
        );

        if (!response.ok) {
          const data = await response.json();
          logwatch.error(
            {
              status: response.status,
              error: data,
              file: "codemeta.json",
            },
            true,
          );
          throw new Error(
            "Error validating the codemeta.json file",
            data,
          );
        }
        const data = await response.json();
        consola.info("Codemeta validation response", data);

        let validationMessage = `The codemeta.json file is valid according to the ${data.version} codemeta.json schema.`;
        if (data.message !== "valid") {
          validationMessage = data.error;
        }

        await dbInstance.codeMetadata.update({
          where: {
            repository_id: repository.id,
          },
          data: {
            codemeta_validation_message: validationMessage,
            codemeta_status: data.message,
          },
        });

        return data.message === "valid";
      } catch (error) {
        logwatch.error(`error parsing the codemeta.json file: ${error}`);
        consola.error("Error validating the codemeta.json file", error);

        return false;
      }
    } catch (error) {
      return false;
    }
  }

  if (fileType === "citation") {
    try {
      try {
        yaml.load(metadataInfo.content);
      } catch (error) {
        await dbInstance.codeMetadata.update({
          where: {
            repository_id: repository.id,
          },
          data: {
            citation_validation_message: "Error parsing the CITATION.cff file",
            citation_status: "invalid",
          },
        });
        return false;
      }
      const loaded_file = yaml.load(metadataInfo.content);
      consola.start("Validating the CITATION.cff file");
      // Verify the required fields are present
      if (!loaded_file.title || !loaded_file.authors) {
        return false;
      }

      try {
        // TODO: CHANGE THIS BEFORE DEPLOYING TO MAIN
        const response = await fetch(
          "https://staging-validator.codefair.io/validate-citation",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              file_path: metadataInfo.file_path,
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Error validating the CITATION.cff file", response);
        }

        const data = await response.json();

        consola.info("Citation validation response", data);
        let validationMessage = "";
        if (data.message === "valid") {
          validationMessage = data.output;
        } else {
          validationMessage = data.error;
        }

        await dbInstance.codeMetadata.update({
          where: {
            repository_id: repository.id,
          },
          data: {
            citation_validation_message: validationMessage,
            citation_status: data.message,
          },
        });

        return data.message === "valid";
      } catch (error) {
        consola.error("Error validating the CITATION.cff file", error);
        return false;
      }
    } catch (error) {
      return false;
    }
  }
}

/**
 * * Updates the metadata files with the Zenodo identifier
 * @param {Object} context - The GitHub context object
 * @param {String} owner - The owner of the repository
 * @param {Object} repository - The repository information
 * @param {String} identifier - The Zenodo identifier
 * @param {String} version - The version of the software
 * @returns {Object} - The updated codemeta.json file
 */
export async function updateMetadataIdentifier(
  context,
  owner,
  repository,
  identifier,
  version,
) {
  try {
    // Get the citation file
    const citationObj = await getCitationContent(context, owner, repository);
    const codeMetaObj = await getCodemetaContent(context, owner, repository);

    let codeMetaFile = JSON.parse(codeMetaObj.content);
    const codeMetaSha = codeMetaObj.sha || null;

    let citationFile = yaml.load(citationObj.content);
    const citationSha = citationObj.sha || null;
    const updated_date = new Date().toISOString().split("T")[0];

    const zenodoMetadata = await dbInstance.zenodoDeposition.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (!zenodoMetadata) {
      throw new Error(
        "Zenodo metadata not found in the database. Please create a new Zenodo deposition.",
      );
    }

    citationFile.doi = identifier;
    citationFile["date-released"] = updated_date;
    citationFile.version = zenodoMetadata?.zenodo_metadata?.version || version;
    codeMetaFile.identifier = identifier;
    codeMetaFile.version = zenodoMetadata?.zenodo_metadata?.version || version;
    codeMetaFile.dateModified = updated_date;

    const response = await dbInstance.licenseRequest.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (!response) {
      throw new Error("Error fetching license details from database", response);
    }

    codeMetaFile.license = `https://spdx.org/licenses/${response.license_id}`;
    citationFile.license = response.license_id;

    // Update the citation file
    await context.octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repository.name,
      path: "CITATION.cff",
      message: "chore: 📝 Update CITATION.cff with Zenodo identifier",
      content: Buffer.from(
        yaml.dump(citationFile, { noRefs: true, indent: 2 }),
      ).toString("base64"),
      sha: citationSha,
    });

    consola.success("CITATION.cff file updated with Zenodo identifier");

    // Update the codemeta file
    await context.octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repository.name,
      path: "codemeta.json",
      message: "chore: 📝 Update codemeta.json with Zenodo identifier",
      content: Buffer.from(JSON.stringify(codeMetaFile, null, 2)).toString(
        "base64",
      ),
      sha: codeMetaSha,
    });

    consola.success("codemeta.json file updated with Zenodo identifier");

    // Get the codemetadata content from the database
    const existingCodemeta = await dbInstance.codeMetadata.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (!existingCodemeta) {
      throw new Error("Error fetching codemeta.json from the database");
    }

    // Update the codemetadata content with the new Zenodo identifier
    existingCodemeta.metadata.uniqueIdentifier = identifier;
    existingCodemeta.metadata.currentVersion =
      zenodoMetadata?.zenodo_metadata?.version || version;

    // Update the database with the latest metadata
    await dbInstance.codeMetadata.update({
      where: {
        repository_id: repository.id,
      },
      data: {
        metadata: existingCodemeta.metadata,
      },
    });

    return codeMetaFile;
  } catch (error) {
    throw new Error(`Error on updating the GitHub metadata files: ${error}`, {
      cause: error,
    });
  }
}

export function applyDbMetadata(existingMetadataEntry, metadata) {
  const existingMetadata = existingMetadataEntry.metadata;

  metadata.name = existingMetadata.name || metadata.name || "";
  metadata.authors = existingMetadata.authors || metadata.authors || [];
  metadata.contributors =
    existingMetadata.contributors || metadata.contributors || [];
  metadata.applicationCategory =
    existingMetadata.applicationCategory ||
    metadata.applicationCategory ||
    null;
  metadata.codeRepository =
    existingMetadata.codeRepository || metadata.codeRepository || "";
  metadata.continuousIntegration =
    existingMetadata.continuousIntegration ||
    metadata.continuousIntegration ||
    "";
  metadata.creationDate =
    existingMetadata.creationDate || metadata.creationDate || null;
  metadata.currentVersion =
    existingMetadata.currentVersion || metadata.currentVersion || "";
  metadata.currentVersionDownloadURL =
    existingMetadata.currentVersionDownloadURL ||
    metadata.currentVersionDownloadURL ||
    "";
  metadata.currentVersionReleaseDate =
    existingMetadata.currentVersionReleaseDate ||
    metadata.currentVersionReleaseDate ||
    null;
  metadata.currentVersionReleaseNotes =
    existingMetadata.currentVersionReleaseNotes ||
    metadata.currentVersionReleaseNotes ||
    "";
  metadata.description =
    existingMetadata.description || metadata.description || "";
  metadata.developmentStatus =
    existingMetadata.developmentStatus || metadata.developmentStatus || null;
  metadata.firstReleaseDate =
    existingMetadata.firstReleaseDate || metadata.firstReleaseDate || null;
  metadata.fundingCode =
    existingMetadata.fundingCode || metadata.fundingCode || "";
  metadata.fundingOrganization =
    existingMetadata.fundingOrganization || metadata.fundingOrganization || "";
  metadata.isPartOf = existingMetadata.isPartOf || metadata.isPartOf || "";
  metadata.isSourceCodeOf =
    existingMetadata.isSourceCodeOf || metadata.isSourceCodeOf || "";
  metadata.issueTracker =
    existingMetadata.issueTracker || metadata.issueTracker || "";
  metadata.keywords = existingMetadata.keywords || metadata.keywords || [];
  metadata.license = existingMetadata.license || metadata.license || null;
  metadata.operatingSystem =
    existingMetadata.operatingSystem || metadata.operatingSystem || [];
  metadata.otherSoftwareRequirements =
    existingMetadata.otherSoftwareRequirements ||
    metadata.otherSoftwareRequirements ||
    [];
  metadata.programmingLanguages =
    existingMetadata.programmingLanguages ||
    metadata.programmingLanguages ||
    [];
  metadata.referencePublication =
    existingMetadata.referencePublication ||
    metadata.referencePublication ||
    "";
  metadata.relatedLinks =
    existingMetadata.relatedLinks || metadata.relatedLinks || [];
  metadata.reviewAspect =
    existingMetadata.reviewAspect || metadata.reviewAspect || "";
  metadata.reviewBody =
    existingMetadata.reviewBody || metadata.reviewBody || "";
  metadata.runtimePlatform =
    existingMetadata.runtimePlatform || metadata.runtimePlatform || [];
  metadata.uniqueIdentifier =
    existingMetadata.uniqueIdentifier || metadata.uniqueIdentifier || "";

  return metadata;
}

export async function applyCodemetaMetadata(codemeta, metadata, repository) {
  consola.info("Codemeta found");
  try {
    // consola.warn("codemeta", codemeta.content.trim());
    let codemetaContent;
    try {
      codemetaContent = JSON.parse(codemeta.content.trim());
    } catch (error) {
      consola.error("Error parsing codemeta content", error);
      return;
    }
    const convertedCodemeta = await convertCodemetaForDB(
      codemetaContent,
      repository,
    );

    metadata.name = convertedCodemeta.name || metadata.name || "";
    metadata.applicationCategory =
      convertedCodemeta.applicationCategory ||
      metadata.applicationCategory ||
      null;
    metadata.codeRepository =
      convertedCodemeta.codeRepository || metadata.codeRepository || "";
    metadata.continuousIntegration =
      convertedCodemeta.continuousIntegration ||
      metadata.continuousIntegration ||
      "";
    metadata.creationDate =
      convertedCodemeta.creationDate || metadata.creationDate || null;
    metadata.currentVersion =
      convertedCodemeta.version || metadata.currentVersion || "";
    metadata.currentVersionDownloadURL =
      convertedCodemeta.currentVersionDownloadURL ||
      metadata.currentVersionDownloadURL ||
      "";
    metadata.currentVersionReleaseDate =
      convertedCodemeta.currentVersionReleaseDate ||
      metadata.currentVersionReleaseDate ||
      null;
    metadata.currentVersionReleaseNotes =
      convertedCodemeta.currentVersionReleaseNotes ||
      metadata.currentVersionReleaseNotes ||
      "";
    metadata.description =
      convertedCodemeta.description || metadata.description || "";
    metadata.developmentStatus =
      convertedCodemeta.developmentStatus || metadata.developmentStatus || null;
    metadata.firstReleaseDate =
      convertedCodemeta.firstReleaseDate || metadata.firstReleaseDate || null;
    metadata.fundingCode =
      convertedCodemeta.fundingCode || metadata.fundingCode || "";
    metadata.fundingOrganization =
      convertedCodemeta.fundingOrganization ||
      metadata.fundingOrganization ||
      "";
    metadata.isPartOf = convertedCodemeta.isPartOf || metadata.isPartOf || "";
    metadata.reviewAspect =
      convertedCodemeta.reviewAspect || metadata.reviewAspect || "";
    metadata.reviewBody =
      convertedCodemeta.reviewBody || metadata.reviewBody || "";
    metadata.runtimePlatform =
      convertedCodemeta.runtimePlatform || metadata.runtimePlatform || [];
    metadata.uniqueIdentifier =
      convertedCodemeta.uniqueIdentifier || metadata.uniqueIdentifier || "";
    metadata.isSourceCodeOf =
      convertedCodemeta.isSourceCodeOf || metadata.isSourceCodeOf || "";
    metadata.programmingLanguages =
      convertedCodemeta.programmingLanguages ||
      metadata.programmingLanguages ||
      [];
    metadata.operatingSystem =
      convertedCodemeta.operatingSystem || metadata.operatingSystem || [];
    metadata.relatedLinks =
      convertedCodemeta.relatedLinks || metadata.relatedLinks || [];
    metadata.otherSoftwareRequirements =
      convertedCodemeta.otherSoftwareRequirements ||
      metadata.otherSoftwareRequirements ||
      [];

    if (metadata.authors) {
      if (convertedCodemeta.authors.length > 0) {
        const updatedAuthors = convertedCodemeta.authors.map((author) => {
          // Find a matching author in metadata
          const foundAuthor = metadata.authors.find(
            (existingAuthor) =>
              existingAuthor?.familyName === author?.familyName &&
              existingAuthor?.givenName === author?.givenName,
          );

          if (foundAuthor) {
            // Merge roles, avoiding duplicates based on `role` and `startDate`
            if (!foundAuthor?.roles) {
              foundAuthor.roles = [];
            }
            const mergedRoles = [
              ...foundAuthor.roles,
              ...author.roles.filter(
                (newRole) =>
                  !foundAuthor.roles.some(
                    (existingRole) =>
                      existingRole.role === newRole.role &&
                      existingRole.startDate === newRole.startDate,
                  ),
              ),
            ];

            // Merge and prioritize data from `author`
            return {
              ...foundAuthor,
              ...author,
              affiliation: author.affiliation || foundAuthor.affiliation || "",
              email: author.email || foundAuthor.email || "",
              uri: author.uri || foundAuthor.uri || "",
              roles: mergedRoles,
            };
          }

          // If no match, return the current author from convertedCodemeta
          return author;
        });

        // Merge updated authors with any authors in metadata not present in convertedCodemeta
        const nonUpdatedAuthors = metadata.authors.filter(
          (existingAuthor) =>
            !convertedCodemeta.authors.some(
              (author) =>
                author.familyName === existingAuthor.familyName &&
                author.givenName === existingAuthor.givenName,
            ),
        );

        metadata.authors = [...nonUpdatedAuthors, ...updatedAuthors];
      }
    }

    if (metadata.contributors) {
      if (convertedCodemeta.contributors.length > 0) {
        const updatedContributors = convertedCodemeta.contributors.map(
          (contributor) => {
            // Find a matching contributor in metadata
            const foundContributor = metadata.contributors.find(
              (existingContributor) =>
                existingContributor?.familyName === contributor?.familyName &&
                existingContributor?.givenName === contributor?.givenName,
            );

            if (foundContributor) {
              if (!foundContributor?.roles) {
                foundContributor.roles = [];
              }
              // Merge roles, avoiding duplicates based on `role` and `startDate`
              const mergedRoles = [
                ...foundContributor.roles,
                ...contributor.roles.filter(
                  (newRole) =>
                    !foundContributor.roles.some(
                      (existingRole) =>
                        existingRole.role === newRole.role &&
                        existingRole.startDate === newRole.startDate,
                    ),
                ),
              ];

              // Merge and prioritize data from `contributor`
              return {
                ...foundContributor,
                ...contributor,
                affiliation:
                  contributor.affiliation || foundContributor.affiliation || "",
                email: contributor.email || foundContributor.email || "",
                uri: contributor.uri || foundContributor.uri || "",
                roles: mergedRoles,
              };
            }

            // If no match, return the current contributor from convertedCodemeta
            return contributor;
          },
        );

        // Merge updated contributors with any contributors in metadata not present in convertedCodemeta
        const nonUpdatedContributors = metadata.contributors.filter(
          (existingContributor) =>
            !convertedCodemeta.contributors.some(
              (contributor) =>
                contributor.familyName === existingContributor.familyName &&
                contributor.givenName === existingContributor.givenName,
            ),
        );

        metadata.contributors = [
          ...nonUpdatedContributors,
          ...updatedContributors,
        ];
      }
    } else if (convertedCodemeta.contributors.length > 0) {
      // If metadata.contributors is empty, directly assign convertedCodemeta.contributors
      metadata.contributors = [...convertedCodemeta.contributors];
    }

    return metadata;
  } catch (error) {
    consola.error("Error applying codemeta metadata", JSON.stringify(error));
    throw new Error("Error applying codemeta metadata", { cause: error });
  }
}

export async function applyCitationMetadata(citation, metadata, repository) {
  consola.info("Citation found");
  const citationContent = yaml.load(citation.content);
  const convertedCitation = await convertCitationForDB(
    citationContent,
    repository,
  );

  metadata.license = convertedCitation.license || metadata.license || null;
  metadata.codeRepository =
    convertedCitation.codeRepository || metadata.codeRepository || "";
  metadata.currentVersion =
    convertedCitation.currentVersion || metadata.currentVersion || "";
  metadata.currentVersionReleaseDate =
    convertedCitation.currentVersionReleaseDate ||
    metadata.currentVersionReleaseDate ||
    null;
  metadata.keywords = convertedCitation.keywords || metadata.keywords || [];
  metadata.uniqueIdentifier =
    convertedCitation.uniqueIdentifier || metadata.uniqueIdentifier || "";
  metadata.description =
    convertedCitation.description || metadata.description || "";

  if (convertedCitation.authors) {
    // Check if the authors are already in the metadata, if so update the details of the author
    if (metadata.authors.length > 0) {
      const updatedAuthors = convertedCitation.authors.map((author) => {
        // Find an existing author in metadata.authors with the same familyName and givenName
        const foundAuthor = metadata.authors.find(
          (existingAuthor) =>
            existingAuthor.familyName === author.familyName &&
            existingAuthor.givenName === author.givenName,
        );

        if (foundAuthor) {
          // Update author details, preserving information from convertedCitation
          return {
            ...foundAuthor, // Existing details from metadata.authors
            ...author, // Overwrite with any additional information from convertedCitation
            affiliation: author.affiliation || foundAuthor.affiliation || "",
            email: author.email || foundAuthor.email || "",
          };
        }

        // If no matching author is found, return the current author from convertedCitation
        return author;
      });

      // Update metadata.authors with the consolidated list
      metadata.authors = updatedAuthors;
    } else {
      // If metadata.authors is empty, simply assign convertedCitation.authors
      metadata.authors = [...convertedCitation.authors];
    }
  }

  return metadata;
}

// TODO: Prevent the user from creating/updating metadata if custom license file exists and has no license title
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
  try {
    const githubAction = context.payload?.pusher?.name;
    const identifier = createId();

    // TODO: Move the workflow around to get the metadata from github api last
    const url = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/code-metadata`;
    let revalidate = true;
    let revalidateCitation = true;
    let revalidateCodemeta = true;
    let containsCitation = subjects.citation,
      containsCodemeta = subjects.codemeta,
      validCitation = false,
      validCodemeta = false;
    const existingMetadata = await dbInstance.codeMetadata.findUnique({
      where: {
        repository_id: repository.id,
      },
    });
    const dataObject = {
      contains_citation: containsCitation,
      contains_codemeta: containsCodemeta,
      contains_metadata: containsCitation && containsCodemeta,
    };

    if (githubAction && githubAction !== `${GH_APP_NAME}[bot]`) {
      // Push event was made, only update the metadata if the pusher updated the codemeta.json or citation.cff
      consola.info("Push event detected");
      const updatedFiles = context.payload.head_commit.modified;
      const addedFiles = context.payload.head_commit.added;
      revalidate = false;
      revalidateCitation = false;
      revalidateCodemeta = false;

      if (addedFiles.includes("LICENSE") || updatedFiles.includes("LICENSE")) {
        // License file was added or updated
        revalidateCodemeta = true;
        revalidateCitation = true;
        revalidate = true;
      }

      if (
        updatedFiles.includes("codemeta.json") ||
        addedFiles.includes("codemeta.json")
      ) {
        revalidateCodemeta = true;
        revalidate = true;
      }

      if (
        updatedFiles.includes("CITATION.cff") ||
        addedFiles.includes("CITATION.cff")
      ) {
        revalidateCitation = true;
        revalidate = true;
      }
    }

    if (revalidate) {
      // Revalidation steps
      let metadata = await gatherMetadata(context, owner, repository);

      if (existingMetadata?.metadata) {
        containsCitation = existingMetadata.contains_citation;
        containsCodemeta = existingMetadata.contains_metadata;
        metadata = applyDbMetadata(existingMetadata, metadata);
      }

      if (subjects.codemeta && revalidateCodemeta) {
        const codemeta = await getCodemetaContent(context, owner, repository);
        containsCodemeta = true;
        validCodemeta = await validateMetadata(
          codemeta,
          "codemeta",
          repository,
        );
        metadata = await applyCodemetaMetadata(codemeta, metadata, repository);
      }

      if (subjects.citation && revalidateCitation) {
        const citation = await getCitationContent(context, owner, repository);
        containsCitation = true;
        validCitation = await validateMetadata(
          citation,
          "citation",
          repository,
        );
        metadata = await applyCitationMetadata(citation, metadata, repository);
      }

      // Add metadata to database object
      dataObject.metadata = metadata;
      dataObject.citation_status = validCitation ? "valid" : "invalid";
      dataObject.codemeta_status = validCodemeta ? "valid" : "invalid";
    }

    if ((!subjects.codemeta || !subjects.citation) && subjects.license) {
      // License was found but no codemeta.json or CITATION.cff exists
      const metadataBadge = `[![Metadata](https://img.shields.io/badge/Add_Metadata-dc2626.svg)](${url})`;
      baseTemplate += `\n\n## Metadata ❌\n\nTo make your software FAIR, a CITATION.cff and codemeta.json are expected at the root level of your repository. These files are not found in the repository. If you would like Codefair to add these files, click the "Add metadata" button below to go to our interface for providing metadata and generating these files.\n\n${metadataBadge}`;
    }

    if (subjects.codemeta && subjects.citation && subjects.license) {
      const metadataBadge = `[![Metadata](https://img.shields.io/badge/Edit_Metadata-0ea5e9.svg)](${url}?)`;
      baseTemplate += `\n\n## Metadata ✔️\n\nA CITATION.cff and a codemeta.json file are found in the repository. They may need to be updated over time as new people are contributing to the software, etc.\n\n${metadataBadge}`;
    }

    if (!existingMetadata) {
      // Entry does not exist in db, create a new one
      dataObject.identifier = identifier;
      dataObject.repository = {
        connect: {
          id: repository.id,
        },
      };

      await dbInstance.codeMetadata.create({
        data: dataObject,
      });
    } else {
      // Get the identifier of the existing metadata request
      await dbInstance.codeMetadata.update({
        data: dataObject,
        where: { repository_id: repository.id },
      });
    }

    if (!subjects.license) {
      // License was not found
      const metadataBadge = `![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`;
      baseTemplate += `\n\n## Metadata\n\nTo make your software FAIR a CITATION.cff and codemeta.json metadata files are expected at the root level of your repository. Codefair will check for these files after a license file is detected.\n\n${metadataBadge}`;
    }

    return baseTemplate;
  } catch (error) {
    if (error.cause) {
      consola.error("Error applying metadata template", error.cause);
      // throw new Error("Error applying metadata template", { cause: error.cause });
    }
    throw new Error("Error applying metadata template", { cause: error });
  }
}

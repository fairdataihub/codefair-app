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
export async function convertCodemetaForDB(codemetaContent, repository) {
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
              startDate: author.startDate ? convertDateToUnix(author.startDate) : null,
              endDate: author.endDate ? convertDateToUnix(author.endDate) : null,
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
      if (contributor.type === "Person" || contributor.type === "Organization") {
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
          if (sortedContributor.uri === contributor?.contributor || sortedContributor.uri === contributor["schema:contributor"]) {
            // Create the role object
            const roleObj = {
              role: contributor.roleName || "",
              startDate: contributor.startDate ? convertDateToUnix(contributor.startDate) : null,
              endDate: contributor.endDate ? convertDateToUnix(contributor.endDate) : null,
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
      licenseId = `https://spdx.org/licenses/${license.license_id}`
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
}

/**
 * * Converts the CITATION.cff file content to a metadata object for the database
 * @param {YAML} citationContent - The CITATION.cff file content loaded as a YAML object
 * @param {Object} repository - The repository information 
 * @returns {Object} - The metadata object for the database
 */
export async function convertCitationForDB(citationContent, repository) {
  const authors = [];

  if (citationContent?.authors) {
    citationContent.authors.forEach((author) => {
      authors.push({
        affiliation: author.affiliation || "",
        email: author.email || "",
        familyName: author["family-names"] || "",
        givenName: author["given-names"] || "",
      })
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
    }

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
  }
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
      const normalizedContent = cleanContent.replace(/^\uFEFF/, ''); // Remove BOM if present
      const loaded_file = JSON.parse(normalizedContent);
      // Verify the required fields are present
      if (!loaded_file.name || !loaded_file.author || !loaded_file.description) {
        return false;
      }

      consola.start("Sending content to metadata validator");
      try {
        const response = await fetch("http://127.0.0.1:5000/validate-codemeta", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_content: loaded_file,
          })
        });

        if (!response.ok) {
          throw new Error("Error validating the codemeta.json file", response);
        }
        const data = await response.json();
        consola.info("Codemeta validation response", data);

        await dbInstance.codeMetadata.update({
          where: {
            repository_id: repository.id,
          },
          data: {
            codemeta_validation_message: data.message === "valid" ? data.output : data.error,
          }
        });

        return data.message === "valid";

      } catch (error) {
        consola.error("Error validating the codemeta.json file", error);
        return false;
      }
    } catch (error) {
      return false;
    }
  }
  
  if (fileType === "citation") {
    try {
      const loaded_file = yaml.load(metadataInfo.content);
      // Verify the required fields are present
      if (!loaded_file.title || !loaded_file.authors) {
        return false;
      }

      try {
        const response = await fetch("http://127.0.0.1:5000/validate-citation", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file_path: metadataInfo.file_path,
          })
        });

        if (!response.ok) {
          throw new Error("Error validating the CITATION.cff file", response);
        }

        const data = await response.json();
        consola.info("Citation validation response", data);
        // TODO: Store the validation response in the database
        await dbInstance.codeMetadata.update({
          where: {
            repository_id: repository.id,
          },
          data: {
            citation_validation_message: data.message === "valid" ? data.output : data.error,
          }
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
export async function updateMetadataIdentifier(context, owner, repository, identifier, version) {
  try {
  // Get the citation file
  const citationObj = await getCitationContent(context, owner, repository);
  const codeMetaObj = await getCodemetaContent(context, owner, repository);

  let codeMetaFile = JSON.parse(codeMetaObj.content);
  const codeMetaSha = codeMetaObj.sha || null;

  let citationFile = yaml.load(citationObj.content);
  const citationSha = citationObj.sha || null;
  const updated_date = new Date().toISOString().split('T')[0];

  const zenodoMetadata = await dbInstance.zenodoDeposition.findUnique({
    where: {
      repository_id: repository.id,
    }
  })

  if (!zenodoMetadata) {
    throw new Error("Zenodo metadata not found in the database. Please create a new Zenodo deposition.");
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
    content: Buffer.from(yaml.dump(citationFile, { noRefs: true, indent: 2 })).toString("base64"),
    sha: citationSha,
  });

  consola.success("CITATION.cff file updated with Zenodo identifier");

  // Update the codemeta file
  await context.octokit.repos.createOrUpdateFileContents({
    owner,
    repo: repository.name,
    path: "codemeta.json",
    message: "chore: 📝 Update codemeta.json with Zenodo identifier",
    content: Buffer.from(JSON.stringify(codeMetaFile, null, 2)).toString("base64"),
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
  existingCodemeta.metadata.currentVersion = zenodoMetadata?.zenodo_metadata?.version || version

  // Update the database with the latest metadata
  await dbInstance.codeMetadata.update({
    where: {
      repository_id: repository.id,
    },
    data: {
      metadata: existingCodemeta.metadata,
    }
  })

  return codeMetaFile;
  } catch (error) {
    throw new Error(`Error on updating the GitHub metadata files: ${error}`, { cause: error })
  }

}

export function applyDbMetadata(existingMetadataEntry, metadata) {
  const existingMetadata = existingMetadataEntry.metadata;

  metadata.name = existingMetadata.name || metadata.name || "";
  metadata.applicationCategory = existingMetadata.applicationCategory || metadata.applicationCategory || null;
  metadata.codeRepository = existingMetadata.codeRepository || metadata.codeRepository || "";
  metadata.continuousIntegration = existingMetadata.continuousIntegration || metadata.continuousIntegration || "";
  metadata.creationDate = existingMetadata.creationDate || metadata.creationDate || null;
  metadata.currentVersion = existingMetadata.currentVersion || metadata.currentVersion || "";
  metadata.currentVersionDownloadURL = existingMetadata.currentVersionDownloadURL || metadata.currentVersionDownloadURL || "";
  metadata.currentVersionReleaseDate = existingMetadata.currentVersionReleaseDate || metadata.currentVersionReleaseDate || null;
  metadata.currentVersionReleaseNotes = existingMetadata.currentVersionReleaseNotes || metadata.currentVersionReleaseNotes || "";
  metadata.description = existingMetadata.description || metadata.description || "";
  metadata.developmentStatus = existingMetadata.developmentStatus || metadata.developmentStatus || null;
  metadata.firstReleaseDate = existingMetadata.firstReleaseDate || metadata.firstReleaseDate || null;
  metadata.fundingCode = existingMetadata.fundingCode || metadata.fundingCode || "";
  metadata.fundingOrganization = existingMetadata.fundingOrganization || metadata.fundingOrganization || "";
  metadata.isPartOf = existingMetadata.isPartOf || metadata.isPartOf || "";
  metadata.isSourceCodeOf = existingMetadata.isSourceCodeOf || metadata.isSourceCodeOf || "";
  metadata.issueTracker = existingMetadata.issueTracker || metadata.issueTracker || "";
  metadata.keywords = existingMetadata.keywords || metadata.keywords || [];
  metadata.license = existingMetadata.license || metadata.license || null;
  metadata.operatingSystem = existingMetadata.operatingSystem || metadata.operatingSystem || [];
  metadata.otherSoftwareRequirements = existingMetadata.otherSoftwareRequirements || metadata.otherSoftwareRequirements || [];
  metadata.programmingLanguages = existingMetadata.programmingLanguages || metadata.programmingLanguages || [];
  metadata.referencePublication = existingMetadata.referencePublication || metadata.referencePublication || "";
  metadata.relatedLinks = existingMetadata.relatedLinks || metadata.relatedLinks || [];
  metadata.reviewAspect = existingMetadata.reviewAspect || metadata.reviewAspect || "";
  metadata.reviewBody = existingMetadata.reviewBody || metadata.reviewBody || "";
  metadata.runtimePlatform = existingMetadata.runtimePlatform || metadata.runtimePlatform || [];
  metadata.uniqueIdentifier = existingMetadata.uniqueIdentifier || metadata.uniqueIdentifier || "";

  return metadata;
}

export async function applyCodemetaMetadata(codemeta, metadata, repository) {
  consola.info("Codemeta found");
  const codemetaContent = JSON.parse(codemeta.content);
  const convertedCodemeta = await convertCodemetaForDB(codemetaContent, repository);

  metadata.name = convertedCodemeta.name || metadata.name || "";
  metadata.applicationCategory = convertedCodemeta.applicationCategory || metadata.applicationCategory || null;
  metadata.codeRepository = convertedCodemeta.codeRepository || metadata.codeRepository || "";
  metadata.continuousIntegration = convertedCodemeta.continuousIntegration || metadata.continuousIntegration || "";
  metadata.creationDate = convertedCodemeta.creationDate || metadata.creationDate || null;
  metadata.currentVersion = convertedCodemeta.currentVersion || metadata.currentVersion || "";
  metadata.currentVersionDownloadURL = convertedCodemeta.currentVersionDownloadURL || metadata.currentVersionDownloadURL || "";
  metadata.currentVersionReleaseDate = convertedCodemeta.currentVersionReleaseDate || metadata.currentVersionReleaseDate || null;
  metadata.currentVersionReleaseNotes = convertedCodemeta.currentVersionReleaseNotes || metadata.currentVersionReleaseNotes || "";
  metadata.description = convertedCodemeta.description || metadata.description || "";
  metadata.developmentStatus = convertedCodemeta.developmentStatus || metadata.developmentStatus || null;
  metadata.firstReleaseDate = convertedCodemeta.firstReleaseDate || metadata.firstReleaseDate || null;
  metadata.fundingCode = convertedCodemeta.fundingCode || metadata.fundingCode || "";
  metadata.fundingOrganization = convertedCodemeta.fundingOrganization || metadata.fundingOrganization || "";
  metadata.isPartOf = convertedCodemeta.isPartOf || metadata.isPartOf || "";
  metadata.reviewAspect = convertedCodemeta.reviewAspect || metadata.reviewAspect || "";
  metadata.reviewBody = convertedCodemeta.reviewBody || metadata.reviewBody || "";
  metadata.runtimePlatform = convertedCodemeta.runtimePlatform || metadata.runtimePlatform || [];
  metadata.uniqueIdentifier = convertedCodemeta.uniqueIdentifier || metadata.uniqueIdentifier || "";

  if (metadata.authors) {
    // consola.info("metadata.authors", metadata.authors);
    // consola.info("convertedCodemeta.authors", convertedCodemeta.authors);
    // Check if authors are already in the metadata, if so update the details of the author
    if (convertedCodemeta.authors.length > 0) {
      const updatedAuthors = convertedCodemeta.authors.map((author) => {
        const foundAuthor = metadata.authors.find((newAuthor) => newAuthor?.familyName === author?.familyName && newAuthor.givenName === author.givenName);
        if (foundAuthor) {
          // consola.info("Found author:", foundAuthor);
          author.affiliation = foundAuthor.affiliation || author.affiliation || "";
          author.email = foundAuthor.email || author.email || "";
          author.roles = foundAuthor.roles || author.roles || [];
          author.uri = foundAuthor.uri || author.uri || "";
        }
        return author;
      });

      // join the updated authors with the remaining authors
      metadata.authors = updatedAuthors;
    }
  }

  if (metadata.contributors) {
    // Check if contributors are already in the metadata, if so update the details of the contributor
    if (convertedCodemeta.contributors.length > 0) {
      const updatedContributors = convertedCodemeta.contributors.map((contributor) => {
        const foundContributor = metadata.contributors.find((newContributor) => newContributor.familyName === contributor.familyName && newContributor.givenName === contributor.givenName);
        if (foundContributor) {
          contributor.affiliation = foundContributor.affiliation || contributor.affiliation || "";
          contributor.email = foundContributor.email || contributor.email || "";
          contributor.roles = foundContributor.roles || contributor.roles || [];
          contributor.uri = foundContributor.uri || contributor.uri || "";
        }
        return contributor;
      });

      metadata.contributors = updatedContributors;
    }
  }

  return metadata;
}

export async function applyCitationMetadata(citation, metadata, repository) {
  consola.info("Citation found");
  const citationContent = yaml.load(citation.content);
  const convertedCitation = await convertCitationForDB(citationContent, repository);

  metadata.license = convertedCitation.license || metadata.license || null;
  metadata.codeRepository = convertedCitation.codeRepository || metadata.codeRepository || "";
  metadata.currentVersion = convertedCitation.currentVersion || metadata.currentVersion || "";
  metadata.currentVersionReleaseDate = convertedCitation.currentVersionReleaseDate || metadata.currentVersionReleaseDate || null;
  metadata.keywords = convertedCitation.keywords || metadata.keywords || [];
  metadata.uniqueIdentifier = convertedCitation.uniqueIdentifier || metadata.uniqueIdentifier || "";

  consola.info("metadata.authors", metadata.authors);
  consola.info("convertedCitation.authors", convertedCitation.authors);
  if (convertedCitation.authors) {
    // Check if the authors are already in the metadata, if so update the details of the author
    if (metadata.authors.length > 0) {
      const updatedAuthors = metadata.authors.map((author) => {
        const foundAuthor = convertedCitation.authors.find((newAuthor) => newAuthor.familyName === author.familyName && newAuthor.givenName === author.givenName);
        if (foundAuthor) {
          author.affiliation = author.affiliation || foundAuthor.affiliation || "";
          author.email = author.email || foundAuthor.email || "";
          
          // Remove author from convertedCitation.authors
          const index = convertedCitation.authors.indexOf(foundAuthor);
          if (index > -1) {
            convertedCitation.authors.splice(index, 1);
          }
        }

        return author;
      });

      // Apply the missings fields to the remaining convertedCitation.authors
      convertedCitation.authors = convertedCitation.authors.map((author) => {
        author.affiliation = author.affiliation || "";
        author.email = author.email || "";
        author.roles = author.roles || [];
        author.uri = author.uri || "";
        return author;
      });

      metadata.authors = updatedAuthors.concat(convertedCitation.authors);
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
  const identifier = createId();
  let url = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/code-metadata`;
  let containsCitation = false,
      containsCodemeta = false,
      validCitation = false,
      validCodemeta = false;
  const existingMetadata = await dbInstance.codeMetadata.findUnique({
    where: {
      repository_id: repository.id,
    },
  });

  let metadata = gatherMetadata(context, owner, repository);
  if (existingMetadata?.metadata) {
    containsCitation = existingMetadata.contains_citation;
    containsCodemeta = existingMetadata.contains_metadata;
    metadata = applyDbMetadata(existingMetadata, metadata);
  }

  if (subjects.codemeta) {
    const codemeta = await getCodemetaContent(context, owner, repository);
    containsCodemeta = true;
    validCodemeta = await validateMetadata(codemeta, "codemeta", repository);
    metadata = await applyCodemetaMetadata(codemeta, metadata, repository);
    consola.info(metadata);
  }

  if (subjects.citation) {
    const citation = await getCitationContent(context, owner, repository);
    containsCitation = true;
    validCitation = await validateMetadata(citation, "citation", repository);
    metadata = await applyCitationMetadata(citation, metadata, repository);
    consola.info(metadata);
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
    await dbInstance.codeMetadata.create({
      data: {
        citation_status: validCitation ? "valid" : "invalid",
        codemeta_status: validCodemeta ? "valid" : "invalid",
        contains_citation: containsCitation,
        identifier,
        contains_codemeta: containsCodemeta,
        contains_metadata: containsCodemeta && containsCitation,
        metadata,
        repository: {
          connect: {
            id: repository.id,
          },
        },
      },
    });
  } else {
    // Get the identifier of the existing metadata request
    await dbInstance.codeMetadata.update({
      data: {
        citation_status: validCitation ? "valid" : "invalid",
        codemeta_status: validCodemeta ? "valid" : "invalid",
        contains_citation: containsCitation,
        contains_codemeta: containsCodemeta,
        contains_metadata: containsCodemeta && containsCitation,
        metadata,
      },
      where: { repository_id: repository.id },
    });
  }

  if (!subjects.license) {
    // License was not found
    const metadataBadge = `![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`;
    baseTemplate += `\n\n## Metadata\n\nTo make your software FAIR a CITATION.cff and codemeta.json metadata files are expected at the root level of your repository. Codefair will check for these files after a license file is detected.\n\n${metadataBadge}`;
  }

  return baseTemplate;
}

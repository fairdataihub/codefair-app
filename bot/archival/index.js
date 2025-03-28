import { error } from "console";
import dbInstance from "../db.js";
import { logwatch } from "../utils/logwatch.js";
import fs from "fs";
const licensesJson = JSON.parse(
  fs.readFileSync("./public/assets/data/licenses.json", "utf8")
);

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const { ZENODO_ENDPOINT, ZENODO_API_ENDPOINT } = process.env;

/**
 * * Update the GitHub release to not be a draft
 * @param {String} repositoryName - GitHub repository name
 * @param {String} owner - GitHub owner
 * @param {String} releaseId - GitHub release ID
 */
export async function updateGitHubRelease(
  context,
  repositoryName,
  owner,
  releaseId
) {
  try {
    await context.octokit.repos.updateRelease({
      owner,
      repo: repositoryName,
      release_id: releaseId,
      draft: false,
    });
    logwatch.success("Updated release to not be a draft!");
  } catch (error) {
    throw new Error(`Error updating the GitHub release: ${error}`, {
      cause: error,
    });
  }
}

/**
 * * Publishes a Zenodo deposition
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Access token for Zenodo API
 */
export async function publishZenodoDeposition(zenodoToken, depositionId) {
  try {
    logwatch.start(`Publishing the Zenodo deposition: ${depositionId}`);
    const url = `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}/actions/publish`;
    logwatch.info(`Sending POST request to: ${url}`);

    const publishDeposition = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${zenodoToken}`,
      },
    });

    logwatch.info(
      `Received response with status: ${publishDeposition.status} ${publishDeposition.statusText}`
    );

    if (!publishDeposition.ok) {
      let fetchResponse;
      try {
        fetchResponse = await publishDeposition.json();
      } catch (parseError) {
        logwatch.error("Failed to parse error response as JSON", parseError);
        fetchResponse = { error: "Unable to parse response as JSON" };
      }

      logwatch.error(
        { message: "Error publishing the Zenodo deposition:", fetchResponse },
        true
      );

      throw new Error(
        `Failed to publish the Zenodo deposition. Status: ${publishDeposition.status}: ${publishDeposition.statusText}, Error: ${JSON.stringify(fetchResponse)}`,
        { cause: fetchResponse }
      );
    }

    const publishedDeposition = await publishDeposition.json();
    logwatch.success(
      `Zenodo deposition published successfully at: ${publishedDeposition.links.latest_html}`
    );
  } catch (error) {
    logwatch.error(
      `Exception occurred during Zenodo publication: ${error.message}`,
      error
    );
    throw new Error(
      `Error publishing the Zenodo deposition: ${error.message}`,
      { cause: error }
    );
  }
}

/**
 * * Fetch the Zenodo API token from the db
 * @param {String} user - User who submitted the Zenodo publication request
 * @returns {String} Zenodo API token
 */
export async function getZenodoToken(user) {
  try {
    // Fetch the Zenodo token from the database
    const deposition = await dbInstance.zenodoToken.findFirst({
      where: {
        user: {
          username: user,
        },
      },
      select: {
        token: true,
      },
    });

    if (!deposition || !deposition.token) {
      throw new Error(`Deposition with tag ${tagVersion} not found in db.`, {
        cause: error,
      });
    }

    const zenodoTokenInfo = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions?access_token=${deposition.token}`,
      {
        method: "GET",
      }
    );

    if (!zenodoTokenInfo) {
      throw new Error(`Zenodo token not found`, { cause: error });
    }

    return deposition.token;
  } catch (error) {
    throw new Error(`Error fetching the Zenodo token: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * * Parse the Zenodo information from the GitHub issue body
 * @param {String} issueBody - GitHub issue body
 * @returns {Object} Object of Zenodo deposition information
 */
export function parseZenodoInfo(issueBody) {
  // Gather the information for the Zenodo deposition provided in the issue body
  const match = issueBody.match(
    /<!--\s*@codefair-bot\s*publish-zenodo\s*([\s\S]*?)-->/
  );
  if (!match) {
    throw new Error("Zenodo publish information not found in issue body.");
  }
  const [depositionId, releaseId, tagVersion, userWhoSubmitted] = match[1]
    .trim()
    .split(/\s+/);

  return { depositionId, releaseId, tagVersion, userWhoSubmitted };
}

/**
 * * Apply the archival template to the base template
 * @param {Object} subjects - Subjects of the repository
 * @param {String} baseTemplate - Base template for the issue
 * @param {Object} repository - GitHub repository information
 * @param {String} owner - GitHub owner
 * @param {Object} context - GitHub context
 * @returns {String} String of updated base template with archival information
 */
export async function applyArchivalTemplate(baseTemplate, repository, owner) {
  const archiveTitle = `\n\n## FAIR Software Release`;
  const badgeURL = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/release/zenodo`;
  const existingZenodoDep = await dbInstance.zenodoDeposition.findUnique({
    where: {
      repository_id: repository.id,
    },
  });
  const alreadyReleaseText = ` of your software was successfully released on GitHub and archived on Zenodo. You can view the Zenodo archive by clicking the button below:`;
  const firstReleaseBadgeButton = `[![Create Release](https://img.shields.io/badge/Create_Release-dc2626.svg)](${badgeURL})`;
  const releaseBadgeButton = `[![Create Release](https://img.shields.io/badge/Create_Release-00bcd4.svg)](${badgeURL})`;
  const newReleaseText = `To make your software FAIR, it is necessary to archive it in an archival repository like Zenodo every time you make a release. When you are ready to make your next release, click the "Create release" button below to easily create a FAIR release where your metadata files are updated (including with a DOI) before creating a GitHub release and archiving it.\n\n`;

  if (
    !existingZenodoDep &&
    !existingZenodoDep?.last_published_zenodo_doi != null
  ) {
    // Entry does not exist in db, create a new one
    // await zenDepositionCollection.create({
    //   data: {
    //     repository_id: repository.id,
    //     existing_zenodo_deposition_id: null,
    //     zenodo_id: null,
    //     zenodo_metadata: {},
    //     github_release_id: null,
    //     github_tag_name: null,
    //     user_id: "",
    //   }
    // });
    baseTemplate += `${archiveTitle} ❌\n\n${newReleaseText}\n\n${firstReleaseBadgeButton}`;
  } else {
    // entry does exist, update the existing one
    await dbInstance.zenodoDeposition.update({
      data: {
        existing_zenodo_deposition_id: true,
        zenodo_id: existingZenodoDep.zenodo_id,
      },
      where: {
        repository_id: repository.id,
      },
    });

    // Fetch the DOI content
    const lastVersion = existingZenodoDep.github_tag_name;
    const zenodoId = existingZenodoDep.zenodo_id;
    const zenodoDoi = existingZenodoDep.last_published_zenodo_doi;
    const zenodoDOIBadge = `[![DOI](https://img.shields.io/badge/DOI-${zenodoDoi}-blue)](${ZENODO_ENDPOINT}/records/${zenodoId})`;
    baseTemplate += `${archiveTitle} ✔️\n\n***${lastVersion}***${alreadyReleaseText}\n\n${zenodoDOIBadge}\n\nReady to create your next FAIR release? Click the button below:\n\n${releaseBadgeButton} `;
  }

  return baseTemplate;
}

/**
 * * Create a new Zenodo deposition (no metadata) and return the deposition information
 * @param {String} zenodoToken - Access token for Zenodo API
 * @returns - Object of new Zenodo deposition information
 */
export async function createNewZenodoDeposition(zenodoToken) {
  // Create new Zenodo deposition
  try {
    const zenodoRecord = await fetch(
      `${ZENODO_API_ENDPOINT}/deposit/depositions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${zenodoToken}`,
        },
        body: JSON.stringify({}),
      }
    );

    const zenodoDepositionInfo = await zenodoRecord.json();
    return zenodoDepositionInfo;
  } catch (error) {
    throw new Error(`Error creating a new Zenodo deposition: ${error}`, {
      cause: error,
    });
  }
}

/**
 * * Fetches an existing Zenodo deposition by the deposition ID
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {String} depositionId - Zenodo deposition ID
 * @returns - Object of Zenodo deposition information
 */
export async function fetchExistingZenodoDeposition(zenodoToken, depositionId) {
  try {
    // Will return 404 if the depositionId is a draft and in the "unsubmitted" state
    const zenodoDeposition = await fetch(
      `${ZENODO_API_ENDPOINT}/records/${depositionId}/versions/latest`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${zenodoToken}`,
        },
      }
    );

    if (zenodoDeposition.status === 404) {
      // Check if the deposition is a draft and return that
      const draftDeposition = await fetch(
        `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${zenodoToken}`,
          },
        }
      );

      if (!draftDeposition.ok) {
        const errorText = await draftDeposition.text();
        logwatch.error(
          {
            message: "Error fetching the Zenodo draft deposition:",
            fetchReponse: draftDeposition,
          },
          true
        );
        throw new Error(
          `Failed to fetch the Zenodo draft deposition. Status: ${draftDeposition.status}: ${draftDeposition.statusText}. Error: ${errorText}`
        );
      }

      const draftDepositionInfo = await draftDeposition.json();
      console.log("Draft depo fetched: ", draftDepositionInfo);
      return draftDepositionInfo;
    } else if (!zenodoDeposition.ok) {
      const errorText = await zenodoDeposition.text();
      logwatch.error(
        {
          message: "Error fetching the Zenodo deposition:",
          fetchReponse: zenodoDeposition,
        },
        true
      );
      throw new Error(
        `Failed to fetch the Zenodo deposition. Status: ${zenodoDeposition.status}: ${zenodoDeposition.statusText}. Error: ${errorText}`
      );
    }

    const zenodoDepositionInfo = await zenodoDeposition.json();
    // console.log("Newly created Zneodo depo: ", zenodoDepositionInfo);
    return zenodoDepositionInfo;
  } catch (error) {
    throw new Error(`Error fetching the Zenodo deposition: ${error}`, {
      cause: error,
    });
  }
}

/**
 * * Creates a new version of an existing Zenodo deposition
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {String} depositionId - Zenodo deposition ID
 * @returns - Object of the new Zenodo deposition version
 */
export async function createNewVersionOfDeposition(zenodoToken, depositionId) {
  try {
    const url = `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}/actions/newversion`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${zenodoToken}`,
      },
    });

    // Consume the response body once
    const responseBody = await response.json();

    if (!response.ok) {
      // Log detailed context
      logwatch.error(
        {
          message: "Error creating a new version of Zenodo deposition",
          endpoint: url,
          depositionId,
          status: response.status,
          responseBody,
        },
        true
      );
      // Use JSON.stringify to get a readable error message
      throw new Error(
        `Failed to create a new version of Zenodo deposition. HTTP Status: ${response.status}. Response: ${JSON.stringify(responseBody)}.`,
        { cause: responseBody }
      );
    }

    logwatch.success("New version of Zenodo deposition created successfully!");
    return responseBody;
  } catch (error) {
    logwatch.error(
      {
        message:
          "Unhandled error while creating a new version of Zenodo deposition",
        error: error.message,
        stack: error.stack,
      },
      true
    );
    throw new Error(
      `Error creating a new version of Zenodo deposition: ${error.message}`,
      { cause: error }
    );
  }
}

/**
 * * Returns the latest draft deposition of a new or existing Zenodo deposition. Files are deleted from the latest draft deposition.
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Zenodo API token
 * @returns {Object} Object of Zenodo deposition info
 */
export async function getZenodoDepositionInfo(depositionId, zenodoToken) {
  // For debugging purposes
  // console.log("Zenodo Token: ", zenodoToken);
  if (depositionId === "new") {
    const newZenodoDeposition = await createNewZenodoDeposition(zenodoToken);
    return newZenodoDeposition;
  } else {
    // Fetch existing Zenodo deposition
    logwatch.info(`Fetching existing Zenodo deposition: ${depositionId}`);
    const zenodoDepositionInfo = await fetchExistingZenodoDeposition(
      zenodoToken,
      depositionId
    );

    if (zenodoDepositionInfo.submitted === false) {
      // Delete the files in the draft
      logwatch.start(
        "Requested deposition is a draft. Deleting the files in the draft..."
      );
      for (const file of zenodoDepositionInfo.files) {
        await deleteFileFromZenodo(depositionId, zenodoToken, file.filename);
      }
      return zenodoDepositionInfo;
    }

    // Create a new version of an existing Zenodo deposition
    const newZenodoVersion = await createNewVersionOfDeposition(
      zenodoToken,
      zenodoDepositionInfo.id
    );

    if (newZenodoVersion.files.length > 0) {
      console.log("Files to delete: ", newZenodoVersion.files);
      for (const file of newZenodoVersion.files) {
        logwatch.start(
          `Deleting file from newly created draft: ${file.links.download}`
        );
        await deleteFileFromZenodo(
          newZenodoVersion.record_id,
          zenodoToken,
          file.filename
        );
      }
    }

    logwatch.success(
      "New draft version of Zenodo deposition created successfully!"
    );
    return newZenodoVersion;
  }
}

/**
 * * Creates metadata for Zenodo deposition - based on the codemeta.json file
 * @param {String} codemetadata - Code metadata JSON string (parse with JSON.parse)
 * @returns {Object} Object of Zenodo metadata
 */
export async function createZenodoMetadata(
  codemetadata,
  repository,
  addUploadType
) {
  try {
    const new_date = new Date().toISOString().split("T")[0];
    const codeMetaContent = codemetadata;
    const zenodoCreators = codeMetaContent.author
      .filter((author) => author?.type !== "Role")
      .map((author) => {
        const tempObj = {};

        // Format the name as "Family name, Given names"
        tempObj.name = author.familyName
          ? `${author.familyName}, ${author.givenName}`
          : author.givenName;

        // Add affiliation if present
        if (author.affiliation && author.affiliation.name) {
          tempObj.affiliation = author.affiliation.name;
        }

        // Add ORCID if present
        if (author.orcid) {
          tempObj.orcid = author.orcid;
        }

        return tempObj;
      });

    const existingLicense = await dbInstance.licenseRequest.findUnique({
      where: {
        repository_id: repository.id,
      },
    });
    if (!codeMetaContent.license) {
      // fetch from the db
      logwatch.warn(
        `No license found in the codemeta.json file. Fetching from the database...`
      );
      logwatch.info(
        `License found in the database: ${existingLicense?.license_id}`
      );
      codeMetaContent.license = `https://spdx.org/licenses/${existingLicense?.license_id}`;
    }
    const license = licensesJson.find(
      (license) => license.detailsUrl === `${codeMetaContent.license}.json`
    );
    const licenseId = license ? license.licenseId : null;

    if (!licenseId) {
      throw new Error(`License not found for URL: ${codeMetaContent.license}`, {
        cause: JSON.stringify(licenseId),
      });
    }

    const zenodoMetadata = await dbInstance.zenodoDeposition.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (!zenodoMetadata) {
      logwatch.error(
        "Zenodo metadata not found in the database. Please create a new Zenodo deposition."
      );
      throw new Error(
        "Zenodo metadata not found in the database. Please create a new Zenodo deposition."
      );
    }

    console.log("fetched zenodo metadata: ", zenodoMetadata);

    if (licenseId === "Custom") {
      throw new Error("Custom licenses are not supported yet.");
      // return {
      //   metadata: {
      //     title: codeMetaContent?.name,
      //     description: codeMetaContent?.description,
      //     upload_type: "software",
      //     creators: zenodoCreators,
      //     access_right: zenodoMetadata.zenodo_metadata.accessRight,
      //     publication_date: new_date,
      //
      //     rights: [
      //       {
      //         description: {en: existingLicense?.license_content},
      //         title: {en: existingLicense?.custom_license_title}
      //       }
      //     ],
      //     version: zenodoMetadata.zenodo_metadata.version || codeMetaContent?.version,
      //     custom_license: zenodoMetadata.zenodo_metadata.custom_license,
      //   }
      // }
    }
    const metadata = {
      title: codeMetaContent?.name,
      description: codeMetaContent?.description,
      creators: zenodoCreators,
      access_right: zenodoMetadata.zenodo_metadata.accessRight,
      publication_date: new_date,
      license: licenseId,
      version:
        zenodoMetadata.zenodo_metadata?.version || codeMetaContent?.version,
    };

    if (addUploadType) {
      metadata.upload_type = "software";
    }

    return { metadata };
  } catch (error) {
    throw new Error(`Error getting Zenodo metadata: ${error}`, {
      cause: error,
    });
  }
}

/**
 * * Updates the Zenodo metadata for the deposition
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {Object} metadata - Zenodo metadata object
 * @returns - Object of updated Zenodo metadata
 */
export async function updateZenodoMetadata(
  depositionId,
  zenodoToken,
  metadata
) {
  try {
    const url = `${ZENODO_API_ENDPOINT}/deposit/depositions/${depositionId}`;
    logwatch.start(`Updating Zenodo metadata for deposition: ${depositionId}`);
    logwatch.debug(`PUT URL: ${url}`);

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${zenodoToken}`,
      },
      body: JSON.stringify(metadata),
    });

    // Log the status for debugging purposes
    logwatch.debug(
      `Received response with status: ${response.status} ${response.statusText}`
    );

    if (!response.ok) {
      let errorDetail;
      try {
        errorDetail = await response.json();
      } catch (jsonError) {
        errorDetail = await response.text();
      }
      logwatch.error(
        {
          message: "Error updating Zenodo metadata:",
          errorDetail,
        },
        true
      );
      throw new Error(
        `Failed to update Zenodo metadata. Status: ${response.status}: ${response.statusText}. Error: ${JSON.stringify(errorDetail)}`
      );
    }

    const updatedMetadataInfo = await response.json();
    logwatch.success("Zenodo deposition metadata updated successfully!");
    console.log("Updated metadata:", updatedMetadataInfo);

    // If the metadata does not have an upload_type, add it and update the metadata again.
    if (!updatedMetadataInfo?.metadata?.upload_type) {
      logwatch.start("Adding upload_type to Zenodo metadata...");
      logwatch.info(
        `Adding upload_type to Zenodo metadata for deposition: ${depositionId}`
      );
      const newMetadata = {
        ...updatedMetadataInfo.metadata,
        upload_type: "software",
      };
      await updateZenodoMetadata(depositionId, zenodoToken, {
        metadata: newMetadata,
      });
      logwatch.success("Upload type added to Zenodo metadata!");
    }

    return updatedMetadataInfo;
  } catch (error) {
    logwatch.error(
      `Exception in updateZenodoMetadata: ${error.message}`,
      error
    );
    throw new Error(`Error updating Zenodo metadata: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * * Uploads the release assets to Zenodo deposition
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {Array} draftReleaseAssets - List of objects containing the release assets information
 * @param {*} repositoryArchive - The repository archive file
 * @param {String} owner - GitHub owner
 * @param {Object} context - GitHub context
 * @param {String} bucket_url - Zenodo bucket URL
 */
export async function uploadReleaseAssetsToZenodo(
  zenodoToken,
  draftReleaseAssets,
  repositoryArchive,
  owner,
  context,
  bucket_url,
  repository,
  tagVersion
) {
  const startTime = performance.now();
  if (draftReleaseAssets.length > 0) {
    for (const asset of draftReleaseAssets) {
      try {
        // Download the raw file from GitHub
        const { data: assetData } = await context.octokit.repos.getReleaseAsset(
          {
            owner,
            repo: repository.name,
            asset_id: asset.id,
            headers: {
              accept: "application/octet-stream",
            },
          }
        );

        if (!assetData) {
          logwatch.error(`Failed to fetch asset data for ${asset.name}`);
          throw new Error(`Failed to fetch asset data for ${asset.name}`);
        }
        logwatch.success(
          `Asset data fetched for ${asset.name}, for the release ${tagVersion}, from the GitHub repository: ${repository.name}`
        );

        // Convert the asset data to a buffer
        const assetBuffer = Buffer.from(assetData);

        // Upload the file to Zenodo
        const uploadAsset = await fetch(`${bucket_url}/${asset.name}`, {
          method: "PUT",
          body: assetBuffer, // Upload the raw file directly
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${zenodoToken}`,
            "Content-Type": "application/octet-stream",
          },
        });

        if (!uploadAsset.ok) {
          logwatch.error({
            message: `Failed to upload ${asset.name}. Status: ${uploadAsset.statusText}, Status Code: ${uploadAsset.status}`,
            error: uploadAsset,
          });
          throw new Error(
            `Failed to upload ${asset.name}. Status: ${uploadAsset.statusText}, Status Code: ${uploadAsset.status}`
          );
        } else {
          logwatch.success(`${asset.name} successfully uploaded to Zenodo!`);
        }
      } catch (error) {
        throw new Error(`Error uploading assets to Zenodo: ${error}`, {
          cause: error,
        });
      }
    }
  }

  // Upload the repository archive to Zenodo
  const uploadZip = await fetch(
    `${bucket_url}/${repository.name}-${tagVersion}.zip`,
    {
      method: "PUT",
      body: repositoryArchive,
      headers: {
        Authorization: `Bearer ${zenodoToken}`,
      },
    }
  );

  if (!uploadZip.ok) {
    logwatch.error(
      `Failed to upload zip file. Status: ${uploadZip.statusText}, Status Code: ${uploadZip.status} `
    );
    throw new Error(
      `Failed to upload zip file. Status: ${uploadZip.statusText}, Status Code: ${uploadZip.status} `
    );
  }

  const endTime = performance.now();
  logwatch.info(
    `Total duration to upload assets and zip to Zenodo deposition: ${(endTime - startTime) / 1000} seconds`
  );
  logwatch.success("Zip file successfully uploaded to Zenodo!");
}

/**
 * * Deletes a file from a Zenodo deposition
 * @param {String} depositionId - Zenodo deposition ID
 * @param {String} zenodoToken - Access token for Zenodo API
 * @param {String} fileId - Zenodo file ID
 */
export async function deleteFileFromZenodo(
  depositionId,
  zenodoToken,
  fileName
) {
  try {
    const deleteFile = await fetch(
      `${ZENODO_API_ENDPOINT}/records/${depositionId}/draft/files/${fileName}?access_token=${zenodoToken}`,
      {
        method: "DELETE",
      }
    );

    if (!deleteFile.ok) {
      const errorText = await deleteFile.text();
      throw new Error(
        `Failed to delete file from Zenodo. Status: ${deleteFile.status}: ${deleteFile.statusText}. Error: ${errorText}`
      );
    }

    logwatch.success("File successfully deleted from Zenodo!");
  } catch (error) {
    throw new Error(`Error deleting file from Zenodo: ${error}`, {
      cause: error,
    });
  }
}

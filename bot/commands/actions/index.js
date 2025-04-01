// Description: This file contains the main functions that are called by the UI to trigger bot actions.
import { renderIssues, createIssue } from "../../utils/renderer/index.js";
import dbInstance from "../../db.js";
import { logwatch } from "../../utils/logwatch.js";
import {
  applyLastModifiedTemplate,
  getReleaseById,
  downloadRepositoryZip,
} from "../../utils/tools/index.js";
import {
  getZenodoDepositionInfo,
  createZenodoMetadata,
  updateZenodoMetadata,
  uploadReleaseAssetsToZenodo,
  parseZenodoInfo,
  getZenodoToken,
  publishZenodoDeposition,
  updateGitHubRelease,
} from "../../archival/index.js";
import {
  validateMetadata,
  getCitationContent,
  getCodemetaContent,
  updateMetadataIdentifier,
} from "../../metadata/index.js";

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const ISSUE_TITLE = `FAIR Compliance Dashboard`;
const { ZENODO_ENDPOINT } = process.env;

export async function reRenderDashboard(context, owner, repository, issueBody) {
  // Run database queries in parallel using Promise.all
  logwatch.start("Re-rendering issue dashboard...");
  try {
    const [licenseResponse, metadataResponse, cwlResponse] = await Promise.all([
      dbInstance.licenseRequest.findUnique({
        where: {
          repository_id: repository.id,
        },
      }),
      dbInstance.codeMetadata.findUnique({
        where: {
          repository_id: repository.id,
        },
      }),
      dbInstance.cwlValidation.findUnique({
        where: {
          repository_id: repository.id,
        },
      }),
    ]);

    const license = !!licenseResponse?.license_id;
    const citation = !!metadataResponse?.contains_citation;
    const codemeta = !!metadataResponse?.contains_codemeta;
    const cwl = !!cwlResponse?.contains_cwl_files;

    const cwlObject = {
      contains_cwl_files: cwl,
      files: cwlResponse?.files || [],
      removed_files: [],
    };

    const subjects = {
      citation,
      codemeta,
      cwl: cwlObject,
      license,
    };

    const issueBody = await renderIssues(
      context,
      owner,
      repository,
      false,
      subjects
    );

    await createIssue(context, owner, repository, ISSUE_TITLE, issueBody);
  } catch (error) {
    // Remove the command from the issue body
    const issueBodyRemovedCommand = issueBody.substring(
      0,
      issueBody.indexOf(`<sub><span style="color: grey;">Last updated`)
    );
    const lastModified = await applyLastModifiedTemplate(
      issueBodyRemovedCommand
    );
    await createIssue(context, owner, repository, ISSUE_TITLE, lastModified);
    throw new Error("Error rerunning re-rendering dashboard", error);
  }
}

export async function publishToZenodo(context, owner, repository, issueBody) {
  logwatch.start("Publishing to Zenodo...");
  const issueBodyRemovedCommand = issueBody.substring(
    0,
    issueBody.indexOf("<!-- @codefair-bot publish-zenodo")
  );
  const issueBodyNoArchiveSection = issueBodyRemovedCommand.substring(
    0,
    issueBody.indexOf("## FAIR Software Release")
  );
  const badgeURL = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/release/zenodo`;
  const releaseBadge = `[![Create Release](https://img.shields.io/badge/Create_Release-00bcd4.svg)](${badgeURL})`;
  const { depositionId, releaseId, tagVersion, userWhoSubmitted } =
    parseZenodoInfo(issueBody);

  // console.log("Parsed Zenodo info:", {
  //   depositionId,
  //   releaseId,
  //   tagVersion,
  //   userWhoSubmitted,
  // });
  logwatch.info(
    {
      message: `Parsed Zenodo info:`,
      depositionId,
      releaseId,
      tagVersion,
      userWhoSubmitted,
    },
    true
  );

  try {
    // 1. Get the metadata from the repository
    const citationCff = await getCitationContent(context, owner, repository);
    const codemeta = await getCodemetaContent(context, owner, repository);

    // 2. Validate the CITATION.cff and codemeta.json files
    await validateMetadata(citationCff, "citation", repository);
    await validateMetadata(codemeta, "codemeta", repository);

    // 3. Fetch the Zenodo token from the database and verify it is valid
    const zenodoToken = await getZenodoToken(userWhoSubmitted);
    // console.log("Zenodo token:", zenodoToken);

    // 4. Create the Zenodo record or get the existing one and create a new draft deposition if none exist
    logwatch.info("Creating a new Zenodo deposition...");
    const zenodoDepositionInfo = await getZenodoDepositionInfo(
      depositionId,
      zenodoToken
    );

    // Sending the Zenodo deposition info to the log in the case of an error
    // console.log("Zenodo Deposition Info:", zenodoDepositionInfo);
    logwatch.info(
      {
        message: "Zenodo Deposition Info: ",
        zenodoDepositionInfo,
      },
      true
    );

    // 4.5 Set the bucket URL and DOI
    // using record_id over id because it the id of the current deposition
    const addUploadType = !!zenodoDepositionInfo?.metadata?.upload_type;
    const newDepositionId = zenodoDepositionInfo.record_id;
    const bucket_url = zenodoDepositionInfo.links.bucket;
    const zenodoDoi = zenodoDepositionInfo.metadata.prereserve_doi.doi;

    // Update progress in the GitHub issue
    const tempString = `${issueBodyNoArchiveSection}\n\n## FAIR Software Release 🔄\n***${tagVersion}*** of your software is being released on GitHub and archived on Zenodo. A draft deposition was created and will be adding the necessary files and metadata.`;
    const finalTempString = await applyLastModifiedTemplate(tempString);
    await createIssue(context, owner, repository, ISSUE_TITLE, finalTempString);

    // 5. Update the CITATION.cff and codemeta.json files with the DOI provided by Zenodo
    const updatedMetadataFile = await updateMetadataIdentifier(
      context,
      owner,
      repository,
      zenodoDoi,
      tagVersion
    );

    // 6. Gather metadata for Zenodo deposition
    const newZenodoMetadata = await createZenodoMetadata(
      updatedMetadataFile,
      repository,
      addUploadType
    );

    // console.log("New Zenodo metadata:", newZenodoMetadata);

    // 7. Update the Zenodo deposition's metadata
    await updateZenodoMetadata(newDepositionId, zenodoToken, newZenodoMetadata);

    // 7.5 Get the GitHub draft release from the repository
    const draftRelease = await getReleaseById(
      context,
      repository.name,
      owner,
      releaseId
    );

    const repositoryArchive = await downloadRepositoryZip(
      context,
      owner,
      repository.name
    );

    await uploadReleaseAssetsToZenodo(
      zenodoToken,
      draftRelease.data.assets,
      repositoryArchive,
      owner,
      context,
      bucket_url,
      repository,
      tagVersion
    );

    // Update the GitHub issue with a status report
    logwatch.info("Updating the GitHub issue with a status report...");
    const afterUploadString = `${issueBodyNoArchiveSection}\n\n## FAIR Software Release 🔄\n***${tagVersion}*** of your software is being released on GitHub and archived on Zenodo under the version ${newZenodoMetadata.metadata.version}. All assets from the GitHub repository's draft release have been successfully uploaded to the Zenodo deposition draft.`;
    const finalUploadString =
      await applyLastModifiedTemplate(afterUploadString);
    await createIssue(
      context,
      owner,
      repository,
      ISSUE_TITLE,
      finalUploadString
    );

    // 8. Publish the Zenodo deposition
    logwatch.info("Publishing the Zenodo deposition...");
    await publishZenodoDeposition(zenodoToken, newDepositionId);

    // Update the release to not be a draft
    logwatch.info("Releasing GitHub draft...");
    await updateGitHubRelease(context, repository.name, owner, releaseId);

    // 9. Append to the issueBody that the deposition has been published
    // Update the issue with the new body
    logwatch.success("Successful release, updating the issue body...");
    const badge = `[![DOI](https://img.shields.io/badge/DOI-${zenodoDoi}-blue)](${ZENODO_ENDPOINT}/records/${newDepositionId})`;
    const issueBodyArchiveSection = `${issueBodyNoArchiveSection}\n\n## FAIR Software Release ✔️\n***${tagVersion}*** of your software was successfully released on GitHub and archived on Zenodo. You can view the Zenodo archive by clicking the button below:\n\n${badge}\n\nReady to create your next FAIR release? Click the button below:\n\n${releaseBadge}`;
    const finalTemplate = await applyLastModifiedTemplate(
      issueBodyArchiveSection
    );
    await createIssue(context, owner, repository, ISSUE_TITLE, finalTemplate);

    // Update the database with the Zenodo ID and the status
    await dbInstance.zenodoDeposition.update({
      data: {
        status: "published",
        zenodo_id: newDepositionId,
        existing_zenodo_deposition_id: true,
        last_published_zenodo_doi: zenodoDoi,
      },
      where: {
        repository_id: repository.id,
      },
    });

    logwatch.success("Updated the Zenodo deposition in the database!");

    await dbInstance.analytics.update({
      data: {
        zenodo_release: {
          increment: 1,
        },
        create_release: {
          increment: 1,
        },
      },
      where: {
        id: repository.id,
      },
    });

    logwatch.success("Updated the analytics in the database!");
    logwatch.success("Zenodo publication process completed successfully!");
  } catch (error) {
    // Update the issue with the new body
    // Update the GitHub issue with a status report
    const afterUploadString = `${issueBodyNoArchiveSection}\n\n## FAIR Software Release ❌\n***${tagVersion}*** of your software was not successfully released on GitHub and archived on Zenodo. There was an error during the publication process. Please try again later or reach out to the Codefair team for additional help.`;
    const finalUploadString =
      await applyLastModifiedTemplate(afterUploadString);
    await createIssue(
      context,
      owner,
      repository,
      ISSUE_TITLE,
      finalUploadString
    );
    await dbInstance.zenodoDeposition.update({
      data: {
        status: "error",
      },
      where: {
        repository_id: repository.id,
      },
    });
    if (error.cause) {
      logwatch.error(
        {
          message: "Error.cause message for Zenodo Publishing",
          error: error.cause,
        },
        true
      );
    }
    throw new Error(`Error publishing to Zenodo: ${error.message}`, {
      cause: error,
    });
  }
}

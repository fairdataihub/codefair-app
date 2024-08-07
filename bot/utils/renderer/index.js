import url from "url";
import {
  applyGitHubIssueToDatabase,
  createId,
  isRepoPrivate,
} from "../tools/index.js";
import { validateCWLFile } from "../cwl/index.js";
import { gatherMetadata, convertMetadataForDB } from "../metadata/index.js";
import dbInstance from "../../db.js";

const GITHUB_APP_NAME = process.env.GITHUB_APP_NAME;
const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

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
    // console.log(owner, repository);
    // License was found but no codemeta.json or CITATION.cff exists
    const identifier = createId();

    let url = `${CODEFAIR_DOMAIN}/add/code-metadata/${identifier}`;

    const metadataCollection = dbInstance.getDb().collection("codeMetadata");
    const existingMetadata = await metadataCollection.findOne({
      repositoryId: repository.id,
    });

    if (!existingMetadata) {
      // Entry does not exist in db, create a new one
      const newDate = Date.now();
      const gatheredMetadata = await gatherMetadata(context, owner, repository);
      await metadataCollection.insertOne({
        created_at: newDate,
        identifier,
        metadata: gatheredMetadata,
        open: true,
        owner,
        repo: repository.name,
        repositoryId: repository.id,
        updated_at: newDate,
      });
    } else {
      // Get the identifier of the existing metadata request
      await metadataCollection.updateOne(
        { repositoryId: repository.id },
        { $set: { updated_at: Date.now() } },
      );

      url = `${CODEFAIR_DOMAIN}/add/code-metadata/${existingMetadata.identifier}`;
    }
    const metadataBadge = `[![Metadata](https://img.shields.io/badge/Add_Metadata-dc2626.svg)](${url})`;
    baseTemplate += `\n\n## Metadata ❌\n\nTo make your software FAIR, a CITATION.cff and codemetada.json are expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org/docs/guidelines). These files are not found in the repository. If you would like Codefair to add these files, click the "Add metadata" button below to go to our interface for providing metadata and generating these files.\n\n${metadataBadge}`;
  }

  if (subjects.codemeta && subjects.citation && subjects.license) {
    // Download the codemeta.json file from the repo
    const codemetaFile = await context.octokit.repos.getContent({
      owner,
      path: "codemeta.json",
      repo: repository.name,
    });

    // Convert the content to a json object
    const codemetaContent = JSON.parse(
      Buffer.from(codemetaFile.data.content, "base64").toString(),
    );

    // Convert the content to the structure we use for code metadata
    const metadata = convertMetadataForDB(codemetaContent);

    // License, codemeta.json and CITATION.cff files were found
    const identifier = createId();

    let url = `${CODEFAIR_DOMAIN}/add/code-metadata/${identifier}`;

    const metadataCollection = dbInstance.getDb().collection("codeMetadata");
    const existingMetadata = await metadataCollection.findOne({
      repositoryId: repository.id,
    });

    if (!existingMetadata) {
      // Entry does not exist in db, create a new one
      const newDate = Date.now();
      // const gatheredMetadata = await gatherMetadata(context, owner, repository);
      await metadataCollection.insertOne({
        created_at: newDate,
        identifier,
        metadata,
        open: true,
        owner,
        repo: repository.name,
        repositoryId: repository.id,
        updated_at: newDate,
      });
    } else {
      // Get the identifier of the existing metadata request
      await metadataCollection.updateOne(
        { repositoryId: repository.id },
        { $set: { metadata, updated_at: Date.now() } },
      );

      url = `${CODEFAIR_DOMAIN}/add/code-metadata/${existingMetadata.identifier}`;
    }
    const metadataBadge = `[![Metadata](https://img.shields.io/badge/Edit_Metadata-0ea5e9.svg)](${url}?)`;
    baseTemplate += `\n\n## Metadata ✔️\n\nA CITATION.cff and a codemeta.json file are found in the repository. They may need to be updated over time as new people are contributing to the software, etc.\n\n${metadataBadge}`;
  }

  if (!subjects.license) {
    // License was not found
    const metadataBadge = `![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`;
    baseTemplate += `\n\n## Metadata\n\nTo make your software FAIR a CITATION.cff and codemetada.json metadata files are expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org/docs/guidelines). Codefair will check for these files after a license file is detected.\n\n${metadataBadge}`;
  }

  return baseTemplate;
}

/**
 * * Applies the license template to the base template
 *
 * @param {object} subjects - The subjects to check for
 * @param {string} baseTemplate - The base template to add to
 * @param {object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 *
 * @returns {string} - The updated base template
 */
export async function applyLicenseTemplate(
  subjects,
  baseTemplate,
  repository,
  owner,
  context,
) {
  if (!subjects.license) {
    const identifier = createId();
    let url = `${CODEFAIR_DOMAIN}/add/license/${identifier}`;
    const licenseCollection = dbInstance.getDb().collection("licenseRequests");
    const existingLicense = await licenseCollection.findOne({
      repositoryId: repository.id,
    });

    if (!existingLicense) {
      // Entry does not exist in db, create a new one
      const newDate = Date.now();
      await licenseCollection.insertOne({
        created_at: newDate,
        identifier,
        open: true,
        owner,
        repo: repository.name,
        repositoryId: repository.id,
        updated_at: newDate,
      });
    } else {
      // Get the identifier of the existing license request
      // Update the database
      await licenseCollection.updateOne(
        { repositoryId: repository.id },
        { $set: { updated_at: Date.now() } },
      );
      url = `${CODEFAIR_DOMAIN}/add/license/${existingLicense.identifier}`;
    }
    // No license file found text
    const licenseBadge = `[![License](https://img.shields.io/badge/Add_License-dc2626.svg)](${url})`;
    baseTemplate += `## LICENSE ❌\n\nTo make your software reusable a license file is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). If you would like Codefair to add a license file, click the "Add license" button below to go to our interface for selecting and adding a license. You can also add a license file yourself and Codefair will update the the dashboard when it detects it on the main branch.\n\n${licenseBadge}`;
  } else {
    // Get the license identifier
    const licenseRequest = await context.octokit.rest.licenses.getForRepo({
      owner,
      repo: repository.name,
    });

    let licenseId = licenseRequest.data.license.spdx_id;
    let licenseContent = Buffer.from(
      licenseRequest.data.content,
      "base64",
    ).toString("utf-8");
    if (
      licenseRequest.data.license.spdx_id === "no-license" ||
      licenseRequest.data.license.spdx_id === "NOASSERTION"
    ) {
      licenseId = null;
      licenseContent = null;
    }

    // License file found text
    const identifier = createId();
    let url = `${CODEFAIR_DOMAIN}/add/license/${identifier}`;
    const licenseCollection = dbInstance.getDb().collection("licenseRequests");
    const existingLicense = await licenseCollection.findOne({
      repositoryId: repository.id,
    });

    if (!existingLicense) {
      // Entry does not exist in db, create a new one
      const newDate = Date.now();
      await licenseCollection.insertOne({
        created_at: newDate,
        identifier,
        licenseContent,
        licenseId,
        open: true,
        owner,
        repo: repository.name,
        repositoryId: repository.id,
        updated_at: newDate,
      });
    } else {
      // Get the identifier of the existing license request
      // Update the database
      await licenseCollection.updateOne(
        { repositoryId: repository.id },
        { $set: { licenseContent, licenseId, updated_at: Date.now() } },
      );
      url = `${CODEFAIR_DOMAIN}/add/license/${existingLicense.identifier}`;
    }
    const licenseBadge = `[![License](https://img.shields.io/badge/Edit_License-0ea5e9.svg)](${url})`;
    baseTemplate += `## LICENSE ✔️\n\nA LICENSE file is found at the root level of the repository.\n\n${licenseBadge}`;
  }

  return baseTemplate;
}

/**
 *
 * @param {Object} subjects - The subjects to check for
 * @param {String} baseTemplate - The base template to add to
 * @param {Object} repository - Repository object
 * @param {String} owner - Repository owner
 * @param {Object} context - GitHub context object
 * @returns
 */
export async function applyCWLTemplate(
  subjects,
  baseTemplate,
  repository,
  owner,
  context,
) {
  const privateRepo = await isRepoPrivate(context, owner, repository.name);
  // If the repository is private and contains CWL files, we cannot validate them
  if (privateRepo && subjects.cwl.contains_cwl) {
    baseTemplate += `\n\n## CWL Validations ❌\n\n> [!WARNING]\n> Your repository is private. Codefair will not be able to validate any CWL files for you. You can check the CWL file yourself using the [cwltool validator](https://cwltool.readthedocs.io/en/latest/)`;
    return baseTemplate;
  }

  let url = `${CODEFAIR_DOMAIN}/add/cwl/`;
  const identifier = createId();
  const cwlCollection = dbInstance.getDb().collection("cwlValidation");
  const existingCWL = await cwlCollection.findOne({
    repositoryId: repository.id,
  });

  // If no CWL files are found in the list of files
  if (subjects.cwl.files.length === 0) {
    let tableContent = "";
    if (!existingCWL) {
      // Entry does not exist in the db, create a new one
      // No CWL files found in the repository
      const newDate = Date.now();
      await cwlCollection.insertOne({
        contains_cwl_files: subjects.cwl.contains_cwl,
        created_at: newDate,
        files: [],
        identifier,
        overall_status: "",
        owner,
        repo: repository.name,
        repositoryId: repository.id,
      });
    } else {
      // CWL files were found in the repository but no new ones to validate were found
      // Get the identifier of the existing cwl request
      await cwlCollection.updateOne(
        { repositoryId: repository.id },
        { $set: { updated_at: Date.now() } },
      );

      // TODO: Create a table of the cwl files that were validated
      for (const file of existingCWL.files) {
        tableContent += `| ${file.path} | ${file.validation_status === "valid" ? "❗" : "❌"} |\n`;
      }
    }

    console.log(subjects);
    console.log(subjects.cwl.contains_cwl);
    if (!subjects.cwl.contains_cwl) {
      console.log("no cwl files in repo");
      // NO CWL files found in the repository, return the base template without appending anything
      return baseTemplate;
    }

    // No new CWL files were found in the repository but some were validated already
    const cwlBadge = `[![CWL](https://img.shields.io/badge/View_CWL_Report-0ea5e9.svg)](${url})`;
    console.log("repo has cwl files but no new ones to validate");
    baseTemplate += `\n\n## CWL Validations\n\nNo new CWL files were found in the repository but ***${existingCWL.files.length}/${existingCWL.files.length}*** that were validated already are considered valid by the [cwltool validator](https://cwltool.readthedocs.io/en/latest/).\n\n<details>\n<summary>Summary of the validation report</summary>\n\n| File | Status |\n| :---- | :----: |\n${tableContent}</details>\n\nTo view the full report of each CWL file or rerun the validation, click the "View CWL Report" button below.\n\n${cwlBadge}`;
  } else {
    const cwlFiles = [];
    let validOverall = true;
    let tableContent = "";
    let failedCount = 0;
    // Iterate through the list of files initially gathered
    for (const file of subjects.cwl.files) {
      const fileSplit = file.name.split(".");
      if (fileSplit.includes("cwl")) {
        const [isValidCWL, validationMessage] = await validateCWLFile(
          file.download_url,
        );

        if (!isValidCWL && validOverall) {
          validOverall = false;
        }

        if (!isValidCWL) {
          failedCount += 1;
        }

        const newDate = Date.now();
        cwlFiles.push({
          href: file.html_url,
          last_modified: newDate,
          last_validated: newDate,
          path: file.path,
          validation_message: validationMessage,
          validation_status: isValidCWL ? "valid" : "invalid",
        });

        tableContent += `| ${file.path} | ${isValidCWL ? "❗" : "❌"} |\n`;
      }
    }
    url = `${CODEFAIR_DOMAIN}/add/cwl/${identifier}`;
    if (!existingCWL) {
      // Entry does not exist in the db, create a new one
      const newDate = Date.now();
      await cwlCollection.insertOne({
        contains_cwl_files: subjects.cwl.contains_cwl,
        created_at: newDate,
        files: cwlFiles,
        identifier,
        overall_status: validOverall ? "valid" : "invalid",
        owner,
        repo: repository.name,
        repositoryId: repository.id,
        updated_at: newDate,
      });
    } else {
      // Get the identifier of the existing cwl request
      await cwlCollection.updateOne(
        { repositoryId: repository.id },
        {
          $set: {
            contains_cwl_files: true,
            files: [...existingCWL.files, ...cwlFiles], // Join the existing files with the new ones
            overall_status: validOverall ? "valid" : "invalid",
            updated_at: Date.now(),
          },
        },
      );
      url = `${CODEFAIR_DOMAIN}/add/cwl/${existingCWL.identifier}`;

      // TODO: Create a table of the cwl files that were validated
      for (const file of existingCWL.files) {
        tableContent += `| ${file.path} | ${file.validation_status === "valid" ? "❗" : "❌"} |\n`;
        subjects.cwl.files.push(file);

        if (file.validation_status === "invalid") {
          failedCount += 1;
        }

        if (file.validation_status === "invalid" && validOverall) {
          validOverall = false;
        }
      }
    }

    const cwlBadge = `[![CWL](https://img.shields.io/badge/View_CWL_Report-0ea5e9.svg)](${url})`;
    baseTemplate += `\n\n## CWL Validations ${validOverall ? "✔️" : "❌"}\n\nCWL files were found in the repository and ***${subjects.cwl.files.length - failedCount}/${subjects.cwl.files.length}*** are considered valid by the [cwltool validator](https://cwltool.readthedocs.io/en/latest/).\n\n<details>\n<summary>Summary of the validation report</summary>\n\n| File | Status |\n| :---- | :----: |\n${tableContent}</details>\n\nTo view the full report of each CWL file or to rerun the validation, click the "View CWL Report" button below.\n\n${cwlBadge}`;
  }

  return baseTemplate;
}

/**
 * * Renders the body of the dashboard issue message
 *
 * @param {Object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {object} repository  - The repository metadata
 * @param {object} prInfo  - The PR information
 * @param {string} prTitle - The title of the PR
 * @param {string} prNumber - The number of the PR
 * @param {string} prLink - The link to the PR
 * @param {array} commits - The commits that were pushed
 *
 * @returns {string} - The rendered issue message
 */
export async function renderIssues(
  context,
  owner,
  repository,
  emptyRepo,
  subjects,
  prInfo = { title: "", link: "" },
) {
  if (emptyRepo) {
    console.log("emtpy repo and returning base");
    return `# Check the FAIRness of your software\n\nThis issue is your repository's dashboard for all things FAIR. Keep it open as making and keeping software FAIR is a continuous process that evolves along with the software. You can read the [documentation](https://docs.codefair.io/docs/dashboard.html) to learn more.\n\n> [!WARNING]\n> Currently your repository is empty and will not be checked until content is detected within your repository.\n\n## LICENSE\n\nTo make your software reusable a license file is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). Codefair will check for a license file after you add content to your repository.\n\n![License](https://img.shields.io/badge/License_Not_Checked-fbbf24)\n\n## Metadata\n\nTo make your software FAIR a CITATION.cff and codemetada.json metadata files are expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org/docs/guidelines). Codefair will check for these files after a license file is detected.\n\n![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`;
  }

  let baseTemplate = `# Check the FAIRness of your software\n\nThis issue is your repository's dashboard for all things FAIR. Keep it open as making and keeping software FAIR is a continuous process that evolves along with the software. You can read the [documentation](https://docs.codefair.io/docs/dashboard.html) to learn more.\n\n`;

  baseTemplate = await applyLicenseTemplate(
    subjects,
    baseTemplate,
    repository,
    owner,
    context,
  );

  // If License PR is open, add the PR number to the dashboard
  if (prInfo.title === "feat: ✨ LICENSE file added") {
    baseTemplate += `\n\nA pull request for the LICENSE file is open. You can view the pull request:\n\n[![License](https://img.shields.io/badge/View_PR-6366f1.svg)](${prInfo.link})`;
  }

  baseTemplate = await applyMetadataTemplate(
    subjects,
    baseTemplate,
    repository,
    owner,
    context,
  );

  if (prInfo.title === "feat: ✨ metadata files added") {
    baseTemplate += `\n\nA pull request for the metadata files is open. You can view the pull request:\n\n[![Metadata](https://img.shields.io/badge/View_PR-6366f1.svg)](${prInfo.link})`;
  }

  baseTemplate = await applyCWLTemplate(
    subjects,
    baseTemplate,
    repository,
    owner,
    context,
  );

  return baseTemplate;
}

/**
 * * Creates an issue in the repository with the given title and body (Verifies if an issue with the same title exists)
 *
 * @param {object} context - The context of the GitHub Event
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The repository name
 * @param {string} title - The title of the issue
 * @param {string} body - The body of the issue
 */
export async function createIssue(context, owner, repository, title, body) {
  // If issue has been created, create one
  console.log("Gathering open issues");
  const issue = await context.octokit.issues.listForRepo({
    title,
    creator: `${GITHUB_APP_NAME}[bot]`,
    owner,
    repo: repository.name,
    state: "open",
  });

  if (issue.data.length > 0) {
    // iterate through issues to see if there is an issue with the same title
    let noIssue = false;
    let issueNumber;
    for (let i = 0; i < issue.data.length; i++) {
      if (issue.data[i].title === title) {
        noIssue = true;
        issueNumber = issue.data[i].number;
        break;
      }
    }

    if (!noIssue) {
      console.log("Creating an issue since no open issue was found");
      // Issue has not been created so we create one
      const response = await context.octokit.issues.create({
        title,
        body,
        owner,
        repo: repository.name,
      });

      await applyGitHubIssueToDatabase(response.data.number, repository.id);
    } else {
      // Update the issue with the new body
      console.log("Updating existing issue: " + issueNumber);
      await context.octokit.issues.update({
        title,
        body,
        issue_number: issueNumber,
        owner,
        repo: repository.name,
      });

      await applyGitHubIssueToDatabase(issueNumber, repository.id);
    }
  }

  if (issue.data.length === 0) {
    // Issue has not been created so we create one
    const response = await context.octokit.issues.create({
      title,
      body,
      owner,
      repo: repository.name,
    });

    console.log(response.data.number);

    await applyGitHubIssueToDatabase(response.data.number, repository.id);
  }
}

// TODO: Functions below are temporarily being unused (metadata section was combined. Seperate sections might come back though)

/**
 * * Applies the codemeta template to the base template
 *
 * @param {object} subjects - The subjects to check for
 * @param {string} baseTemplate - The base template to add to
 * @param {*} db - The database
 * @param {object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 *
 * @returns {string} - The updated base template
 */
export async function applyCodemetaTemplate(
  subjects,
  baseTemplate,
  db,
  repository,
  owner,
) {
  if (!subjects.codemeta && subjects.license) {
    // License was found but no codemeta.json exists
    const identifier = createId();

    let url = `${CODEFAIR_DOMAIN}/add/codemeta/${identifier}`;

    const codemetaCollection = db.collection("codeMetadata");
    // console.log(repository);
    const existingCodemeta = await codemetaCollection.findOne({
      repositoryId: repository.id,
    });

    if (!existingCodemeta) {
      // Entry does not exist in db, create a new one
      const newDate = Date.now();
      await codemetaCollection.insertOne({
        created_at: newDate,
        identifier,
        open: true,
        owner,
        repo: repository.name,
        repositoryId: repository.id,
        updated_at: newDate,
      });
    } else {
      // Get the identifier of the existing codemeta request
      await codemetaCollection.updateOne(
        { repositoryId: repository.id },
        { $set: { updated_at: Date.now() } },
      );
      url = `${CODEFAIR_DOMAIN}/add/codemeta/${existingCodemeta.identifier}`;
    }

    const codemetaBadge = `[![Citation](https://img.shields.io/badge/Add_Codemeta-dc2626.svg)](${url})`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file was not found in the repository. To make your software reusable a codemetada.json is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org).\n\n${codemetaBadge}`;
  } else if (subjects.codemeta && subjects.license) {
    // License was found and codemetata.json also exists
    // Then add codemeta section mentioning it will be checked after license is added

    if (!existingLicense) {
      // Entry does not exist in db, create a new one
      const newDate = Date.now();
      await licenseCollection.insertOne({
        created_at: newDate,
        identifier,
        open: true,
        owner,
        repo: repository.name,
        repositoryId: repository.id,
        updated_at: newDate,
      });
    } else {
      // Get the identifier of the existing license request
      // Update the database
      await licenseCollection.updateOne(
        { repositoryId: repository.id },
        { $set: { updated_at: Date.now() } },
      );
      url = `${CODEFAIR_DOMAIN}/add/license/${existingLicense.identifier}`;
    }
    const codemetaBadge = `[![Citation](https://img.shields.io/badge/Edit_Codemeta-dc2626.svg)](${url})`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file found in the repository.\n\n${codemetaBadge}`;
  } else {
    // codemeta and license does not exist
    const codemetaBadge = `![CodeMeta](https://img.shields.io/badge/Codemeta_Not_Checked-fbbf24)`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file will be checked after a license file is added. To make your software reusable a codemetada.json is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org).\n\n${codemetaBadge}`;
  }

  return baseTemplate;
}

/**
 * * Applies the citation template to the base template
 *
 * @param {object} subjects - The subjects to check for
 * @param {string} baseTemplate - The base template to add to
 * @param {*} db - The database
 * @param {object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 *
 * @returns {string} - The updated base template
 */
export async function applyCitationTemplate(
  subjects,
  baseTemplate,
  db,
  repository,
  owner,
) {
  if (!subjects.citation && subjects.license) {
    // License was found but no citation file was found
    const identifier = createId();

    let url = `${CODEFAIR_DOMAIN}/add/citation/${identifier}`;
    const citationCollection = db.collection("citationRequests");
    // console.log(repository);
    const existingCitation = await citationCollection.findOne({
      repositoryId: repository.id,
    });

    if (!existingCitation) {
      // Entry does not exist in db, create a new one
      const newDate = Date.now();
      await citationCollection.insertOne({
        created_at: newDate,
        identifier,
        open: true,
        owner,
        repo: repository.name,
        repositoryId: repository.id,
        updated_at: newDate,
      });
    } else {
      // Get the identifier of the existing citation request
      await citationCollection.updateOne(
        { repositoryId: repository.id },
        { $set: { updated_at: Date.now() } },
      );
      url = `${CODEFAIR_DOMAIN}/add/citation/${existingCitation.identifier}`;
    }

    const citationBadge = `[![Citation](https://img.shields.io/badge/Add_Citation-dc2626.svg)](${url})`;
    baseTemplate += `\n\n## CITATION.cff\n\nA CITATION.cff file was not found in the repository. The [FAIR-BioRS guidelines](https://fair-biors.org/docs/guidelines) suggests to include that file for providing metadata about your software and make it FAIR.\n\n${citationBadge}`;
  } else if (subjects.citation && subjects.license) {
    // Citation file was found and license was found
    const citationBadge = `![Citation](https://img.shields.io/badge/Citation_Added-6366f1.svg)`;
    baseTemplate += `\n\n## CITATION.cff\n\nA CITATION.cff file found in the repository.\n\n${citationBadge}`;
  } else {
    // Citation file was not found and license was not found
    const citationBadge = `![Citation](https://img.shields.io/badge/Citation_Not_Checked-fbbf24)`;
    baseTemplate += `\n\n## CITATION.cff\n\nA CITATION.cff file will be checked after a license file is added. The [FAIR-BioRS guidelines](https://fair-biors.org/docs/guidelines) suggests to include that file for providing metadata about your software and make it FAIR.\n\n${citationBadge}`;
  }

  return baseTemplate;
}

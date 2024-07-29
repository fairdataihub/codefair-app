import url from "url";
import * as cwlTsAuto from "cwl-ts-auto";
import { createId } from "../tools/index.js";
import { checkForCitation } from "../citation/index.js";
import { checkForCodeMeta } from "../codemeta/index.js";
import { checkForLicense } from "../license/index.js";
import { checkForCWLFile } from "../cwl/index.js";
import { gatherMetadata, convertMetadataForDB } from "../metadata/index.js";

const GITHUB_APP_NAME = process.env.GITHUB_APP_NAME;
const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

/**
 * * Applies the metadata template to the base template (CITATION.cff and codemeta.json)
 *
 * @param {object} subjects - The subjects to check for
 * @param {string} baseTemplate - The base template to add to
 * @param {*} db - The database
 * @param {object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 * @param {object} context - The GitHub context object
 *
 * @returns {string} - The updated base template
 */
export async function applyMetadataTemplate(
  subjects,
  baseTemplate,
  db,
  repository,
  owner,
  context,
) {
  if ((!subjects.codemeta || !subjects.citation) && subjects.license) {
    // console.log(owner, repository);
    // License was found but no codemeta.json or CITATION.cff exists
    const identifier = createId();

    let url = `${CODEFAIR_DOMAIN}/add/code-metadata/${identifier}`;

    const metadataCollection = db.collection("codeMetadata");
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
    console.log("metadata found");
    console.log(metadata);
    console.log("metadata found");

    // License, codemeta.json and CITATION.cff files were found
    const identifier = createId();

    let url = `${CODEFAIR_DOMAIN}/add/code-metadata/${identifier}`;

    const metadataCollection = db.collection("codeMetadata");
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
 * @param {*} db - The database
 * @param {object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 *
 * @returns {string} - The updated base template
 */
export async function applyLicenseTemplate(
  subjects,
  baseTemplate,
  db,
  repository,
  owner,
  context,
) {
  if (!subjects.license) {
    const identifier = createId();
    let url = `${CODEFAIR_DOMAIN}/add/license/${identifier}`;
    const licenseCollection = db.collection("licenseRequests");
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
      console.log("Existing license request: " + url);
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

    console.log("license found!");
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
    const licenseCollection = db.collection("licenseRequests");
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

export async function applyCWLTemplate(
  subjects,
  baseTemplate,
  db,
  repository,
  owner,
  context,
) {
  if (!subjects.cwl) {
    const identifier = createId();
    let url = `${CODEFAIR_DOMAIN}/add/cwl/${identifier}`;
    const cwlCollection = db.collection("cwlRequests");

    const existingCWL = await cwlCollection.findOne({
      repositoryId: repository.id,
    });

    if (!existingCWL) {
      // Entry does not exist in the db, create a new one
      const newDate = Date.now();
      await cwlCollection.insertOne({
        created_at: newDate,
        identifier,
        open: true,
        owner,
        repo: repository.name,
        repositoryId: repository.id,
      });
    } else {
      // Get the identifier of the existing cwl request
      await cwlCollection.updateOne(
        { repositoryId: repository.id },
        { $set: { updated_at: Date.now() } },
      );
      url = `${CODEFAIR_DOMAIN}/add/cwl/${existingCWL.identifier}`;
      console.log("Existing cwl request: " + url);
    }

    // no cwl file found text
    const cwlBadge = `[![CWL](https://img.shields.io/badge/Add_CWL-dc2626.svg)](${url})`;
    baseTemplate += `\n\n## CWL Standards ❌\n\nNo CWL file was found in the root of your repository. If you would like Codefair to add a cwl file, click the "Add CWL" button below to go to our interface for adding a cwl file. You can also add a cwl file yourself and Codefair will update the dashboard when it detects it on the main branch.\n\n${cwlBadge}`;
  } else {
    // Get the cwl file content
    const cwlRequest = await context.octokit.repos.getContent({
      owner,
      repo: repository.name,
    });

    for (const file of cwlRequest.data) {
      const fileSplit = file.name.split(".");
      if (fileSplit.includes("cwl")) {
        console.log("cwl file found");
        // Extract the cwl file content and place into db
        // const cwlContent = Buffer.from(file.content, "base64").toString("utf-8");

        // extract the cwl file content with the url
        const cwlContentResponse = await context.octokit.repos.getContent({
          owner,
          path: file.path,
          repo: repository.name,
        });
        const cwlContent = Buffer.from(
          cwlContentResponse.data.content,
          "base64",
        ).toString("utf-8");
        // console.log(file);
        // console.log("cwlContent");
        // console.log(cwlContent);
        // console.log("cwlContent");
        // console.log(file.download_url);

        let isValidCWL = false;
        let validationMessage = "";
        cwlTsAuto
          .loadDocumentByString(cwlContent, file.download_url)
          .then((doc) => {
            if (doc instanceof cwlTsAuto.CommandLineTool) {
              console.log(
                "This document is a CommandLineTool with baseCommand: ",
                doc.baseCommand,
              );
              isValidCWL = true;
            }
          })
          .catch((e) => {
            if (e instanceof cwlTsAuto.ValidationException) {
              console.log("validation message here");
              console.log(e.toString());
              validationMessage = e.toString();
              isValidCWL = false;
            } else {
              console.log(e);
            }
          });

        const identifier = createId();
        let url = `${CODEFAIR_DOMAIN}/add/cwl/${identifier}`;
        const cwlCollection = db.collection("cwlRequests");
        const existingCWL = await cwlCollection.findOne({
          repositoryId: repository.id,
        });

        if (!existingCWL) {
          // Entry does not exist in the db, create a new one
          const newDate = Date.now();
          await cwlCollection.insertOne({
            created_at: newDate,
            cwlContent,
            identifier,
            open: true,
            owner,
            repo: repository.name,
            repositoryId: repository.id,
            updated_at: newDate,
            validation_message: validationMessage,
          });
        } else {
          // Get the identifier of the existing cwl request
          await cwlCollection.updateOne(
            { repositoryId: repository.id },
            {
              $set: {
                cwlContent,
                updated_at: Date.now(),
                validation_message: validationMessage,
              },
            },
          );
          url = `${CODEFAIR_DOMAIN}/add/cwl/${existingCWL.identifier}`;
        }
        const cwlBadge = `[![CWL](https://img.shields.io/badge/View_CWL_Report-0ea5e9.svg)](${url})`;
        baseTemplate += `\n\n## CWL Standards ${isValidCWL ? "✔️" : "❌"}\n\n${isValidCWL ? "A valid" : "An invalid"} CWL file is found in the root of the repository.\n\n${isValidCWL ? "" : cwlBadge}`;
        break;
      }
    }
  }

  return baseTemplate;
}

/**
 * * Renders the body of the dashboard issue message
 *
 * @param {string} owner - The owner of the repository
 * @param {object} repository  - The repository
 * @param {*} db  - The database
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
  db,
  emptyRepo,
  prTitle = "",
  prLink = "",
  commits = [],
) {
  if (emptyRepo) {
    console.log("emtpy repo and returning base");
    return `# Check the FAIRness of your software\n\nTThis issue is your repository's dashboard for all things FAIR. Keep it open as making and keeping software FAIR is a continuous process that evolves along with the software. You can read the [documentation](https://docs.codefair.io/docs/dashboard.html) to learn more.\n\n> [!WARNING]\n> Currently your repository is empty and will not be checked until content is detected within your repository.\n\n## LICENSE\n\nTo make your software reusable a license file is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). Codefair will check for a license file after you add content to your repository.\n\n![License](https://img.shields.io/badge/License_Not_Checked-fbbf24)\n\n## Metadata\n\nTo make your software FAIR a CITATION.cff and codemetada.json metadata files are expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org/docs/guidelines). Codefair will check for these files after a license file is detected.\n\n![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`;
  }

  let license = await checkForLicense(context, owner, repository.name);
  let citation = await checkForCitation(context, owner, repository.name);
  let codemeta = await checkForCodeMeta(context, owner, repository.name);
  let cwl = await checkForCWLFile(context, owner, repository.name);

  // Check if any of the commits added a LICENSE, CITATION, or codemeta file
  if (commits.length > 0 && commits?.added?.length > 0) {
    for (let i = 0; i < commits.length; i++) {
      for (let j = 0; i < commits.added.length; j++) {
        if (commits[i].added[j] === "LICENSE") {
          console.log("LICENSE file added with this push");
          license = true;
          continue;
        }
        if (commits[i].added[j] === "CITATION.cff") {
          console.log("CITATION.cff file added with this push");
          citation = true;
          continue;
        }
        if (commits[i].added[j] === "codemeta.json") {
          console.log("codemeta.json file added with this push");
          codemeta = true;
          continue;
        }
        const fileSplit = commits[i].added[j].split(".");
        if (fileSplit.includes("cwl")) {
          console.log("cwl file detected");
          cwl = true;
          continue;
        }
      }
    }
  }

  const subjects = {
    citation,
    codemeta,
    cwl,
    license,
  };

  let baseTemplate = `# Check the FAIRness of your software\n\nThis issue is your repository's dashboard for all things FAIR. Keep it open as making and keeping software FAIR is a continuous process that evolves along with the software. You can read the [documentation](https://docs.codefair.io/docs/dashboard.html) to learn more.\n\n`;

  baseTemplate = await applyLicenseTemplate(
    subjects,
    baseTemplate,
    db,
    repository,
    owner,
    context,
  );

  // If License PR is open, add the PR number to the dashboard
  console.log(prTitle);
  if (prTitle === "feat: ✨ LICENSE file added") {
    baseTemplate += `\n\nA pull request for the LICENSE file is open. You can view the pull request:\n\n[![License](https://img.shields.io/badge/View_PR-6366f1.svg)](${prLink})`;
  }

  baseTemplate = await applyMetadataTemplate(
    subjects,
    baseTemplate,
    db,
    repository,
    owner,
    context,
  );

  if (prTitle === "feat: ✨ metadata files added") {
    baseTemplate += `\n\nA pull request for the metadata files is open. You can view the pull request:\n\n[![Metadata](https://img.shields.io/badge/View_PR-6366f1.svg)](${prLink})`;
  }

  baseTemplate = await applyCWLTemplate(
    subjects,
    baseTemplate,
    db,
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
export async function createIssue(context, owner, repo, title, body) {
  // If issue has been created, create one
  console.log("gathering issues");
  const issue = await context.octokit.issues.listForRepo({
    title,
    creator: `${GITHUB_APP_NAME}[bot]`,
    owner,
    repo,
    state: "open",
  });

  if (issue.data.length > 0) {
    // iterate through issues to see if there is an issue with the same title
    let noIssue = false;
    let issueNumber;
    for (let i = 0; i < issue.data.length; i++) {
      console.log(issue.data[i].title);
      if (issue.data[i].title === title) {
        noIssue = true;
        issueNumber = issue.data[i].number;
        break;
      }
    }

    if (!noIssue) {
      console.log("Creating an issue since no open issue was found");
      // Issue has not been created so we create one
      await context.octokit.issues.create({
        title,
        body,
        owner,
        repo,
      });
    } else {
      // Update the issue with the new body
      console.log("++++++++++++++++");
      console.log(issue.data);
      // console.log(issue);
      console.log("Updating existing issue: " + issueNumber);
      await context.octokit.issues.update({
        title,
        body,
        issue_number: issueNumber,
        owner,
        repo,
      });
    }
  }

  if (issue.data.length === 0) {
    // Issue has not been created so we create one
    await context.octokit.issues.create({
      title,
      body,
      owner,
      repo,
    });
  }
}

// Functions below are temporarily being unused (metadata section was combined. Seperate sections might come back though)

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

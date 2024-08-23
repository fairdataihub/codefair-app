import { consola } from "consola";
import {
  applyGitHubIssueToDatabase,
  createId,
  applyLastModifiedTemplate,
} from "../tools/index.js";
import { applyCWLTemplate } from "../cwl/index.js";
import { applyMetadataTemplate } from "../metadata/index.js";
import { applyLicenseTemplate } from "../license/index.js";

const { GITHUB_APP_NAME } = process.env;
const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

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
  consola.info("Is repository empty?", emptyRepo);
  if (emptyRepo) {
    consola.success(
      "Applying empty repo template for repository:",
      repository.name,
    );
    let emptyTemplate = `# Check the FAIRness of your software\n\nThis issue is your repository's dashboard for all things FAIR. Keep it open as making and keeping software FAIR is a continuous process that evolves along with the software. You can read the [documentation](https://docs.codefair.io/docs/dashboard.html) to learn more.\n\n> [!WARNING]\n> Currently your repository is empty and will not be checked until content is detected within your repository.\n\n## LICENSE\n\nTo make your software reusable a license file is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). Codefair will check for a license file after you add content to your repository.\n\n![License](https://img.shields.io/badge/License_Not_Checked-fbbf24)\n\n## Metadata\n\nTo make your software FAIR a CITATION.cff and codemeta.json metadata files are expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org/docs/guidelines). Codefair will check for these files after a license file is detected.\n\n![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`;

    emptyTemplate = applyLastModifiedTemplate(emptyTemplate);

    return emptyTemplate;
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

  baseTemplate = applyLastModifiedTemplate(baseTemplate);

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
      consola.info("Creating an issue since no open issue was found");
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
      consola.info("Updating existing issue: " + issueNumber);
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

    consola.info("Creating an issue since none exist");

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

    let badgeURL = `${CODEFAIR_DOMAIN}/add/codemeta/${identifier}`;

    const codemetaCollection = db.collection("codeMetadata");
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
      badgeURL = `${CODEFAIR_DOMAIN}/add/codemeta/${existingCodemeta.identifier}`;
    }

    const codemetaBadge = `[![Citation](https://img.shields.io/badge/Add_Codemeta-dc2626.svg)](${badgeURL})`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file was not found in the repository. To make your software reusable a codemetada.json is expected at the root level of your repository.\n\n${codemetaBadge}`;
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
      badgeURL = `${CODEFAIR_DOMAIN}/add/license/${existingLicense.identifier}`;
    }
    const codemetaBadge = `[![Citation](https://img.shields.io/badge/Edit_Codemeta-dc2626.svg)](${badgeURL})`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file found in the repository.\n\n${codemetaBadge}`;
  } else {
    // codemeta and license does not exist
    const codemetaBadge = `![CodeMeta](https://img.shields.io/badge/Codemeta_Not_Checked-fbbf24)`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file will be checked after a license file is added. To make your software reusable a codemetada.json is expected at the root level of your repository.\n\n${codemetaBadge}`;
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

    let badgeURL = `${CODEFAIR_DOMAIN}/add/citation/${identifier}`;
    const citationCollection = db.collection("citationRequests");
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
      badgeURL = `${CODEFAIR_DOMAIN}/add/citation/${existingCitation.identifier}`;
    }

    const citationBadge = `[![Citation](https://img.shields.io/badge/Add_Citation-dc2626.svg)](${badgeURL})`;
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

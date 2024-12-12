import { consola } from "consola";
import { logwatch } from "../logwatch.js";
import {
  applyGitHubIssueToDatabase,
  applyLastModifiedTemplate,
} from "../tools/index.js";
import { applyCWLTemplate } from "../../cwl/index.js";
import { applyMetadataTemplate } from "../../metadata/index.js";
import { applyLicenseTemplate } from "../../license/index.js";
import { applyArchivalTemplate } from "../../archival/index.js";
import dbInstance from "../../db.js";

const { GH_APP_NAME } = process.env;

/**
 * * Renders the body of the dashboard issue message
 *
 * @param {Object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {object} repository  - The repository metadata
 * @param {object} prInfo  - The PR information
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
  try {
    if (emptyRepo) {
      logwatch.success(
        `Applying empty repo template for repository: ${repository.name}`
      );
      let emptyTemplate = `# Check the FAIRness of your software\n\nThis issue is your repository's dashboard for all things FAIR. Keep it open as making and keeping software FAIR is a continuous process that evolves along with the software. You can read the [documentation](https://docs.codefair.io/docs/dashboard.html) to learn more.\n\n> [!WARNING]\n> Currently your repository is empty and will not be checked until content is detected within your repository.\n\n## LICENSE\n\nTo make your software reusable a license file is expected at the root level of your repository. Codefair will check for a license file after you add content to your repository.\n\n![License](https://img.shields.io/badge/License_Not_Checked-fbbf24)\n\n## Metadata\n\nTo make your software FAIR a CITATION.cff and codemeta.json metadata files are expected at the root level of your repository. Codefair will check for these files after a license file is detected.\n\n![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`;
  
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
  
    // Check if pull request url exist in db
    const prUrl = await dbInstance.licenseRequest.findUnique({
      where: { repository_id: repository.id },
    });
  
    if (prUrl?.license_id === "Custom") {
      subjects.customLicense = true;
    }
  
    // If License PR is open, add the PR number to the dashboard
    if (prUrl?.pull_request_url !== "") {
      // Verify if the PR is still open
      try {
        const pr = await context.octokit.pulls.get({
        owner,
        repo: repository.name,
        pull_number: prUrl.pull_request_url.split("/").pop(),
        });
  
        if (pr.data.state === "open") {
        baseTemplate += `\n\nA pull request for the LICENSE file is open. You can view the pull request:\n\n[![License](https://img.shields.io/badge/View_PR-6366f1.svg)](${prUrl.pull_request_url})`;
        } else {
        // If the PR is closed, remove the PR from the database
        await dbInstance.licenseRequest.update({
          where: { repository_id: repository.id },
          data: { pull_request_url: "" },
        });
        }
      } catch (error) {
        logwatch.error({message: "Error fetching pull request:", error}, true);
      }
    }
  
    baseTemplate = await applyMetadataTemplate(
      subjects,
      baseTemplate,
      repository,
      owner,
      context,
    );
  
    const metadataPrUrl = await dbInstance.codeMetadata.findUnique({
      where: { repository_id: repository.id },
    });
  
    if (metadataPrUrl?.pull_request_url) {
      try {
        const pr = await context.octokit.pulls.get({
          owner,
          repo: repository.name,
          pull_number: metadataPrUrl.pull_request_url.split("/").pop(),
        });
  
        if (pr.data.state === "open") {
          baseTemplate += `\n\nA pull request for the metadata files is open. You can view the pull request:\n\n[![Metadata](https://img.shields.io/badge/View_PR-6366f1.svg)](${metadataPrUrl.pull_request_url})`;
        } else {
          // If the PR is closed, remove the PR from the database
          await dbInstance.codeMetadata.update({
            where: { repository_id: repository.id },
            data: { pull_request_url: "" },
          });
        }
      } catch (error) {
        logwatch.error({message: "Error fetching metadata pull request:", error}, true);
      }
    }
  
    baseTemplate = await applyCWLTemplate(
      subjects,
      baseTemplate,
      repository,
      owner,
      context,
    );
  
    baseTemplate = await applyArchivalTemplate(
      baseTemplate,
      repository,
      owner,
    );
  
    baseTemplate = applyLastModifiedTemplate(baseTemplate);
  
    return baseTemplate;

  } catch (error) {
    throw new Error("Error rendering issue:", { cause: error});
  }
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
    creator: `${GH_APP_NAME}[bot]`,
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
      logwatch.info("Creating an issue since no open issue was found");
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
      logwatch.info(`Updating existing issue: ${issueNumber}`);
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

    logwatch.info("Creating an issue since none exist");

    await applyGitHubIssueToDatabase(response.data.number, repository.id);
  }
}

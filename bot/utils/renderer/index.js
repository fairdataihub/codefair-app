import { logwatch } from "../logwatch.js";
import {
  applyGitHubIssueToDatabase,
  applyLastModifiedTemplate,
} from "../tools/index.js";
import { applyCWLTemplate } from "../../compliance-checks/cwl/index.js";
import { applyMetadataTemplate } from "../../compliance-checks/metadata/index.js";
import { applyLicenseTemplate } from "../../compliance-checks/license/index.js";
import { applyArchivalTemplate } from "../../compliance-checks/archival/index.js";
import dbInstance from "../../db.js";
import { applyReadmeTemplate } from "../../compliance-checks/readme/index.js";
import { applyAdditionalChecksTemplate } from "../../compliance-checks/additional-checks/index.js";

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
  prInfo = { title: "", link: "" }
) {
  let step = "start";
  try {
    // ── EMPTY REPO ─────────────────────────────────────────────────────────────
    if (emptyRepo) {
      step = "emptyRepo";
      logwatch.success(`Applying empty-repo template`, {
        owner,
        repo: repository.name,
      });

      const emptyTemplate = applyLastModifiedTemplate(
        `# Check the FAIRness of your software\n\n` +
          `This issue is your repository's dashboard for all things FAIR. Keep it open ` +
          `as making and keeping software FAIR is a continuous process that evolves along ` +
          `with the software. You can read the [documentation](https://docs.codefair.io/docs/dashboard.html) to learn more.\n\n` +
          `> [!WARNING]\n> Currently your repository is empty and will not be checked until content is detected within your repository.\n\n` +
          `## LICENSE\n\n` +
          `To make your software reusable a license file is expected at the root level of your repository. ` +
          `Codefair will check for a license file after you add content to your repository.\n\n` +
          `![License](https://img.shields.io/badge/License_Not_Checked-fbbf24)\n\n` +
          `## Metadata\n\n` +
          `To make your software FAIR a CITATION.cff and codemeta.json metadata files are expected at the root level of your repository. ` +
          `Codefair will check for these files after a license file is detected.\n\n` +
          `![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`
      );

      logwatch.success(`Empty-repo template ready`, {
        owner,
        repo: repository.name,
      });
      return emptyTemplate;
    }

    // ── BASE TEMPLATE
    let baseTemplate =
      `# Check the FAIRness of your software\n\n` +
      `This issue is your repository's dashboard for all things FAIR. Keep it open as making ` +
      `and keeping software FAIR is a continuous process that evolves along with the software. ` +
      `You can read the [documentation](https://docs.codefair.io/docs/dashboard.html) to learn more.\n\n`;

    // ── README
    step = "applyReadme";
    baseTemplate = await applyReadmeTemplate(
      owner,
      repository,
      subjects,
      baseTemplate
    );
    logwatch.info(`README template applied`, { owner, repo: repository.name });

    // ── LICENSE
    step = "applyLicense";
    baseTemplate = await applyLicenseTemplate(
      subjects,
      baseTemplate,
      repository,
      owner,
      context
    );
    logwatch.info(`License template applied`, { owner, repo: repository.name });

    // ── LICENSE PR CHECK
    step = "licensePRCheck";
    const prUrl = await dbInstance.licenseRequest.findUnique({
      where: { repository_id: repository.id },
    });

    if (prUrl?.pull_request_url) {
      logwatch.info(`Verifying License PR`, {
        owner,
        repo: repository.name,
        url: prUrl.pull_request_url,
      });
      const pull_number = prUrl.pull_request_url.split("/").pop();
      const pr = await context.octokit.pulls.get({
        owner,
        repo: repository.name,
        pull_number,
      });
      if (pr.data.state === "open") {
        baseTemplate +=
          `\n\nA pull request for the LICENSE is open:\n\n` +
          `[![License](https://img.shields.io/badge/View_PR-6366f1.svg)](${prUrl.pull_request_url})\n\n`;
      } else {
        await dbInstance.licenseRequest.update({
          where: { repository_id: repository.id },
          data: { pull_request_url: "" },
        });
        logwatch.info(`Cleared stale License PR URL`, {
          owner,
          repo: repository.name,
        });
      }
    }

    // ── METADATA
    step = "applyMetadata";
    baseTemplate = await applyMetadataTemplate(
      subjects,
      baseTemplate,
      repository,
      owner,
      context
    );
    logwatch.info(`Metadata template applied`, {
      owner,
      repo: repository.name,
    });

    // ── METADATA PR CHECK
    step = "metadataPRCheck";
    const metadataPr = await dbInstance.codeMetadata.findUnique({
      where: { repository_id: repository.id },
    });

    if (metadataPr?.pull_request_url) {
      logwatch.info(`Verifying Metadata PR`, {
        owner,
        repo: repository.name,
        url: metadataPr.pull_request_url,
      });
      const pull_number = metadataPr.pull_request_url.split("/").pop();
      const pr = await context.octokit.pulls.get({
        owner,
        repo: repository.name,
        pull_number,
      });
      if (pr.data.state === "open") {
        baseTemplate +=
          `\n\nA pull request for metadata is open:\n\n` +
          `[![Metadata](https://img.shields.io/badge/View_PR-6366f1.svg)](${metadataPr.pull_request_url})`;
      } else {
        await dbInstance.codeMetadata.update({
          where: { repository_id: repository.id },
          data: { pull_request_url: "" },
        });
        logwatch.info(`Cleared stale Metadata PR URL`, {
          owner,
          repo: repository.name,
        });
      }
    }

    // ── CWL
    step = "applyCWL";
    baseTemplate = await applyCWLTemplate(
      subjects,
      baseTemplate,
      repository,
      owner,
      context
    );
    logwatch.info(`CWL template applied`, { owner, repo: repository.name });

    // ── ARCHIVAL
    step = "applyArchival";
    baseTemplate = await applyArchivalTemplate(
      context,
      baseTemplate,
      repository,
      owner,
      subjects
    );
    logwatch.info(`Archival template applied`, {
      owner,
      repo: repository.name,
    });

    step = "additionalChecks";
    baseTemplate = await applyAdditionalChecksTemplate(
      subjects,
      baseTemplate,
      repository,
      owner,
      context
    );
    logwatch.info(`Additional checks template applied`, {
      owner,
      repo: repository.name,
    });

    // ── LAST MODIFIED
    step = "applyLastModified";
    baseTemplate = applyLastModifiedTemplate(baseTemplate);
    logwatch.info(`Last-Modified template applied`, {
      owner,
      repo: repository.name,
    });

    logwatch.success(`renderIssues complete`, { owner, repo: repository.name });
    return baseTemplate;
  } catch (err) {
    logwatch.error(
      {
        message: `renderIssues failed at step "${step}"`,
        owner,
        repo: repository.name,
        error: {
          message: err.message,
          cause: err.cause?.message,
          stack: err.stack,
        },
      },
      true
    );
    logwatch.error(err);
    throw err;
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
    state: "all",
  });

  if (issue.data.length > 0) {
    // If issue has been closed, do nothing
    // check installation table in db to see if issue is closed
    const installation = await dbInstance.installation.findUnique({
      where: { id: repository.id },
    });
    if (installation.disabled) {
      logwatch.info("Repository is disabled, not creating or updating issue.");
      console.log("Repository is disabled, not creating or updating issue.");
      return;
    }
    const openIssues = issue.data.filter((item) => item.state === "open");
    if (openIssues.length === 0) {
      logwatch.info("No open issues found, and the existing issue is closed.");
      console.log("No open issues found, and the existing issue is closed.");
      return;
    }
    // iterate through issues to see if there is an issue with the same title
    let noIssue = false;
    let issueNumber;
    const existingIssue = issue.data.find((item) => item.title === title);
    if (existingIssue) {
      noIssue = true;
      issueNumber = existingIssue.number;
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
  } else {
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

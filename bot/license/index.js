/**
 * @fileoverview This file contains utility functions for the license bot
 */
import { consola } from "consola";
import dbInstance from "../db.js";
import { createId } from "../utils/tools/index.js";

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

/**
 * * Check if a license is found in the repository
 *
 * @param {object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The name of the repository
 * @returns {boolean} - Returns true if a license is found in the repository, false otherwise
 */
export async function checkForLicense(context, owner, repo) {
  try {
    await context.octokit.rest.licenses.getForRepo({
      owner,
      repo,
    });

    consola.success("License found in the repository!");
    return true;
  } catch (error) {
    consola.warn("No license found in the repository");
    // Errors when no License is found in the repo
    return false;
  }
}

/**
 * * Create a new license file in the repository
 *
 * @param {object1} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The name of the repository
 * @param {string} license - The license identifier
 */
export async function createLicense(context, owner, repo, license) {
  // Verify there is no PR open already for the LICENSE file
  const openPR = await context.octokit.pulls.list({
    owner,
    repo,
    state: "open",
  });

  let prExists = false;

  for (const pr of openPR.data) {
    if (pr.title === "feat: ✨ LICENSE file added") {
      prExists = true;
    }
  }

  if (prExists) {
    await context.octokit.issues.createComment({
      body: `A pull request for the LICENSE file already exists here: ${openPR.data[0].html_url}`,
      issue_number: context.payload.issue.number,
      owner,
      repo,
    });

    // // comment on pull request to resolve issue
    // await context.octokit.issues.createComment({
    //   repo,
    //   owner,
    //   issue_number: openPR.data[0].number,
    //   body: `Resolves #${context.payload.issue.number}`,
    // });
    return;
  }

  // Create a new file with the license parameter (use axios to get the license from the licenses.json file)
  // Create a new branch with the license file and open a PR
  const licenseRequest = licensesAvail.find(
    (item) => item.licenseId === license,
  );
  if (licenseRequest) {
    try {
      const response = await axios.get(licenseRequest.detailsUrl);
      const responseData = response.data;

      // Create a new file
      const branch = `license-${Math.floor(Math.random() * 9999)}`;

      let defaultBranch;
      let defaultBranchName;

      try {
        defaultBranch = await context.octokit.repos.getBranch({
          branch: context.payload.repository.default_branch,
          owner,
          repo,
        });
        defaultBranchName = defaultBranch.data.name;
      } catch (error) {
        consola.error("Error getting default branch:", error);
        return;
      }

      // Create a new branch base off the default branch
      consola.info("Creating branch...");
      await context.octokit.git.createRef({
        owner,
        ref: `refs/heads/${branch}`,
        repo,
        sha: defaultBranch.data.commit.sha,
      });

      // Create a new file
      consola.info("Creating file...");
      await context.octokit.repos.createOrUpdateFileContents({
        branch,
        content: Buffer.from(responseData.licenseText).toString("base64"),
        message: `feat: ✨ add LICENSE file with ${license} license terms`,
        owner,
        path: "LICENSE",
        repo,
      });

      // Create a PR from that branch with the commit of our added file
      consola.info("Creating PR...");
      await context.octokit.pulls.create({
        title: "feat: ✨ LICENSE file added",
        base: defaultBranchName,
        body: `Resolves #${context.payload.issue.number}`,
        head: branch,
        maintainer_can_modify: true, // Allows maintainers to edit your app's PR
        owner,
        repo,
      });

      // Comment on issue to notify user that license has been added
      consola.info("Commenting on issue...");
      await context.octokit.issues.createComment({
        body: `A LICENSE file with ${license} license terms has been added to a new branch and a pull request is awaiting approval. I will close this issue automatically once the pull request is approved.`,
        issue_number: context.payload.issue.number,
        owner,
        repo,
      });
    } catch (error) {
      consola.error("Error fetching license file:", error);
    }
  } else {
    // License not found, comment on issue to notify user
    await context.octokit.issues.createComment({
      body: `The license identifier “${license}” was not found in the SPDX License List. Please reply with a valid license identifier.`,
      issue_number: context.payload.issue.number,
      owner,
      repo,
    });
  }
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
  const identifier = createId();
  let badgeURL = `${CODEFAIR_DOMAIN}/add/license/${identifier}`;
  const existingLicense = await dbInstance.licenseRequest.findUnique({
    where: { repository_id: repository.id },
  });
  let licenseId = null;
  let licenseContent = "";
  let licenseContentEmpty = false;

  if (subjects.license) {
    // Get the license identifier
    const licenseRequest = await context.octokit.rest.licenses.getForRepo({
      owner,
      repo: repository.name,
    });

    licenseId = licenseRequest.data.license.spdx_id;
    licenseContent = Buffer.from(
      licenseRequest.data.content,
      "base64",
    ).toString("utf-8");

    if (
      licenseRequest.data.license.spdx_id === "no-license" ||
      licenseRequest.data.license.spdx_id === "NOASSERTION"
    ) {
      consola.info("Resetting license id and content back to null");
      licenseId = null;
      licenseContent = "";
      licenseContentEmpty = true;
    }
  }

  if (existingLicense) {
    consola.info("Updating existing license request...");
    badgeURL = `${CODEFAIR_DOMAIN}/add/license/${existingLicense.identifier}`;
    await dbInstance.licenseRequest.update({
      data: {
        contains_license: subjects.license,
        license_status:
        licenseContentEmpty
            ? "invalid"
            : "valid",
        license_id: licenseId,
        license_content: licenseContent,
      },
      where: { repository_id: repository.id },
    });
  } else {
    consola.info("Creating new license request...");
    await dbInstance.licenseRequest.create({
      data: {
        contains_license: subjects.license,
        license_status: licenseContentEmpty ? "invalid" : "valid",
        license_id: licenseId,
        license_content: licenseContent,
        identifier,
        repository: {
          connect: {
            id: repository.id,
          },
        },
      },
    });
  }

  const licenseBadge = `[![License](https://img.shields.io/badge/${subjects.license ? "Edit_License-0ea5e9" : "Add_License-dc2626"}.svg)](${badgeURL})`;

  if (subjects.license) {
    baseTemplate += `## LICENSE ✔️\n\nA LICENSE file is found at the root level of the repository.\n\n${licenseBadge}`;
  } else {
    baseTemplate += `## LICENSE ❌\n\nTo make your software reusable a license file is expected at the root level of your repository. If you would like Codefair to add a license file, click the "Add license" button below to go to our interface for selecting and adding a license. You can also add a license file yourself and Codefair will update the the dashboard when it detects it on the main branch.\n\n${licenseBadge}`;
  }

  return baseTemplate;
}

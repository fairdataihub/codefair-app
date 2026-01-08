/**
 * @fileoverview This file contains utility functions for the license bot
 */
import { logwatch } from "../../utils/logwatch.js";
import dbInstance from "../../db.js";
import { createId } from "../../utils/tools/index.js";
import { checkForFile } from "../../utils/tools/index.js";

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

/**
 * * Check if a license is found in the repository
 *
 * @param {object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {string} repoName - The name of the repository
 * @returns {boolean} - Returns true if a license is found in the repository, false otherwise
 */
export async function checkForLicense(context, owner, repoName) {
  const licenseFilesTypes = [
    "LICENSE",
    "LICENSE.md",
    "LICENSE.txt",
  ];

  for (const filePath of licenseFilesTypes) {
    const file = await checkForFile(context, owner, repoName, filePath);
    if (file) {
      // Get the actual file content from the repository
      const fileContent = await context.octokit.rest.repos.getContent({
        owner,
        repo: repoName,
        path: filePath,
      });

      const contentData = Buffer.from(
        fileContent.data.content,
        "base64"
      ).toString("utf-8");

      // Try to get the detected license information for the repository
      let spdxId = null;
      try {
        const repoLicense = await context.octokit.rest.licenses.getForRepo({
          owner,
          repo: repoName,
        });
        spdxId = repoLicense.data?.license?.spdx_id || null;
      } catch (error) {
        logwatch.warn(`Could not detect license SPDX ID: ${error.message}`);
      }

      return {
        status: true,
        path: filePath,
        content: contentData,
        spdx_id: spdxId,
      };
    }
  }
  return {
    path: "No LICENSE file found",
    status: false,
    content: "",
    spdx_id: null,
  };
}

export function validateLicense(license, existingLicense) {
  let licenseId = license.spdx_id;
  let licenseContent = license.content;
  let licenseContentEmpty = license.content === "" ? true : false;

  // Check for specific license conditions
  if (licenseId === "no-license" || !licenseId) {
    logwatch.info(`No license or 'no-license' found`);
    licenseId = null;
    licenseContent = "";
    licenseContentEmpty = true;
  }

  if (licenseId === "NOASSERTION") {
    if (licenseContentEmpty) {
      // No assertion and no content indicates no valid license
      logwatch.info(`No assertion ID with no content provided`);
      licenseId = null;
    } else {
      // Custom license with content provided
      licenseContentEmpty = false;
      if (existingLicense?.license_content.trim() !== licenseContent.trim()) {
        licenseId = "Custom"; // New custom license
        logwatch.info(`Custom license with new content provided`);
      } else if (existingLicense?.license_id) {
        licenseId = existingLicense.license_id; // Use existing custom license ID
        logwatch.info("Custom license with existing content provided");
      }
    }
  }

  return { licenseId, licenseContent, licenseContentEmpty };
}

export async function updateLicenseDatabase(repository, license) {
  let licenseContentEmpty = license.content === "" ? true : false;
  let licenseId = license.spdx_id;
  let licenseContent = license.content;

  // Update or create the license entry in the database
  let existingLicense = await dbInstance.licenseRequest.findUnique({
    where: { repository_id: repository.id },
  });
  if (existingLicense) {
    logwatch.info(
      `Updating existing license entry for repo: ${repository.name} (ID: ${repository.id})`
    );

    // If license exists, validate it
    if (license.status) {
      ({ licenseId, licenseContent, licenseContentEmpty } = validateLicense(
        license,
        existingLicense
      ));

      logwatch.success({
        message: `License validation complete`,
        licenseId,
        licenseContent,
        licenseContentEmpty,
        repo: `${repository.name} (ID: ${repository.id})`,
      });
    }
    await dbInstance.licenseRequest.update({
      data: {
        contains_license: license.status,
        license_status: licenseContentEmpty ? "invalid" : "valid",
        license_id: licenseId,
        license_content: licenseContent,
        custom_license_title:
          licenseId === "Custom"
            ? licenseId
            : existingLicense.custom_license_title,
      },
      where: { repository_id: repository.id },
    });
  } else {
    logwatch.info(
      `Creating new license entry for repo: ${repository.name} (ID: ${repository.id})`
    );
    existingLicense = await dbInstance.licenseRequest.create({
      data: {
        identifier: createId(),
        contains_license: license.status,
        license_status: licenseContentEmpty ? "invalid" : "valid",
        license_id: licenseId,
        license_content: licenseContent,
        custom_license_title: licenseId === "Custom" ? licenseId : "",
        repository: {
          connect: {
            id: repository.id,
          },
        },
      },
    });
  }
  return existingLicense;
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
  context
) {
  const badgeURL = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/license`;
  const licenseBadge = `[![License](https://img.shields.io/badge/${subjects.license.status ? "Edit_License-0ea5e9" : "Add_License-dc2626"}.svg)](${badgeURL})`;

  const existingLicense = await updateLicenseDatabase(
    repository,
    subjects.license
  );
  let licenseId = existingLicense.license_id;
  const customTitle = existingLicense.custom_license_title || "";

  if (subjects.license.status && licenseId && licenseId !== "Custom") {
    baseTemplate += `## LICENSE ✔️\n\nA \`LICENSE\` file is found at the root level of the repository.\n\n${licenseBadge}\n\n`;
  } else if (
    subjects.license.status &&
    licenseId === "Custom" &&
    customTitle === ""
  ) {
    baseTemplate += `## LICENSE ❗\n\nA custom \`LICENSE\` file has been found at the root level of this repository.\n > [!NOTE]\n> While using a custom license is normally acceptable for Zenodo, please note that Zenodo's API currently cannot handle custom licenses. If you plan to make a FAIR release, you will be required to select a license from the SPDX license list to ensure proper archival and compliance.\n\nClick the "Edit license" button below to provide a license title or to select a new license.\n\n${licenseBadge}\n\n`;
  } else if (
    subjects.license.status &&
    licenseId === "Custom" &&
    customTitle !== ""
  ) {
    baseTemplate += `## LICENSE ✔️\n\nA custom \`LICENSE\` file titled as **${customTitle}**, has been found at the root level of this repository. If you would like to update the title or change license, click the "Edit license" button below.\n\n${licenseBadge}\n\n`;
  } else {
    baseTemplate += `## LICENSE ❌\n\nTo make your software reusable, a \`LICENSE\` file is expected at the root level of your repository.\nIf you would like Codefair to add a license file, click the "Add license" button below to go to our interface for selecting and adding a license. You can also add a license file yourself, and Codefair will update the dashboard when it detects it on the main branch.\n\n${licenseBadge}\n\n`;
  }

  return baseTemplate;
}

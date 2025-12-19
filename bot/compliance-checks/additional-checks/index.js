import prisma from "../../db.js";
import { checkForFile } from "../../utils/tools/index.js";
import { createId } from "../../utils/tools/index.js";
const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const db = prisma;

/**
 * * Check if a Code of conduct file exists (CODE_OF_CONDUCT.md, CODE_OF_CONDUCT.txt, or CODE_OF_CONDUCT)
 * @param {Object} context - The context of the GitHub Event
 * @param {String} owner - The owner of the repository
 * @param {String} repoName - The name of the repository
 * @returns {Boolean} - True if a CODE_OF_CONDUCT file exists, false otherwise
 */
export async function checkForCodeofConduct(context, owner, repoName) {
  const cofcFilesTypes = [
    "CODE_OF_CONDUCT.md",
    "CODE_OF_CONDUCT.txt",
    "CODE_OF_CONDUCT",
    "docs/CODE_OF_CONDUCT.md",
    "docs/CODE_OF_CONDUCT.txt",
    "docs/CODE_OF_CONDUCT",
    ".github/CODE_OF_CONDUCT.md",
    ".github/CODE_OF_CONDUCT.txt",
    ".github/CODE_OF_CONDUCT",
  ];

  for (const filePath of cofcFilesTypes) {
    const cofc = await checkForFile(context, owner, repoName, filePath);
    if (cofc) {
      const content = await context.octokit.repos.getContent({
        owner,
        repo: repoName,
        path: filePath,
      });
      const contentData = Buffer.from(content.data.content, "base64").toString(
        "utf-8"
      );

      return {
        status: true,
        path: filePath,
        content: contentData,
      };
    }
  }
  return {
    path: "No Code of Conduct file found",
    status: false,
    content: "",
  };
}

/**
 * * Check if a CONTRIBUTING file exists (CONTRIBUTING.md)
 * @param {Object} context - The context of the GitHub Event
 * @param {String} owner - The owner of the repository
 * @param {String} repoName - The name of the repository
 * @returns {Boolean} - True if a CONTRIBUTING file exists, false otherwise
 */
export async function checkForContributingFile(context, owner, repoName) {
  const contributingFilesTypes = [
    "CONTRIBUTING.md",
    "CONTRIBUTING.txt",
    "CONTRIBUTING",
    "docs/CONTRIBUTING.md",
    "docs/CONTRIBUTING.txt",
    "docs/CONTRIBUTING",
    ".github/CONTRIBUTING.md",
    ".github/CONTRIBUTING.txt",
    ".github/CONTRIBUTING",
  ];

  for (const filePath of contributingFilesTypes) {
    const contrib = await checkForFile(context, owner, repoName, filePath);
    if (contrib) {
      const content = await context.octokit.repos.getContent({
        owner,
        repo: repoName,
        path: filePath,
      });
      const contentData = Buffer.from(content.data.content, "base64").toString(
        "utf-8"
      );

      return {
        status: true,
        path: filePath,
        content: contentData,
      };
    }
  }
  return {
    path: "No Contributing file found",
    status: false,
    content: "",
  };
}

export async function applyAdditionalChecksTemplate(
  subjects,
  template,
  repository,
  owner,
  context
) {
  // 1) Prepare identifier and badge URL
  let contribIdentifier, cofcIdentifier, contribBadgeUrl, cofcBadgeUrl;

  try {
    contribIdentifier = createId();
    cofcIdentifier = createId();
    contribBadgeUrl = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/contributing`;
    cofcBadgeUrl = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/code-of-conduct`;
  } catch (error) {
    throw new Error(
      `Failed to initialize ADDITIONAL CHECKS template parameters: ${error.message}`,
      { cause: error }
    );
  }

  // 2) Upsert data to contributingValidation and codeOfConductValidation tables
  try {
    const existingContrib = await db.contributingValidation.findUnique({
      where: { repository_id: repository.id },
    });
    const existingCofc = await db.codeofConductValidation.findUnique({
      where: { repository_id: repository.id },
    });

    const upsertContribData = {
      contains_contrib: subjects.contributing.status,
      contrib_content: subjects.contributing.content,
      contrib_path: subjects.contributing.path,
    };
    const upsertCofcData = {
      contains_code: subjects.cofc.status,
      code_content: subjects.cofc.content,
      code_path: subjects.cofc.path,
    };

    if (existingContrib) {
      await db.contributingValidation.update({
        where: { id: existingContrib.id },
        data: upsertContribData,
      });
    } else {
      await db.contributingValidation.create({
        data: {
          identifier: contribIdentifier,
          ...upsertContribData,
          repository: { connect: { id: repository.id } },
        },
      });
    }

    if (existingCofc) {
      await db.codeofConductValidation.update({
        where: { id: existingCofc.id },
        data: upsertCofcData,
      });
    } else {
      await db.codeofConductValidation.create({
        data: {
          identifier: cofcIdentifier,
          ...upsertCofcData,
          repository: { connect: { id: repository.id } },
        },
      });
    }
  } catch (error) {
    throw new Error(
      `Database error in applyAdditionalChecksTemplate: ${error.message}`,
      { cause: error }
    );
  }

  // 3) Prepare the template data
  try {
    const additionalSubjects = [
      {
        label: "CONTRIBUTING.md",
        url: contribBadgeUrl,
        status: subjects.contributing.status,
        reason:
          "This file helps communicate contribution processes and gives contributors clear guidelines placed at the repo root (or in docs/ or .github/), saving time and reducing rework. It surfaces automatically on pull requests, issues, and the repository's Contribute page to guide contributors at every step.",
        badge: `${subjects.contributing.status ? "Edit" : "Create"}_CONTRIBUTING-${
          subjects.contributing.status ? "0ea5e9" : "dc2626"
        }`,
      },
      {
        label: "CODE_OF_CONDUCT.md",
        url: cofcBadgeUrl,
        status: subjects.cofc.status,
        reason:
          "Defines clear standards for respectful engagement and shows a welcoming, inclusive community by outlining expectations and procedures for handling abuse. When placed at the repo root (or in docs/ or .github/), CODE_OF_CONDUCT.md surfaces in the repository's community profile and contributor pages to guide behavior at every step.",
        badge: `${subjects.cofc.status ? "Edit" : "Create"}_CODE_OF_CONDUCT-${
          subjects.cofc.status ? "0ea5e9" : "dc2626"
        }`,
      },
    ];

    const section =
      `## Additional Recommendations\n\n` +
      `Although these files are not part of the core FAIR compliance checks, ` +
      `Codefair recommends including them to improve project governance, community engagement, and contributor experience:\n\n` +
      additionalSubjects
        .map(
          ({ label, reason, url, badge, status }) =>
            `### ${label} ${status ? "✔️" : "❗"}\n\n` +
            `${reason}\n\n` +
            `[![${label}](https://img.shields.io/badge/${badge}.svg)](${url})\n`
        )
        .join("\n") +
      `\n`;

    return `${template}\n\n${section}\n\n`;
  } catch (error) {
    throw new Error(
      `Failed to prepare template data in applyAdditionalChecksTemplate: ${error.message}`,
      { cause: error }
    );
  }
}

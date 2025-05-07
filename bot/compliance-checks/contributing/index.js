import { checkForFile } from "../../utils/tools/index.js";
import dbInstance from "../../db.js";
import { createId } from "../../utils/tools/index.js";
import logwatch from "../../utils/logwatch.js";
const db = dbInstance;

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

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

export async function applyContributingTemplate(
  owner,
  repository,
  subjects,
  baseTemplate
) {
  // 1) Prepare identifier and badge URL
  let identifier, badgeURL;
  try {
    identifier = createId();
    badgeURL = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/contributing`;
  } catch (error) {
    throw new Error(
      `Failed to initialize CONTRIBUTING template parameters: ${error.message}`,
      { cause: error }
    );
  }

  // 2) Upsert the contributingValidation record
  try {
    const existing = await db.contributingValidation.findUnique({
      where: { repository_id: repository.id },
    });

    const upsertData = {
      contains_contributing: subjects.contributing.status,
      contributing_content: subjects.contributing.content,
      contributing_path: subjects.contributing.path,
      contrib_template_title: subjects.contributing.status ? "Custom" : "",
    };

    if (existing) {
      await db.contributingValidation.update({
        where: { id: existing.id },
        data: upsertData,
      });
    } else {
      await db.contributingValidation.create({
        data: {
          identifier,
          ...upsertData,
          repository: { connect: { id: repository.id } },
        },
      });
    }
  } catch (error) {
    throw new Error(
      `Database error in applyContributingTemplate: ${error.message}`,
      { cause: error }
    );
  }

  // 3) Prepare the template data
  try {
    const { status } = subjects.contributing;
    const verb = status ? "Edit" : "Create";
    const colorCode = status ? "0ea5e9" : "dc2626";
    const badgeLabel = `${verb}_CONTRIBUTING-${colorCode}`;
    const contributingBadge = `[![${verb} CONTRIBUTING](https://img.shields.io/badge/${badgeLabel}.svg)](${badgeURL})`;

    const header = status ? "## CONTRIBUTING ✔️" : "## CONTRIBUTING ❌";
    const desc = status
      ? `A CONTRIBUTING file was found at the root level of the repository.`
      : `A CONTRIBUTING file was not found at the root of your repository. We recommend creating one to help contributors understand how to contribute to your project. We have create a template for you to edit and add to your repository. Click on the badge below to create a file with Codefair's editor.`;

    return (
      baseTemplate +
      `\n\n` +
      `${header}\n\n` +
      `${desc}\n\n` +
      `${contributingBadge}\n\n`
    );
  } catch (error) {
    throw new Error(
      `Failed to prepare template data in applyContributingTemplate: ${error.message}`,
      { cause: error }
    );
  }
}

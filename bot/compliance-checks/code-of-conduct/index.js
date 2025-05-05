import { checkForFile } from "../../utils/tools/index.js";
import dbInstance from "../../db.js";
import { createId } from "../../utils/tools/index.js";
const db = dbInstance;

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
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
        path: `${cofc.path}`,
        content: contentData,
      };
    }
  }
  return {
    path: "No Code of Conduct file found",
    status: false,
  };
}

export async function applyCodeofConductTemplate(
  owner,
  repository,
  subjects,
  baseTemplate
) {
  // 1) Prepare identifier and badge URL
  let identifier, badgeURL;
  try {
    identifier = createId();
    badgeURL = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/cof`;
  } catch (error) {
    throw new Error(
      `Failed to initialize CODE_OF_CONDUCT template parameters: ${error.message}`,
      { cause: error }
    );
  }

  // 2) Upsert the codeOfConductValidation record
  try {
    const existing = await db.codeOfConductValidation.findUnique({
      where: { repository_id: repository.id },
    });

    const upsertData = {
      contains_cof: subjects.cofc.status,
      code_content: subjects.cofc.content,
      code_path: subjects.cofc.path,
    };

    if (existing) {
      await db.codeOfConductValidation.update({
        where: { id: existing.id },
        data: upsertData,
      });
    } else {
      await db.codeOfConductValidation.create({
        data: {
          identifier,
          ...upsertData,
          repository: { connect: { id: repository.id } },
        },
      });
    }
  } catch (error) {
    throw new Error(
      `Database error in applyCodeofConductTemplate: ${error.message}`,
      {
        cause: error,
      }
    );
  }

  // 3) Prepare the template data
  try {
    const { status, path } = subjects.cof;
    const verb = status ? "Edit" : "Create";
    const colorCode = status ? "0ea5e9" : "dc2626";
    const badgeLabel = `${verb}_Code_of_Conduct-${colorCode}`;
    const cofBadge = `[![${verb} Code of Conduct](https://img.shields.io/badge/${badgeLabel}.svg)](${badgeURL})`;

    const header = status ? "## Code of Conduct ✔️" : "## Code of Conduct ❌";
    const desc = status
      ? `A \`${path}\` file was found at the within your repository.`
      : `A Code of Conduct file was not found within your .github, docs or root of your repository. The Code of Conduct file is a document that outlines the expected behavior and responsibilities of contributors to a project. It helps create a welcoming and inclusive environment for all participants. You can create one in Codefair's editor that follows the latest [Code of Conduct template](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) and add it to your repository. Click on the badge below to create a file with Codefair's editor.`;

    return (
      baseTemplate +
      `\n\n` +
      `${header}\n\n` +
      `${desc}\n\n` +
      `${cofBadge}\n\n`
    );
  } catch (error) {
    throw new Error(
      `Error constructing Code of Conduct section: ${error.message}`,
      {
        cause: error,
      }
    );
  }
}

import { checkForFile } from "../../utils/tools/index.js";
import dbInstance from "../../db.js";
import { createId } from "../../utils/tools/index.js";
const db = dbInstance;

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
/**
 * * Check if a README file exists (README.md, README.txt, or README)
 * @param {Object} context - The context of the GitHub Event
 * @param {String} owner - The owner of the repository
 * @param {String} repoName - The name of the repository
 * @returns {Boolean} - True if a README file exists, false otherwise
 */
export async function checkForReadme(context, owner, repoName) {
  const readmeFilesTypes = [
    "README.md",
    "README.txt",
    "README",
    "docs/README.md",
    "docs/README.txt",
    "docs/README",
    ".github/README.md",
    ".github/README.txt",
    ".github/README",
  ];

  for (const filePath of readmeFilesTypes) {
    const readme = await checkForFile(context, owner, repoName, filePath);
    if (readme) {
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
        path: `${readme.path}`,
        content: contentData,
      };
    }
  }
  return {
    path: "No README file found",
    status: false,
  };
}

export async function applyReadmeTemplate(
  owner,
  repository,
  subjects,
  baseTemplate
) {
  // 1) Prepare identifier and badge URL
  let identifier, badgeURL;
  try {
    identifier = createId();
    badgeURL = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/readme`;
  } catch (err) {
    throw new Error(
      `Failed to initialize README template parameters: ${err.message}`,
      { cause: err }
    );
  }

  // 2) Upsert the readmeValidation record
  try {
    const existing = await db.readmeValidation.findUnique({
      where: { repository_id: repository.id },
    });

    const upsertData = {
      contains_readme: subjects.readme.status,
      readme_content: subjects.readme.content,
      readme_path: subjects.readme.path,
    };

    if (existing) {
      await db.readmeValidation.update({
        where: { id: existing.id },
        data: upsertData,
      });
    } else {
      await db.readmeValidation.create({
        data: {
          identifier,
          ...upsertData,
          repository: { connect: { id: repository.id } },
        },
      });
    }
  } catch (err) {
    throw new Error(`Database error in applyReadmeTemplate: ${err.message}`, {
      cause: err,
    });
  }

  // 3) Build and return the updated markdown
  try {
    const { status, path } = subjects.readme;
    const verb = status ? "Edit" : "Create";
    const colorCode = status ? "0ea5e9" : "dc2626";
    const badgeLabel = `${verb}_README-${colorCode}`;
    const readmeBadge = `[![${verb} README](https://img.shields.io/badge/${badgeLabel}.svg)](${badgeURL})`;

    const header = status ? "## README ✔️" : "## README ❌";
    const desc = status
      ? `A \`${path}\` file was found at the root level of the repository.`
      : `A README file was not found at the root of your repository. The README file is a markdown file that contains information about your project. It is usually the first thing that users see when they visit your project on GitHub. Try to make it as informative and helpful as possible. Click on the badge below to create a file with Codefair's editor.`;

    return (
      baseTemplate +
      `\n\n` +
      `${header}\n\n` +
      `${desc}\n\n` +
      `${readmeBadge}\n\n`
    );
  } catch (err) {
    throw new Error(`Error constructing README section: ${err.message}`, {
      cause: err,
    });
  }
}

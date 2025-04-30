import { checkForFile } from "../../utils/tools/index.js";
import db from "../../utils/db.js";
import { createId } from "../../utils/tools/index.js";
/**
 * * Check if a README file exists (README.md, README.txt, or README)
 * @param {Object} context - The context of the GitHub Event
 * @param {String} owner - The owner of the repository
 * @param {String} repoName - The name of the repository
 * @returns {Boolean} - True if a README file exists, false otherwise
 */
export async function checkForReadme(context, owner, repoName) {
  const readmeFilesTypes = ["README.md", "README.txt", "README"];

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
  let identifier = createId();
  let badgeURL = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/edit/readme`;
  const existingReadme = await db.readmeValidation.findUnique({
    where: {
      repository_id: repository.id,
    },
  });

  if (existingReadme) {
    // Update existing entry
    await db.readmeValidation.update({
      where: {
        id: existingReadme.id,
      },
      data: {
        contains_readme: subjects.readme.status,
        readme_content: subjects.readme.content,
        readme_path: subjects.readme.path,
      },
    });
  } else {
    // Create new entry
    await db.readmeValidation.create({
      data: {
        identifier,
        contains_readme: subjects.readme.status,
        readme_content: subjects.readme.content,
        readme_path: subjects.readme.path,
        repository: {
          connect: {
            id: repository.id,
          },
        },
      },
    });
  }

  const readmeBadge = `[![Edit README](https://img.shields.io/badge/${subjects.readme.status ? "Edit_README-0ea5e9" : "Create_README-dc2626"}.svg)](${badgeURL})`;
  if (subjects.readme.status) {
    // Readme exists,
    baseTemplate += `## README ✔️\n\nA ${subjects.readme.path} file was found! Click on the badge below to use edit your file with our editor.\n\n${readmeBadge}\n\n`;
  } else {
    // Readme does not exist,
    baseTemplate += `## README ❌\n\nA README file was not found at the root of your repository. Click on the badge below to use create a file with Codefair's editor.\n\n${readmeBadge}\n\n`;
  }

  return baseTemplate;
}

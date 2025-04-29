import { checkForFile } from "../../utils/tools/index.js";
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
      return true;
    }
  }
  return false;
}

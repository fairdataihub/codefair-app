/**
 * * This file contains the functions to interact with the CWL files in the repository
 */

import * as cwlTsAuto from "cwl-ts-auto";

/**
 * * This function gets the CWL files in the repository
 * @param {Object} context - GitHub Event Context
 * @param {String} owner  - Repository owner
 * @param {String} repoName - Repository name
 * @returns {Array} - Array of CWL files in the repository
 */
export async function getCWLFiles(context, owner, repoName) {
  const cwlFiles = [];
  console.log("Checking for CWL files in the repository");

  async function searchDirectory(path) {
    try {
      const repoContent = await context.octokit.repos.getContent({
        owner,
        path,
        repo: repoName,
      });

      for (const file of repoContent.data) {
        const fileSplit = file.name.split(".");
        if (file.type === "file" && fileSplit.includes("cwl")) {
          cwlFiles.push(file);
        }
        if (file.type === "dir") {
          await searchDirectory(file.path);
        }
      }
    } catch (error) {
      console.log("Error finding CWL files throughout the repository");
      console.log(error);
      if (error.status === 404) {
        // Repository is empty
        return cwlFiles;
      }
    }
  }

  try {
    await searchDirectory("");
    return cwlFiles;
  } catch (error) {
    console.log("Error checking for CWL file");
    console.log(error);
  }
}

export async function validateCWLFile(fileContent, downloadUrl) {
  try {
    const doc = await cwlTsAuto.loadDocumentByString(fileContent, downloadUrl);
    if (doc instanceof cwlTsAuto.CommandLineTool) {
      return [true, ""];
    }
  } catch (e) {
    if (e instanceof cwlTsAuto.ValidationException) {
      const validationMessage = e.toString();
      return [false, validationMessage];
    } else {
      console.log(e);
    }
  }
}

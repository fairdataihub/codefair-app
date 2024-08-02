/**
 * * This file contains the functions to interact with the CWL files in the repository
 */

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

export async function validateCWLFile(downloadUrl) {
  try {
    const response = await fetch("https://cwl.saso.one/validate", {
      body: JSON.stringify({
        file_path: downloadUrl,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    if (!response.ok && response.status === 400) {
      const error = await response.json();
      return [false, error.error];
    }
    if (!response.ok && response.status === 500) {
      return [false, "Error validating CWL file"];
    }
    if (response.ok) {
      const data = await response.json();
      return [true, data.output];
    }
  } catch (e) {
    console.log("Error validating CWL file");
    console.log(e);
  }
}

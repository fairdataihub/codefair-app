/**
 * * This file contains the functions to interact with the CWL files in the repository
 */
import { consola } from "consola";
import {
  isRepoPrivate,
  createId,
  replaceRawGithubUrl,
} from "../utils/tools/index.js";
import dbInstance from "../db.js";

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

/**
 * * This function gets the CWL files in the repository
 * @param {Object} context - GitHub Event Context
 * @param {String} owner  - Repository owner
 * @param {String} repoName - Repository name
 * @returns {Array} - Array of CWL files in the repository
 */
export function getCWLFiles(context, owner, repoName) {
  return new Promise((resolve, reject) => {
    consola.info("Checking for CWL files in the repository...");

    const cwlFiles = [];

    const searchDirectory = async function (path) {
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
        if (error.status === 404) {
          // Repository is empty
          resolve(cwlFiles);
          return;
        }
        consola.error(
          "Error finding CWL files throughout the repository:",
          error,
        );
        reject(error);
      }
    };

    // Call the async function and handle its promise
    searchDirectory("")
      .then(() => {
        resolve(cwlFiles);
      })
      .catch(reject);
  });
}

/**
 * * This function validates the CWL file using the cwltool validator
 * @param {String} downloadUrl - The download URL of the CWL file
 * @returns {Array} - Array containing the validation status and message
 */
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
      // consola.warn("Validation error:", error.error);
      return [false, error.error];
    }
    if (!response.ok && response.status === 500) {
      consola.error("Error validating CWL file:", response);
      return [false, "Error validating CWL file"];
    }
    if (response.ok) {
      const data = await response.json();
      return [true, data.output];
    }
  } catch (e) {
    consola.error("Error validating CWL file:", e);
  }
}

/**
 *
 * @param {Object} subjects - The subjects to check for
 * @param {String} baseTemplate - The base template to add to
 * @param {Object} repository - Repository object
 * @param {String} owner - Repository owner
 * @param {Object} context - GitHub context object
 * @returns
 */
export async function applyCWLTemplate(
  subjects,
  baseTemplate,
  repository,
  owner,
  context,
) {
  const privateRepo = await isRepoPrivate(context, owner, repository.name);
  const cwlCollection = dbInstance.getDb().collection("cwlValidation");
  const identifier = createId();
  const overallSection = `\n\n## Language Specific Standards\n\nTo make your software FAIR is it important to follow language specific standards and best practices. Codefair will check below that your code complies with applicable standards,`;
  let url = `${CODEFAIR_DOMAIN}/view/cwl-validation/${identifier}`;

  // Delete file entries from db if they were removed from the repository
  if (subjects.cwl.removed_files.length > 0) {
    // Remove the files from the database
    const existingCWL = await cwlCollection.findOne({
      repositoryId: repository.id,
    });

    if (existingCWL) {
      const newFiles = existingCWL.files.filter((file) => {
        return !subjects.cwl.removed_files.includes(file.path);
      });

      const newDate = Date.now();
      await cwlCollection.updateOne(
        { repositoryId: repository.id },
        {
          $set: {
            contains_cwl_files: newFiles.length > 0,
            files: newFiles,
            updated_at: newDate,
          },
        },
      );
    }
  }

  // New/Modified CWL files were found, begin validation workflow
  consola.start("Validating new/modified CWL files for", repository.name);
  const cwlFiles = [];
  let validOverall = true;
  let tableContent = "";
  let failedCount = 0;
  const existingCWL = await cwlCollection.findOne({
    repositoryId: repository.id,
  });

  if (subjects.cwl.files.length === 0) {
    consola.warn(
      `No new/modified CWL files found in the repository, ${repository.name}`,
    );
  }

  // Validate each CWL file from list
  for (const file of subjects.cwl.files) {
    const fileSplit = file.name.split(".");

    if (fileSplit.includes("cwl")) {
      const downloadUrl =
        file?.commitId && !privateRepo
          ? file.download_url.replace("/main/", `/${file.commitId}/`)
          : file.download_url; // Replace the branch with the commit id if commit id is available and the repo is public

      const [isValidCWL, validationMessage] =
        await validateCWLFile(downloadUrl);

      if (!isValidCWL && validOverall) {
        // Overall status of CWL validations is invalid
        validOverall = false;
      }

      if (!isValidCWL) {
        failedCount += 1;
      }

      const [modifiedValidationMessage, lineNumber1, lineNumber2] =
        replaceRawGithubUrl(validationMessage, downloadUrl, file.html_url);

      // Add the line numbers to the URL if they exist
      if (lineNumber1) {
        file.html_url += `#L${lineNumber1}`;
        if (lineNumber2) {
          file.html_url += `-L${lineNumber2}`;
        }
      }

      // Create a new object for the file entry to be added to the db
      const newDate = Date.now();
      cwlFiles.push({
        href: file.html_url,
        last_modified: newDate,
        last_validated: newDate,
        path: file.path,
        validation_message: modifiedValidationMessage,
        validation_status: isValidCWL ? "valid" : "invalid",
      });

      // Apply the validation file count to the analytics collection on the db
      const analyticsCollection = dbInstance.getDb().collection("analytics");
      await analyticsCollection.updateOne(
        { repositoryId: repository.id },
        {
          $inc: { "cwlValidation.validatedFileCount": 1 },
        },
        { upsert: true },
      );

      // Add the file to the table content of the issue dashboard
      tableContent += `| ${file.path} | ${isValidCWL ? "✔️" : "❌"} |\n`;

      consola.success(
        `File: ${file.path} is ${isValidCWL ? "valid" : "invalid"}`,
      );
    }
  }

  // Entry does not exist in the db, create a new one (no old files exist, first time seeing cwl files)
  if (!existingCWL) {
    const newDate = Date.now();
    await cwlCollection.insertOne({
      contains_cwl_files: subjects.cwl.contains_cwl,
      created_at: newDate,
      files: cwlFiles,
      identifier,
      overall_status: validOverall ? "valid" : "invalid",
      owner,
      repo: repository.name,
      repositoryId: repository.id,
      updated_at: newDate,
    });

    if (!cwlFiles.length > 0) {
      consola.warn(
        `No CWL files found in the repository, ${repository.name}, skipping CWL section`,
      );
      return baseTemplate;
    }
  } else {
    // An entry exists in the db, thus possible old files exist (merge both lists)
    url = `${CODEFAIR_DOMAIN}/view/cwl-validation/${existingCWL.identifier}`;
    validOverall = true;
    const fileMap = new Map();

    // Add existing files to the map
    existingCWL.files.forEach((file) => {
      fileMap.set(file.path, file);
    });
    // Add new files to the map, replacing any existing entries with the same path
    cwlFiles.forEach((file) => {
      fileMap.set(file.path, file);
    });

    // Convert the map back to an array
    const newFiles = Array.from(fileMap.values());

    // Check if the overall status is still valid
    for (const file of newFiles) {
      if (file.overall_status === "invalid") {
        validOverall = false;
        break;
      }
    }

    await cwlCollection.updateOne(
      { repositoryId: repository.id },
      {
        $set: {
          contains_cwl_files: newFiles.length > 0,
          files: [...newFiles],
          overall_status: validOverall ? "valid" : "invalid",
          updated_at: Date.now(),
        },
      },
    );

    if (!newFiles.length > 0) {
      // All CWL files were removed from the repository
      consola.warn(
        "All CWL files were removed from:",
        existingCWL.repo,
        "skipping CWL section",
      );
      return baseTemplate;
    } else {
      // Recreate the table content to include the new and old cwl files
      consola.start(
        "Recreating the table content for the CWL section to include new and old files",
      );
      tableContent = "";
      failedCount = 0;
      newFiles.forEach((file) => {
        if (file.validation_status === "invalid") {
          failedCount += 1;
        }

        if (file.validation_status === "invalid" && validOverall) {
          validOverall = false;
        }

        tableContent += `| ${file.path} | ${file.validation_status === "valid" ? "✔️" : "❌"} |\n`;
      });
    }

    subjects.cwl.files = newFiles; // okay to replace at this stage, used to just get the length of the new and old files for the dashboard
  }

  const cwlBadge = `[![CWL](https://img.shields.io/badge/View_CWL_Report-0ea5e9.svg)](${url})`;
  baseTemplate += `${overallSection}\n\n### CWL Validations ${validOverall ? "✔️" : "❗"}\n\nCodefair has detected that you are following the Common Workflow Language (CWL) standard to describe your command line tool. Codefair ran the [cwltool validator](https://cwltool.readthedocs.io/en/latest/) and ${validOverall ? `all ***${subjects.cwl.files.length}*** CWL file(s) in your repository are valid.` : `***${failedCount}/${subjects.cwl.files.length}*** CWL file(s) in your repository are not valid.`}\n\n<details>\n<summary>Summary of the validation report</summary>\n\n| File | Validation result |\n| :---- | :----: |\n${tableContent}</details>\n\nTo view the full report of each CWL file or to rerun the validation, click the "View CWL Report" button below.\n\n${cwlBadge}`;

  consola.success("CWL template section applied");
  return baseTemplate;
}

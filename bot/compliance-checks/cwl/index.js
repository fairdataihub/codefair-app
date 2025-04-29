/**
 * * This file contains the functions to interact with the CWL files in the repository
 */
import { logwatch } from "../../utils/logwatch.js";
import {
  isRepoPrivate,
  createId,
  replaceRawGithubUrl,
} from "../../utils/tools/index.js";
import dbInstance from "../../db.js";

const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;
const { VALIDATOR_URL } = process.env;

// Recursive function to search for CWL files throughout repository directories
/**
 * * This function searches for CWL files in the given directory path of a GitHub repository.
 * @param {String} path - The path to search for CWL files
 * @param {Object} cwlObject - The CWL object collecting discovered files
 * @returns {Promise<Object>} - The updated cwlObject containing found files
 * @throws {Error} - Throws an error if the search fails
 */
async function searchRepository(path, cwlObject) {
  try {
    const repoContent = await context.octokit.repos.getContent({
      owner,
      path,
      repo: repository.name,
    });

    for (const file of repoContent.data) {
      if (file.type === "file" && file.name.endsWith(".cwl")) {
        logwatch.info({ message: "CWL file found", file: file.name }, true);
        cwlObject.files.push(file);
      }
      if (file.type === "dir") {
        await searchRepository(file.path, cwlObject);
      }
    }
    return cwlObject;
  } catch (error) {
    if (error.status === 404) {
      // Directory not found; likely an empty repository or directory, so we simply return the current object
      return cwlObject;
    }
    logwatch.error(
      {
        message: "Error searching for CWL files",
        path,
        error,
      },
      true
    );
    throw new Error(`Error searching directory "${path}": ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * This function gets the CWL files in the repository
 * @param {Object} context - GitHub Event Context
 * @param {String} owner - Repository owner
 * @param {Object} repository - Repository object
 * @returns {Promise<Object>} - An object containing CWL file details
 */
export async function getCWLFiles(context, owner, repository) {
  logwatch.info("Checking for CWL files in the repository...");

  const cwlObject = {
    contains_cwl_files: false,
    files: [],
    removed_files: [],
  };

  // Execute the directory search
  try {
    cwlObject = await searchRepository("");
  } catch (error) {
    throw new Error(
      `Failed to search repository for CWL files: ${error.message}`,
      {
        cause: error,
      }
    );
  }

  // Process the database entry for removed files if it exists
  try {
    const existingCWL = await dbInstance.cwlValidation.findUnique({
      where: { repository_id: repository.id },
    });

    // Map current file paths correctly
    const cwlFilePaths = cwlObject.files.map((file) => file.path);

    if (existingCWL && existingCWL.contains_cwl_files) {
      cwlObject.removed_files = existingCWL.files.filter((file) => {
        return !cwlFilePaths.includes(file.path);
      });
    }

    cwlObject.contains_cwl_files = cwlObject.files.length > 0;
    return cwlObject;
  } catch (error) {
    logwatch.error(
      { message: "Error retrieving CWL files from the database", error },
      true
    );
    throw new Error(`Error getting CWL files: ${error.message}`, {
      cause: error,
    });
  }
}

/**
 * Validates a CWL file using the cwltool validator.
 * @param {String} downloadUrl - The download URL of the CWL file.
 * @returns {Array} - Array containing a boolean status and a message.
 */
export async function validateCWLFile(downloadUrl) {
  try {
    logwatch.info({ message: "Starting CWL file validation", downloadUrl });
    const response = await fetch(`${VALIDATOR_URL}/validate-cwl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path: downloadUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (response.status === 400) {
        logwatch.warn({
          message: "Validation error for CWL file",
          status: response.status,
          error: errorData.output,
          downloadUrl,
        });
        return [false, errorData.output];
      } else if (response.status === 500) {
        logwatch.error(
          {
            message: "Server error during CWL validation",
            status: response.status,
            error: errorData.error,
            downloadUrl,
          },
          true
        );
        return [false, "Error validating CWL file"];
      } else {
        logwatch.error(
          {
            message: "Unexpected response status during CWL validation",
            status: response.status,
            error: errorData.error,
            downloadUrl,
          },
          true
        );
        return [false, "Unexpected error during CWL file validation"];
      }
    }

    const data = await response.json();
    logwatch.info({
      message: "CWL file validated successfully",
      output: data.output,
      downloadUrl,
    });
    return [true, data.output];
  } catch (error) {
    logwatch.error(
      { message: "Exception during CWL file validation", error, downloadUrl },
      true
    );
    return [false, "Error validating CWL file"];
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
  context
) {
  const privateRepo = await isRepoPrivate(context, owner, repository.name);
  const identifier = createId();
  const overallSection = `\n\n## Language Specific Standards\n\nTo make your software FAIR is it important to follow language specific standards and best practices. Codefair will check below that your code complies with applicable standards,`;
  let url = `${CODEFAIR_DOMAIN}/dashboard/${owner}/${repository.name}/view/cwl-validation`;

  // Delete file entries from db if they were removed from the repository
  if (subjects.cwl?.files && subjects.cwl.removed_files.length > 0) {
    // Remove the files from the database
    const existingCWL = await dbInstance.cwlValidation.findUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (existingCWL) {
      const newFiles = existingCWL.files.filter((file) => {
        return !subjects.cwl.removed_files.includes(file.path);
      });

      logwatch.info(
        `New files after removed_files filter: ${JSON.stringify(newFiles)}`
      );

      await dbInstance.cwlValidation.update({
        data: {
          contains_cwl_files: newFiles.length > 0,
          files: newFiles,
          updated_at: newDate,
        },
        where: { repository_id: repository.id },
      });
    }
  }

  // New/Modified CWL files were found, begin validation workflow
  const cwlFiles = [];
  let validOverall = true;
  let tableContent = "";
  let failedCount = 0;
  const existingCWL = await dbInstance.cwlValidation.findUnique({
    where: {
      repository_id: repository.id,
    },
  });

  if (subjects.cwl?.files && subjects.cwl.files.length === 0) {
    logwatch.warn(`No CWL files found in the repository, ${repository.name}`);

    if (existingCWL) {
      // No CWL files found in the repository, update the db
      await dbInstance.cwlValidation.update({
        data: {
          contains_cwl_files: false,
          files: [],
          overall_status: "",
        },
        where: { repository_id: repository.id },
      });
    }
    return baseTemplate;
  }

  logwatch.start("Validating CWL files for", repository.name);
  // Validate each CWL file from list\
  logwatch.info(`Validating ${JSON.stringify(subjects.cwl)} CWL files`);
  if (subjects.cwl.files.length > 0) {
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

        logwatch.info(
          `Validation message for ${file.path}: ${validationMessage}`
        );

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
        const newDate = Math.floor(Date.now() / 1000);
        cwlFiles.push({
          href: file.html_url,
          last_modified: newDate,
          last_validated: newDate,
          path: file.path,
          validation_message: modifiedValidationMessage,
          validation_status: isValidCWL ? "valid" : "invalid",
        });

        // Apply the validation file count to the analytics collection on the db
        const analyticsCollection = dbInstance.analytics;
        await analyticsCollection.upsert({
          create: {
            cwl_validated_file_count: 1, // Start count at 1 when creating
            id: repository.id, // Create a new record if it doesn't exist
          },
          update: {
            cwl_validated_file_count: {
              increment: 1,
            },
          },
          where: {
            id: repository.id,
          },
        });

        // Add the file to the table content of the issue dashboard
        tableContent += `| ${file.path} | ${isValidCWL ? "✔️" : "❌"} |\n`;

        logwatch.success(
          `File: ${file.path} is ${isValidCWL ? "valid" : "invalid"}`
        );
      }
    }
  }

  // Entry does not exist in the db, create a new one (no old files exist, first time seeing cwl files)
  if (!existingCWL) {
    await dbInstance.cwlValidation.create({
      data: {
        contains_cwl_files: subjects.cwl.contains_cwl_files,
        files: cwlFiles,
        identifier,
        overall_status: validOverall ? "valid" : "invalid",
        repository: {
          connect: {
            id: repository.id,
          },
        },
      },
    });

    if (!cwlFiles.length > 0) {
      logwatch.warn(
        `No CWL files found in the repository, ${repository.name}, skipping CWL section`
      );
      return baseTemplate;
    }
  } else {
    // An entry exists in the db, thus possible old files exist (merge both lists)
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
      if (file.validation_status === "invalid") {
        validOverall = false;
        break;
      }
    }

    await dbInstance.cwlValidation.update({
      data: {
        contains_cwl_files: newFiles.length > 0,
        files: [...newFiles],
        overall_status: validOverall ? "valid" : "invalid",
      },
      where: { repository_id: repository.id },
    });

    if (!newFiles.length > 0) {
      // All CWL files were removed from the repository
      logwatch.warn(
        `All CWL files were removed from: ${repository.name}, skipping CWL section`
      );
      return baseTemplate;
    } else {
      // Recreate the table content to include the new and old cwl files
      logwatch.start(
        "Recreating the table content for the CWL section to include new and old files"
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

  logwatch.success("CWL template section applied");
  return baseTemplate;
}

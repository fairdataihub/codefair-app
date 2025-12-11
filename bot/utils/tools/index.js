/**
 * @fileoverview Utility functions for the bot
 */
import { logwatch } from "../logwatch.js";
import { init } from "@paralleldrive/cuid2";
import human from "humanparser";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import dbInstance from "../../db.js";
import { updateMetadataDatabase } from "../../compliance-checks/metadata/index.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const IGNORED_COMMIT_MESSAGES = [
  "chore: 📝 Update CITATION.cff with Zenodo identifier",
  "chore: 📝 Update codemeta.json with Zenodo identifier",
];

const CLOSED_ISSUE_BODY = `Codefair has been disabled for this repository. If you would like to re-enable it, please reopen this issue.`;

const { GH_APP_NAME } = process.env;

/**
 * * Initialize the database connection
 * @returns {Promise<boolean>} - Returns true if the database is connected, false otherwise
 */
export async function intializeDatabase() {
  try {
    logwatch.start("Connecting to database...");
    await dbInstance;
    logwatch.success("Connected to database!");
    return true;
  } catch (error) {
    logwatch.error({ message: "Error connecting to database:", error }, true);
  }
}

/**
 * * Create a unique identifier for database entries
 */
export const createId = init({
  fingerprint: "a-custom-host-fingerprint",
  length: 10,
  random: Math.random,
});

/**
 * * Verify that the required environment variables are set
 * @param {string} varName - The name of the environment variable to check
 */
export function checkEnvVariable(varName) {
  if (!process.env[varName]) {
    logwatch.error(`Please set the ${varName} environment variable`);
    process.exit(1);
  }
}

/**
 * * Get the default branch of the repository
 * @param {object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The name of the repository
 * @returns {string} - The default branch of the repository
 */
export async function getDefaultBranch(context, owner, repositoryName) {
  try {
    const defaultBranch = await context.octokit.repos.get({
      owner,
      repo: repositoryName,
    });

    return defaultBranch.data.default_branch;
  } catch (error) {
    logwatch.error(
      { message: "Error getting the default branch:", error },
      true
    );
  }
}

/**
 * * Check if a file exists in the repository
 * @param {object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The name of the repository
 * @param {string} filePath - The path to the file to check
 *
 * @returns {Object} - Returns the file data if it exists, null otherwise
 * */
export async function checkForFile(context, owner, repoName, filePath) {
  try {
    const response = await context.octokit.repos.getContent({
      owner,
      repo: repoName,
      path: filePath,
    });
    if (response.status === 200) {
      return true;
    }
  } catch (error) {
    if (error.status === 404) {
      // file doesn’t exist
      return null;
    }
    throw error;
  }
}

/**
 * * Check if the issue already exists in the repository
 * @param {object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The name of the repository
 * @param {string} title - The title of the issue
 *
 * @returns {boolean} - Returns true if the issue already exists, false otherwise
 */
export async function verifyFirstIssue(context, owner, repo, title) {
  // If there is an issue that has been created by the bot, (either opened or closed) don't create another issue
  const issues = await context.octokit.issues.listForRepo({
    creator: `${GH_APP_NAME}[bot]`,
    owner,
    repo,
    state: "all",
  });

  if (issues.data.length > 0) {
    // iterate through issues to see if there is an issue with the same title
    let noIssue = false;
    for (let i = 0; i < issues.data.length; i++) {
      if (issues.data[i].title === title) {
        noIssue = true;
        break;
      }
    }

    if (!noIssue) {
      return false;
    } else {
      return true;
    }
  }
}

/**
 * * Close an open issue with the specified title
 * @param {object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The name of the repository
 * @param {string} title - The title of the issue to close
 */
export async function closeOpenIssue(context, owner, repo, title) {
  // Check if issue is open and close it
  const issue = await context.octokit.issues.listForRepo({
    title,
    creator: `${GH_APP_NAME}[bot]`,
    owner,
    repo,
    state: "open",
  });

  if (issue.data.length > 0) {
    // If title if issue is found, close the issue
    for (let i = 0; i < issue.data.length; i++) {
      if (issue.data[i].title === title) {
        await context.octokit.issues.update({
          issue_number: issue.data[i].number,
          owner,
          repo,
          state: "closed",
        });
      }
    }
  }
}

/**
 * * Gathers contributors of the repository and parses the user information
 * @param {object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The name of the repository
 * @param {string} fileType - The type of file to gather information for (CITATION.cff or codemeta.json)
 * @param {boolean} role - Whether to include the role of the contributor
 *
 * @returns {array} - An array of objects containing the information for the authors of the repository
 */
export async function gatherRepoAuthors(context, owner, repo, fileType) {
  logwatch.start(`Gathering authors for ${owner}/${repo} (${fileType})`);

  let contributors;
  try {
    const resp = await context.octokit.repos.listContributors({
      owner,
      repo,
    });
    contributors = resp.data;
  } catch (err) {
    logwatch.error(
      { message: "Failed to list contributors", owner, repo, err },
      true
    );
    throw new Error(
      `Could not list contributors for ${owner}/${repo}: ${err.message}`
    );
  }

  // For each contributor, try to fetch user details—but don’t fail the whole thing.
  const lookups = contributors.map((c) =>
    context.octokit.users
      .getByUsername({ username: c.login })
      .then((u) => u.data)
      .catch((err) => {
        logwatch.error(
          { message: "Failed to fetch user", login: c.login, err },
          true
        );
        return null;
      })
  );

  const users = await Promise.allSettled(lookups);
  const parsedAuthors = [];

  for (const result of users) {
    if (result.status !== "fulfilled" || !result.value) {
      continue; // skip failed lookups
    }
    const user = result.value;
    if (user.type === "Bot") {
      continue;
    }

    // Fall back to login if no name
    const displayName = user.name || user.login;
    const { firstName, lastName } = human.parseName(displayName);

    const authorObj = {
      orcid: "",
      roles: [],
      uri: "",
    };

    // affiliation differs by fileType
    if (user.company) {
      if (fileType === "citation") {
        authorObj.affiliation = user.company;
      } else {
        authorObj.affiliation = {
          name: user.company,
          "@type": "Organization",
        };
      }
    }

    if (firstName) {
      authorObj.givenName = firstName;
    }
    if (lastName) {
      authorObj.familyName = lastName;
    }
    if (user.email) {
      authorObj.email = user.email;
    }

    parsedAuthors.push(authorObj);
  }

  logwatch.info(
    `Parsed ${parsedAuthors.length} authors for ${owner}/${repo}`,
    true
  );
  return parsedAuthors;
}

/**
 * * Gather the programming languages used in the repository
 * @param {object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The name of the repository
 *
 * @returns {array} - An array of strings containing the programming languages used in the repository
 */
export async function gatherLanguagesUsed(context, owner, repo) {
  // Get the programming languages used in the repo
  const languages = await context.octokit.repos.listLanguages({
    owner,
    repo,
  });

  // Parse the data for languages used
  let languagesUsed = [];
  if (Object.keys(languages.data).length > 0) {
    languagesUsed = Object.keys(languages.data);
  }

  return languagesUsed;
}

/**
 * * Gather the DOI from the README of the repository
 * @param {object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {string} repoName - The name of the repository
 *
 * @returns {array} - An array containing a boolean and the DOI if found, [true, doi] or [false, ""]
 */
export async function getDOI(context, owner, repoName) {
  try {
    const readme = await context.octokit.repos.getContent({
      owner,
      repo: repoName,
    });

    const readmeContent = Buffer.from(readme.data.content, "base64").toString(
      "utf-8"
    );
    const doiRegex = /10.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
    const doi = doiRegex.exec(readmeContent);

    if (doi) {
      return [true, doi[0]];
    }
  } catch (error) {
    return [false, ""];
  }
}

/**
 * * Verify if repository name has changed and update the database if necessary
 * @param {string} dbRepoName - The repository name in the database
 * @param {Object} repository - The repository name from the event payload
 * @param {string} owner - The owner of the repository
 * @param {*} collection - The MongoDB collection
 */
export async function verifyRepoName(
  dbRepoName,
  repository,
  owner,
  collection
) {
  if (dbRepoName !== repository.name) {
    logwatch.info(
      `Repository name for ${owner} has changed from ${dbRepoName} to ${repository.name}`
    );

    // Check if the installation is already in the database
    await collection.update({
      data: {
        repo: repository.name,
      },
      where: {
        id: repository.id,
      },
    });
  }
}

/**
 * * Check if the repository is empty
 * @param {object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {string} repoName - The name of the repository
 * @returns {bool} - Returns true if the repository is empty, false otherwise
 */
export async function isRepoEmpty(context, owner, repoName) {
  try {
    const repoContent = await context.octokit.repos.getContent({
      owner,
      repo: repoName,
    });

    return repoContent.data.length === 0;
  } catch (error) {
    if (error.status === 404) {
      return true;
    }
    logwatch.error(
      { message: "Error checking if the repository is empty:", error },
      true
    );
  }
}

/**
 * * Verify the installation and analytics collections
 * @param {object} context - GitHub payload context
 * @param {object} repository - The repository object metadata
 * @param {boolean} applyActionLimit - Whether to apply the action limit
 * @param {number} actionCount - The number of actions performed
 */
export async function verifyInstallationAnalytics(
  context,
  repository,
  actionCount = 5,
  latestCommitInfo = {}
) {
  const installationId = context.payload.installation.id;
  const owner =
    context.payload?.installation?.account?.login ||
    context.payload?.repository?.owner?.login;

  if (!installationId) {
    throw new Error("Installation ID is missing");
  }

  if (!owner) {
    throw new Error("Owner information is missing");
  }

  const installation = await dbInstance.installation.findUnique({
    where: {
      id: repository.id,
    },
  });

  const analytics = await dbInstance.analytics.findUnique({
    where: {
      id: repository.id,
    },
  });

  if (!installation) {
    // If the installation is not in the database, add it
    await dbInstance.installation.create({
      data: {
        id: repository.id,
        action_count: actionCount,
        installation_id: installationId,
        latest_commit_date: latestCommitInfo.latest_commit_date || "",
        latest_commit_message: latestCommitInfo.latest_commit_message || "",
        latest_commit_sha: latestCommitInfo.latest_commit_sha || "",
        latest_commit_url: latestCommitInfo.latest_commit_url || "",
        owner,
        repo: repository.name,
      },
    });
  } else {
    // If the installation is in the database, check the action count to determine if the limit has been reached
    if (installation.action_count > 0) {
      await dbInstance.installation.update({
        data: {
          action_count: {
            set:
              installation.action_count - 1 < 0
                ? 0
                : installation.action_count - 1,
          },
          latest_commit_date: latestCommitInfo.latest_commit_date || "",
          latest_commit_message: latestCommitInfo.latest_commit_message || "",
          latest_commit_sha: latestCommitInfo.latest_commit_sha || "",
          latest_commit_url: latestCommitInfo.latest_commit_url || "",
        },
        where: { id: repository.id },
      });
    }

    if (installation.action_count === 0) {
      await dbInstance.installation.update({
        data: {
          latest_commit_date: latestCommitInfo.latest_commit_date || "",
          latest_commit_message: latestCommitInfo.latest_commit_message || "",
          latest_commit_sha: latestCommitInfo.latest_commit_sha || "",
          latest_commit_url: latestCommitInfo.latest_commit_url || "",
        },
        where: { id: repository.id },
      });
    }

    // Verify if the repository name has changed
    await verifyRepoName(
      installation.repo,
      repository,
      owner,
      dbInstance.installation
    );
  }

  if (!analytics) {
    // If the analytics for the installation is not in the database, add it
    await dbInstance.analytics.create({
      data: {
        id: repository.id,
      },
    });
  }
}

/**
 * * Verify if repository is private
 * @param {Object} context - The GitHub context object
 * @param {String} owner - The owner of the repository
 * @param {String} repoName - The name of the repository
 * @returns {Boolean} - Returns true if the repository is private, false otherwise
 */
export async function isRepoPrivate(context, owner, repoName) {
  try {
    const repoDetails = await context.octokit.repos.get({
      owner,
      repo: repoName,
    });

    logwatch.info(
      `Repository ${repoName} is private: ${repoDetails.data.private}`
    );
    return repoDetails.data.private;
  } catch (error) {
    logwatch.error(
      { message: "Error verifying if the repository is private:", error },
      true
    );
  }
}

/**
 * * Apply the GitHub issue number to the installation collection in the database
 * @param {Number} issueNumber - The issue number to apply to the database
 * @param {Number} repoId - The repository ID
 */
export async function applyGitHubIssueToDatabase(issueNumber, repoId) {
  await dbInstance.installation.update({
    data: {
      disabled: false,
      issue_number: issueNumber,
    },
    where: { id: repoId },
  });
}

/**
 * * Replaces the raw GitHub URL in the string with another URL
 * @param {String} inputString - The string to process
 * @param {String} newUrl - The new URL to replace the raw GitHub URL with
 * @returns {String} - The string with the raw GitHub URL replaced
 */
export function replaceRawGithubUrl(inputString, oldUrl, newUrl) {
  // Regex to find the oldUrl with optional line numbers in the format :line:column
  const urlRegex = new RegExp(
    `(${oldUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(:\\d+:\\d+)?`,
    "g"
  );

  let firstLineNumber = null;
  let secondLineNumber = null;

  // Replace each found URL in the string with newUrl
  const modifiedString = inputString.replace(urlRegex, (match, p1, p2) => {
    if (p2) {
      const lineNumbers = p2.split(":");
      if (!firstLineNumber) {
        firstLineNumber = lineNumbers[1];
        secondLineNumber = lineNumbers[2];
      }
    }
    return p2 ? `${newUrl}${p2}` : newUrl;
  });

  return [modifiedString, firstLineNumber, secondLineNumber];
}

/**
 * * Apply the last modified date to the GitHub issue body
 * @param {String} baseTemplate - The base template for the GitHub Issue body
 * @returns - The updated base template with the last modified date
 */
export function applyLastModifiedTemplate(baseTemplate) {
  const lastModified = dayjs()
    .tz("America/Los_Angeles")
    .format("MMM D YYYY, HH:mm:ss");

  return `${baseTemplate}<sub><span style="color: grey;">Last updated ${lastModified} (timezone: America/Los_Angeles)</span></br><span>PLEASE NOTE: deleting this issue will require reinstalling the Codefair GitHub App, but closing the issue will allow you to restore the FAIR Compliance Dashboard by reopening the issue.</span></sub>`;
}

/**
 * * Get a GitHub release based on ID of release
 * @param {String} repositoryName - Name of the GitHub repository
 * @param {String} owner - Owner of repository
 * @param {String} releaseId - ID of the release being requested
 * @returns {Object} - Release information
 */
export async function getReleaseById(
  context,
  repositoryName,
  owner,
  releaseId
) {
  try {
    const draftRelease = await context.octokit.repos.getRelease({
      owner,
      repo: repositoryName,
      release_id: releaseId,
    });

    logwatch.success(`Fetched the draft release for: ${repositoryName}`);

    return draftRelease;
  } catch (error) {
    throw new Error(`Error fetching the draft release: ${error}`, {
      cause: error,
    });
  }
}

/**
 * * Downloads and returns the Zipball Archive of a repository's specified branch
 * @param {String} owner - Owner of repository
 * @param {String} repositoryName - Name of the GitHub repository
 * @param {String} branch - Branch to download from (optional)
 * @returns {Object} - Data of the Zipball archive
 */
export async function downloadRepositoryZip(
  context,
  owner,
  repositoryName,
  branch = ""
) {
  try {
    if (!branch) {
      branch = await getDefaultBranch(context, owner, repositoryName);
    }
    const { data } = await context.octokit.repos.downloadZipballArchive({
      owner,
      repo: repositoryName,
      ref: branch,
    });

    logwatch.success(
      `Downloaded the repository archive successfully for: ${repositoryName}`
    );
    return data;
  } catch (error) {
    throw new Error(
      `Error download the repository archive for ${repositoryName}: ${error}`,
      { cause: error }
    );
  }
}

export async function iterateCommitDetails(
  commits,
  subjects,
  repository,
  context,
  owner
) {
  const gatheredCWLFiles = [];
  const removedCWLFiles = [];
  for (let i = 0; i < commits.length; i++) {
    if (commits[i]?.added?.length > 0) {
      // Iterate through the added files
      for (let j = 0; j < commits[i]?.added.length; j++) {
        if (commits[i].added[j] === "LICENSE") {
          subjects.license = true;
          continue;
        }
        if (commits[i].added[j] === "CITATION.cff") {
          subjects.citation = true;
          continue;
        }
        if (commits[i].added[j] === "codemeta.json") {
          subjects.codemeta = true;
          continue;
        }
        const fileSplit = commits[i].added[j].split(".");
        if (fileSplit.includes("cwl")) {
          gatheredCWLFiles.push({
            commitId: commits[i].id,
            filePath: commits[i].added[j],
          });
          continue;
        }
      }
    }
    // Iterate through the modified files
    if (commits[i]?.modified?.length > 0) {
      for (let j = 0; j < commits[i]?.modified.length; j++) {
        const fileSplit = commits[i]?.modified[j].split(".");
        if (fileSplit.includes("cwl")) {
          gatheredCWLFiles.push({
            commitId: commits[i].id,
            filePath: commits[i].modified[j],
          });
          continue;
        }
      }
    }

    // Iterate through the remove files
    if (commits[i]?.removed?.length > 0) {
      for (let j = 0; j < commits[i]?.removed.length; j++) {
        const fileSplit = commits[i]?.removed[j].split(".");
        if (fileSplit.includes("cwl")) {
          removedCWLFiles.push(commits[i].removed[j]);
          continue;
        }
        if (commits[i]?.removed[j] === "LICENSE") {
          subjects.license = false;
          continue;
        }
        if (commits[i]?.removed[j] === "CITATION.cff") {
          subjects.citation = false;
          continue;
        }
        if (commits[i]?.removed[j] === "codemeta.json") {
          subjects.codemeta = false;
          continue;
        }
      }
    }
  }

  if (gatheredCWLFiles.length > 0) {
    // Begin requesting the file metadata for each file name
    for (const file of gatheredCWLFiles) {
      const cwlFile = await context.octokit.repos.getContent({
        owner,
        path: file.filePath,
        repo: repository.name,
      });

      cwlFile.data.commitId = file.commitId;
      subjects.cwl.files.push(cwlFile.data);
    }
  }

  subjects.cwl.contains_cwl_files = subjects.cwl.files.length > 0 || false;
  subjects.cwl.files = subjects.cwl.files.filter(
    (file) => !removedCWLFiles.includes(file.path)
  );
  subjects.cwl.removed_files = removedCWLFiles;

  const cwlExists = await dbInstance.cwlValidation.findUnique({
    where: {
      repository_id: repository.id,
    },
  });

  // Does the repository already contain CWL files
  if (cwlExists) {
    subjects.cwl.contains_cwl_files = cwlExists.contains_cwl_files;
  }

  return subjects;
}

export async function ignoreCommitMessage(
  commitMessage,
  author,
  repository,
  subjects,
  owner,
  context
) {
  logwatch.info(`Verifying commit message: ${commitMessage} by ${author}`);
  logwatch.info(`Known commit messages to ignore: ${IGNORED_COMMIT_MESSAGES}`);
  logwatch.info(
    IGNORED_COMMIT_MESSAGES.includes(commitMessage) &&
      author === `${GH_APP_NAME}[bot]`
  );
  if (
    IGNORED_COMMIT_MESSAGES.includes(commitMessage) &&
    author === `${GH_APP_NAME}[bot]`
  ) {
    logwatch.info(
      `Ignoring commit message: ${commitMessage} by ${author} as it is a known commit message`
    );

    // Update the metadata table to reflect the latest commit information
    updateMetadataDatabase(repository.id, subjects, repository, owner, context);
    return true;
  }
  logwatch.info(`Not ignoring commit message: ${commitMessage} by ${author}`);
  return false;
}

export async function gatherCommitDetails(context, owner, repository) {
  // Get the name of the main branch
  const mainBranch = await getDefaultBranch(context, owner, repository.name);
  // Gather the latest commit to main info
  const latestCommit = await context.octokit.repos.getCommit({
    owner,
    ref: mainBranch,
    repo: repository.name,
  });

  return {
    latest_commit_sha: latestCommit.data.sha || "",
    latest_commit_message: latestCommit.data.commit.message || "",
    latest_commit_url: latestCommit.data.html_url || "",
    latest_commit_date: latestCommit.data.commit.committer.date || "",
  };
}

export async function purgeDBEntry(repository) {
  // Check if the installation is already in the database
  const installation = await dbInstance.installation.findUnique({
    where: {
      id: repository.id,
    },
  });

  const license = await dbInstance.licenseRequest.findUnique({
    where: {
      repository_id: repository.id,
    },
  });

  const metadata = await dbInstance.codeMetadata.findUnique({
    where: {
      repository_id: repository.id,
    },
  });

  const cwl = await dbInstance.cwlValidation.findUnique({
    where: {
      repository_id: repository.id,
    },
  });

  const zenodoDeposition = await dbInstance.zenodoDeposition.findUnique({
    where: {
      repository_id: repository.id,
    },
  });

  if (license) {
    await dbInstance.licenseRequest.delete({
      where: {
        repository_id: repository.id,
      },
    });
  }

  if (metadata) {
    await dbInstance.codeMetadata.delete({
      where: {
        repository_id: repository.id,
      },
    });
  }

  if (cwl) {
    await dbInstance.cwlValidation.delete({
      where: {
        repository_id: repository.id,
      },
    });
  }

  if (zenodoDeposition) {
    await dbInstance.zenodoDeposition.delete({
      where: {
        repository_id: repository.id,
      },
    });
  }

  if (installation) {
    // Remove from the database
    await dbInstance.installation.delete({
      where: {
        id: repository.id,
      },
    });
  }

  logwatch.info(`Repository uninstalled: ${repository.name}`);
}

export async function disableCodefairOnRepo(context) {
  const { repository } = context.payload;
  const installation = await dbInstance.installation.findUnique({
    where: {
      id: repository.id,
    },
  });

  // Update installation table to disable the repository
  if (installation) {
    await dbInstance.installation.update({
      data: {
        disabled: true,
        issue_number: installation.issue_number,
      },
      where: { id: repository.id },
    });
  }

  // Update the body of the issue to reflect that the repository is disabled
  await context.octokit.issues.update({
    body: CLOSED_ISSUE_BODY,
    issue_number: context.payload.issue.number,
    owner: repository.owner.login,
    repo: repository.name,
  });
}

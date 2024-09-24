/**
 * @fileoverview Utility functions for the bot
 */
import { consola } from "consola";
import { init } from "@paralleldrive/cuid2";
import human from "humanparser";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import dbInstance from "../../db.js";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * * Initialize the database connection
 * @returns {Promise<boolean>} - Returns true if the database is connected, false otherwise
 */
export async function intializeDatabase() {
  try {
    consola.start("Connecting to database...");
    await dbInstance;
    consola.success("Connected to database!");
    return true;
  } catch (error) {
    consola.error("Error connecting to database:", error);
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
    consola.error(`Please set the ${varName} environment variable`);
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
export async function getDefaultBranch(context, owner, repo) {
  let defaultBranch;

  try {
    defaultBranch = await context.octokit.repos.getBranch({
      branch: context.payload.repository.default_branch,
      owner,
      repo,
    });

    return defaultBranch;
  } catch (error) {
    consola.error("Error getting the default branch:", error);
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
    creator: `${GITHUB_APP_NAME}[bot]`,
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
    creator: `${GITHUB_APP_NAME}[bot]`,
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
  // Get the list of contributors from the repo
  const contributors = await context.octokit.repos.listContributors({
    owner,
    repo,
  });

  // Get user information for each contributors
  const userInfo = await Promise.all(
    contributors.data.map(async (contributor) => {
      return await context.octokit.users.getByUsername({
        username: contributor.login,
      });
    }),
  );

  const parsedAuthors = [];
  if (userInfo.length > 0) {
    for (const author of userInfo) {
      // Skip bots
      if (author.data.type === "Bot") {
        continue;
      }

      const parsedNames = human.parseName(author.data.name);
      const authorObj = {
        orcid: "",
        roles: [],
        uri: "",
      };

      if (author.data.company && fileType === "citation") {
        authorObj.affiliation = author.data.company;
      }

      if (author.data.company && fileType === "codemeta") {
        authorObj.affiliation = {
          name: author.data.company,
          "@type": "Organization",
        };
      }

      if (parsedNames.firstName) {
        authorObj.givenName = parsedNames.firstName;
      }
      if (parsedNames.lastName) {
        authorObj.familyName = parsedNames.lastName;
      }
      if (author.data.email) {
        authorObj.email = author.data.email;
      }
      parsedAuthors.push(authorObj);
    }
  }

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
      "utf-8",
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
  collection,
) {
  if (dbRepoName !== repository.name) {
    consola.info(
      `Repository name for ${owner} has changed from ${dbRepoName} to ${repository.name}`,
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
    consola.error("Error checking if the repository is empty:", error);
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
  latestCommitInfo = {},
) {
  const owner =
    context.payload?.installation?.account?.login ||
    context.payload?.repository?.owner?.login;

  const installationId = context.payload.installation.id;

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
        latest_commit_date: latestCommitInfo.latestCommitDate || "",
        latest_commit_message: latestCommitInfo.latestCommitMessage || "",
        latest_commit_sha: latestCommitInfo.latestCommitSha || "",
        latest_commit_url: latestCommitInfo.latestCommitUrl || "",
        owner,
        repo: repository.name,
      },
    });
  } else {
    if (installation.action_count > 0) {
      await dbInstance.installation.update({
        data: {
          action_count: {
            set:
              installation.action_count - 1 < 0
                ? 0
                : installation.action_count - 1,
          },
          latest_commit_date: latestCommitInfo.latestCommitDate || "",
          latest_commit_message: latestCommitInfo.latestCommitMessage || "",
          latest_commit_sha: latestCommitInfo.latestCommitSha || "",
          latest_commit_url: latestCommitInfo.latestCommitUrl || "",
        },
        where: { id: repository.id },
      });
    }

    if (installation.action_count === 0) {
      consola.info("Action limit reached, no longer limiting actions");
      await dbInstance.installation.update({
        data: {
          action_count: 0,
          latest_commit_date: latestCommitInfo.latestCommitDate || "",
          latest_commit_message: latestCommitInfo.latestCommitMessage || "",
          latest_commit_sha: latestCommitInfo.latestCommitSha || "",
          latest_commit_url: latestCommitInfo.latestCommitUrl || "",
        },
        where: { id: repository.id },
      });
    }
    verifyRepoName(
      installation.repo,
      repository,
      owner,
      dbInstance.installation,
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

    consola.info(
      `Repository ${repoName} is private: ${repoDetails.data.private}`,
    );
    return repoDetails.data.private;
  } catch (error) {
    consola.error("Error verifying if the repository is private:", error);
  }
}

/**
 * * Apply the GitHub issue number to the installation collection in the database
 * @param {Number} issueNumber - The issue number to apply to the database
 * @param {Number} repoId - The repository ID
 */
export async function applyGitHubIssueToDatabase(issueNumber, repoId) {
  const collection = dbInstance.installation;

  await collection.update({
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
    "g",
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

export function applyLastModifiedTemplate(baseTemplate) {
  const lastModified = dayjs()
    .tz("America/Los_Angeles")
    .format("MMM D YYYY, HH:mm:ss");

  consola.info(
    `GitHub Issue updated at: ${lastModified} (timezone: America/Los_Angeles)`,
  );

  return `${baseTemplate}\n\n<sub><span style="color: grey;">Last updated ${lastModified} (timezone: America/Los_Angeles)</span></sub>`;
}

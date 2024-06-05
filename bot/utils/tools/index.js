/**
 * @fileoverview Utility functions for the bot
 */

/**
 * * Verify that the required environment variables are set
 *
 * @param {string} varName - The name of the environment variable to check
 */
export function checkEnvVariable(varName) {
  if (!process.env[varName]) {
    console.error(`Please set the ${varName} environment variable`);
    process.exit(1);
  }
}

/**
 * * Get the default branch of the repository
 *
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
    console.log("Error getting the default branch");
    console.log(error);
  }
}

/**
 * * Check if the issue already exists in the repository
 *
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
        console.log("Issue already exists, will not recreate");
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
 *
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
 *
 * @param {object} context - The GitHub context object
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The name of the repository
 * @param {string} fileType - The type of file to gather information for (CITATION.cff or codemeta.json)
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
        authorObj["given-names"] = parsedNames.firstName;
      }
      if (parsedNames.lastName) {
        authorObj["family-names"] = parsedNames.lastName;
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
 *
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
  if (Object.keys(languages.data).length !== 0) {
    languagesUsed = Object.keys(languages.data);
  }

  return languagesUsed;
}

/**
 * * Gather the DOI from the README of the repository
 *
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

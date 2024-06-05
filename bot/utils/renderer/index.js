import { nanoid } from "nanoid";
import { checkForCitation } from "../citation/index.js";
import { checkForCodeMeta } from "../codemeta/index.js";
import { checkForLicense } from "../license/index.js";

const GITHUB_APP_NAME = process.env.GITHUB_APP_NAME;
const CODEFAIR_DOMAIN = process.env.CODEFAIR_APP_DOMAIN;

/**
 * * Applies the codemeta template to the base template
 *
 * @param {object} subjects - The subjects to check for
 * @param {string} baseTemplate - The base template to add to
 * @param {*} db - The database
 * @param {object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 *
 * @returns {string} - The updated base template
 */
export async function applyCodemetaTemplate(
  subjects,
  baseTemplate,
  db,
  repository,
  owner,
) {
  if (!subjects.codemeta && subjects.license) {
    // License was found but no codemeta.json exists
    const identifier = nanoid();

    let url = `${CODEFAIR_DOMAIN}/add/codemeta/${identifier}`;

    const codemetaCollection = db.collection("codemetaRequests");
    console.log(repository);
    const existingCodemeta = await codemetaCollection.findOne({
      repositoryId: repository.id,
    });

    if (!existingCodemeta) {
      // Entry does not exist in db, create a new one
      await codemetaCollection.insertOne({
        identifier,
        open: true,
        owner,
        repo: repository.name,
        repositoryId: repository.id,
        timestamp: new Date(),
      });
    } else {
      // Get the identifier of the existing codemeta request
      url = `${CODEFAIR_DOMAIN}/add/codemeta/${existingCodemeta.identifier}`;
    }

    const codemetaBadge = `[![Citation](https://img.shields.io/badge/Add_Codemeta-dc2626.svg)](${url})`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file was not found in the repository. To make your software reusable a codemetada.json is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org).\n\n${codemetaBadge}`;
  } else if (subjects.codemeta && subjects.license) {
    // License was found and codemetata.json also exists
    // Then add codemeta section mentioning it will be checked after license is added
    const codemetaBadge = `![CodeMeta](https://img.shields.io/badge/Codemeta_Added-6366f1.svg)`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file found in the repository.\n\n${codemetaBadge}`;
  } else {
    // codemeta and license does not exist
    const codemetaBadge = `![CodeMeta](https://img.shields.io/badge/Codemeta_Not_Checked-fbbf24)`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file will be checked after a license file is added. To make your software reusable a codemetada.json is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org).\n\n${codemetaBadge}`;
  }

  return baseTemplate;
}

/**
 * * Applies the citation template to the base template
 *
 * @param {object} subjects - The subjects to check for
 * @param {string} baseTemplate - The base template to add to
 * @param {*} db - The database
 * @param {object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 *
 * @returns {string} - The updated base template
 */
export async function applyCitationTemplate(
  subjects,
  baseTemplate,
  db,
  repository,
  owner,
) {
  if (!subjects.citation && subjects.license) {
    // License was found but no citation file was found
    const identifier = nanoid();

    let url = `${CODEFAIR_DOMAIN}/add/citation/${identifier}`;
    const citationCollection = db.collection("citationRequests");
    console.log(repository);
    const existingCitation = await citationCollection.findOne({
      repositoryId: repository.id,
    });

    if (!existingCitation) {
      // Entry does not exist in db, create a new one
      await citationCollection.insertOne({
        identifier,
        open: true,
        owner,
        repo: repository.name,
        repositoryId: repository.id,
        timestamp: new Date(),
      });
    } else {
      // Get the identifier of the existing citation request
      url = `${CODEFAIR_DOMAIN}/add/citation/${existingCitation.identifier}`;
    }

    const citationBadge = `[![Citation](https://img.shields.io/badge/Add_Citation-dc2626.svg)](${url})`;
    baseTemplate += `\n\n## CITATION.cff\n\nA CITATION.cff file was not found in the repository. The [FAIR-BioRS guidelines](https://fair-biors.org/docs/guidelines) suggests to include that file for providing metadata about your software and make it FAIR.\n\n${citationBadge}`;
  } else if (subjects.citation && subjects.license) {
    // Citation file was found and license was found
    const citationBadge = `![Citation](https://img.shields.io/badge/Citation_Added-6366f1.svg)`;
    baseTemplate += `\n\n## CITATION.cff\n\nA CITATION.cff file found in the repository.\n\n${citationBadge}`;
  } else {
    // Citation file was not found and license was not found
    const citationBadge = `![Citation](https://img.shields.io/badge/Citation_Not_Checked-fbbf24)`;
    baseTemplate += `\n\n## CITATION.cff\n\nA CITATION.cff file will be checked after a license file is added. The [FAIR-BioRS guidelines](https://fair-biors.org/docs/guidelines) suggests to include that file for providing metadata about your software and make it FAIR.\n\n${citationBadge}`;
  }

  return baseTemplate;
}

/**
 * * Applies the license template to the base template
 *
 * @param {object} subjects - The subjects to check for
 * @param {string} baseTemplate - The base template to add to
 * @param {*} db - The database
 * @param {object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 *
 * @returns {string} - The updated base template
 */
export async function applyLicenseTemplate(
  subjects,
  baseTemplate,
  db,
  repository,
  owner,
) {
  if (!subjects.license) {
    const identifier = nanoid();
    let url = `${CODEFAIR_DOMAIN}/add/license/${identifier}`;
    const licenseCollection = db.collection("licenseRequests");
    const existingLicense = await licenseCollection.findOne({
      repositoryId: repository.id,
    });

    if (!existingLicense) {
      // Entry does not exist in db, create a new one
      await licenseCollection.insertOne({
        identifier,
        open: true,
        // owner,
        repo: repository.name,
        repositoryId: repository.id,
        timestamp: new Date(),
      });
    } else {
      // Get the identifier of the existing license request
      url = `${CODEFAIR_DOMAIN}/add/license/${existingLicense.identifier}`;
      console.log("Existing license request: " + url);
    }
    // No license file found text
    const licenseBadge = `[![License](https://img.shields.io/badge/Add_License-dc2626.svg)](${url})`;
    baseTemplate += `## LICENSE\n\nNo LICENSE file found in the repository. To make your software reusable a license file is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). Any open license requests that were created are listed here. It is important to choose your license early since it will affect your software's dependencies. If you would like me to add a license file for you, please click the button below a license from the [SPDX License List](https://spdx.org/licenses/). I will then create a new branch with the corresponding license file and open a pull request for you to review and approve. You can also add a license file yourself and I will close this issue when I detect it on the main branch. If you need help with choosing a license, you can check out https://choosealicense.com. You edit the license and push it when you are happy with the terms.\n\n${licenseBadge}`;
  } else {
    // License file found text
    const licenseBadge = `![License](https://img.shields.io/badge/License_Added-22c55e.svg)`;
    baseTemplate += `## LICENSE\n\nA LICENSE file found in the repository.\n\n${licenseBadge}`;
  }

  return baseTemplate;
}

/**
 * * Renders the body of the dashboard issue message
 *
 * @param {string} owner - The owner of the repository
 * @param {object} repository  - The repository
 * @param {*} db  - The database
 * @param {string} prTitle - The title of the PR
 * @param {string} prNumber - The number of the PR
 * @param {string} prLink - The link to the PR
 * @param {array} commits - The commits that were pushed
 *
 * @returns {string} - The rendered issue message
 */
export async function renderIssues(
  context,
  owner,
  repository,
  db,
  prTitle = "",
  prNumber = "",
  prLink = "",
  commits = [],
) {
  let license = await checkForLicense(context, owner, repository);
  let citation = await checkForCitation(context, owner, repository);
  let codemeta = await checkForCodeMeta(context, owner, repository);

  // Check if any of the commits added a LICENSE, CITATION, or codemeta file
  if (commits.length > 0) {
    for (let i = 0; i < commits.length; i++) {
      if (commits[i].added.includes("LICENSE")) {
        console.log("LICENSE file added with this push");
        license = true;
        continue;
      }
      if (commits[i].added.includes("CITATION.cff")) {
        console.log("CITATION.cff file added with this push");
        citation = true;
        continue;
      }
      if (commits[i].added.includes("codemeta.json")) {
        console.log("codemeta.json file added with this push");
        codemeta = true;
        continue;
      }
    }
  }

  const subjects = {
    citation,
    codemeta,
    license,
  };
  let baseTemplate = `# Check your compliance with the FAIR-BioRS Guidelines\n\nThis issue is your repository's dashboard for all things FAIR. You can read the [documentation](https://docs.codefair.io/dashboard) to learn more.\n\n`;

  baseTemplate = await applyLicenseTemplate(
    subjects,
    baseTemplate,
    db,
    repository,
    owner,
  );

  // If License PR is open, add the PR number to the dashboard
  console.log(prTitle);
  if (prTitle === "feat: ✨ LICENSE file added") {
    baseTemplate += `\n\nA pull request for the LICENSE file is open. You can view the pull request:\n\n[![License](https://img.shields.io/badge/View_PR-6366f1.svg)](${prLink})`;
  }

  baseTemplate = await applyCitationTemplate(
    subjects,
    baseTemplate,
    db,
    repository,
    owner,
  );

  if (prTitle === "feat: ✨ CITATION.cff file added") {
    baseTemplate += `\n\nA pull request for the CITATION.cff file is open. You can view the pull request:\n\n[![Citation](https://img.shields.io/badge/View_PR-6366f1.svg)](${prLink})`;
  }

  baseTemplate = await applyCodemetaTemplate(
    subjects,
    baseTemplate,
    db,
    repository,
    owner,
  );

  if (prTitle === "feat: ✨ codemeta.json file added") {
    baseTemplate += `\n\nA pull request for the codemeta.json file is open. You can view the pull request:\n\n[![CodeMeta](https://img.shields.io/badge/View_PR-6366f1.svg)](${prLink})`;
  }

  return baseTemplate;
}

/**
 * * Creates an issue in the repository with the given title and body (Verifies if an issue with the same title exists)
 *
 * @param {object} context - The context of the GitHub Event
 * @param {string} owner - The owner of the repository
 * @param {string} repo - The repository name
 * @param {string} title - The title of the issue
 * @param {string} body - The body of the issue
 */
export async function createIssue(context, owner, repo, title, body) {
  // If issue has been created, create one
  console.log("gathering issues");
  const issue = await context.octokit.issues.listForRepo({
    title,
    creator: `${GITHUB_APP_NAME}[bot]`,
    owner,
    repo,
    state: "open",
  });

  // console.log("ISSUE DATA");
  // console.log(issue.data);
  console.log(title);

  if (issue.data.length > 0) {
    // iterate through issues to see if there is an issue with the same title
    let noIssue = false;
    let issueNumber;
    for (let i = 0; i < issue.data.length; i++) {
      console.log(issue.data[i].title);
      if (issue.data[i].title === title) {
        noIssue = true;
        issueNumber = issue.data[i].number;
        break;
      }
    }

    if (!noIssue) {
      console.log("Creating an issue since no open issue was found");
      // Issue has not been created so we create one
      await context.octokit.issues.create({
        title,
        body,
        owner,
        repo,
      });
    } else {
      // Update the issue with the new body
      console.log("++++++++++++++++");
      console.log(issue.data);
      // console.log(issue);
      console.log("Updating existing issue: " + issueNumber);
      await context.octokit.issues.update({
        title,
        body,
        issue_number: issueNumber,
        owner,
        repo,
      });
    }
  }

  if (issue.data.length === 0) {
    // Issue has not been created so we create one
    await context.octokit.issues.create({
      title,
      body,
      owner,
      repo,
    });
  }
}

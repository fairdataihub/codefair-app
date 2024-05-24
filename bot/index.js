import axios from "axios";
import human from "humanparser";
import yaml from "js-yaml";
import { MongoClient } from "mongodb";
import { nanoid } from "nanoid";
import licensesAvail from "./public/assets/data/licenses.json" assert { type: "json" };

function checkEnvVariable(varName) {
  if (!process.env[varName]) {
    console.error(`Please set the ${varName} environment variable`);
    process.exit(1);
  }
}
checkEnvVariable("MONGODB_URI");
checkEnvVariable("MONGODB_DB_NAME");
checkEnvVariable("GITHUB_APP_NAME");
checkEnvVariable("DOPPLER_ENVIRONMENT");

// sourcery skip: use-object-destructuring
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;
const GITHUB_APP_NAME = process.env.GITHUB_APP_NAME;
const ENVIRONMENT = process.env.DOPPLER_ENVIRONMENT;

const client = new MongoClient(MONGODB_URI, {});

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default async (app) => {
  // Connect to the MongoDB database
  await client.connect();

  const db = client.db(MONGODB_DB_NAME);
  const ping = db.collection("ping");

  await ping.insertOne({
    timestamp: new Date(),
  });

  // Opens a PR every time someone installs your app for the first time
  // On adding the app to a repo
  app.on("installation.created", async (context) => {
    const owner = context.payload.installation.account.login;

    // shows all repos you've installed the app on
    for (const repository of context.payload.repositories) {
      const repo = repository.name;

      const issueBody = await renderIssues(
        context,
        owner,
        repository,
        // subjects,
        db,
      );
      const title = `FAIR-BioRS Compliance Issues`;

      // Create an issue with the compliance issues
      await createIssue(context, owner, repo, title, issueBody);
    }
  });

  app.on("installation_repositories.added", async (context) => {
    // Event for when github app is alredy installed but a new repository is added
    const owner = context.payload.installation.account.login;

    for (const repository of context.payload.repositories_added) {
      // Loop through the added respotories
      const repo = repository.name;
      console.log("REPO ID: " + repository.id);
      console.log(repository);

      const issueBody = await renderIssues(
        context,
        owner,
        repository,
        // subjects,
        db,
      );
      const title = `FAIR-BioRS Compliance Issues`;

      // Create an issue with the compliance issues
      console.log("CREATING ISSUE");
      await createIssue(context, owner, repo, title, issueBody);

      // if (!license) {
      //   // No license was found, make an issue if one was never made before
      //   // If the issue was close, don't make another
      //   console.log(`No license file found [${GITHUB_APP_NAME}]`);
      //   const title = `No license file found [${GITHUB_APP_NAME}]`;
      //   const body = `To make your software reusable a license file is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). No such file was found. It is important to choose your license early since it will affect your software's dependencies. If you would like me to add a license file for you, please reply here with the identifier of the license you would like from the [SPDX License List](https://spdx.org/licenses/)  (e.g., comment “@${GITHUB_APP_NAME} MIT” for the MIT license). I will then create a new branch with the corresponding license file and open a pull request for you to review and approve. You can also add a license file yourself and I will close this issue when I detect it on the main branch. If you need help with choosing a license, you can check out https://choosealicense.com.`;
      //   const verify = await verifyFirstIssue(context, owner, repo, title);
      //   if (!verify) {
      //     await createIssue(context, owner, repo, title, body);
      //   }
      // } else {
      //   // Check if issue is open and close it
      //   const title = `No license file found [${GITHUB_APP_NAME}]`;
      //   await closeOpenIssue(context, owner, repo, title);
      // }

      // if (!citation && license) {
      //   const title = `No citation file found [${GITHUB_APP_NAME}]`;
      //   const body = `No CITATION.cff file was found at the root of your repository. The [FAIR-BioRS guidelines](https://fair-biors.org/docs/guidelines) suggests to include that file for providing metadata about your software and make it FAIR.
      //     If you would like me to generate a CITATION.cff file for you, please reply with "@${GITHUB_APP_NAME} Yes". I will gather the information required in the CITATION.cff that I can find automatically from your repository and include that information in my reply for your review and edit. You can also add a CITATION.cff file yourself and I will close this issue when I detect it on the main branch.
      //     `;
      //   const verify = await verifyFirstIssue(context, owner, repo, title);
      //   if (!verify) {
      //     await createIssue(context, owner, repo, title, body);
      //   }
      // }

      // if (!codemeta && license) {
      //   // License was found but no codemeta.json exists
      //   const title = `No codemeta.json file found [${GITHUB_APP_NAME}]`;
      //   const body = `To make your software reusable a codemetada.json is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). No such file was found. It is important to provide software metadata to transfer metadata between software authors, repositories, and others, for the purposes of archiving, sharing, indexing, citing and discovering software. If you would like me to generate a codemeta.json file for you, please reply here with '@${GITHUB_APP_NAME} Yes'. I will gather the information required in the codemeta.json that I can find automatically from your repository and include that information in my reply for your edit or approve. You can also add a codemeta.json file yourself and I will close this issue when I detect it on the main branch.`;
      //   const verify = await verifyFirstIssue(context, owner, repo, title);
      //   if (!verify) {
      //     await createIssue(context, owner, repo, title, body);
      //   }
      // }
    }
  });

  app.on("push", async (context) => {
    // Event for when a push is made to the repository (listens to all branches)
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    // Check if push is going to the default branch
    const defaultBranch = await getDefaultBranch(context, owner, repo);

    // If push is not going to the default branch don't do anything
    if (context.payload.ref !== `refs/heads/${defaultBranch.data.name}`) {
      console.log("Not pushing to default branch");
      return;
    }

    // Grab the commits being pushed
    const { commits } = context.payload;
    let license = await checkForLicense(context, owner, repo);
    let citation = await checkForCitation(context, owner, repo);
    let codemeta = await checkForCodeMeta(context, owner, repo);

    // Check if any of the commits added a LICENSE, CITATION, or codemeta file
    if (commits.length > 0) {
      let licenseBeingPushed = false;
      let citationBeingPushed = false;
      let codeMetaBeingPushed = false;
      for (let i = 0; i < commits.length; i++) {
        if (commits[i].added.includes("LICENSE")) {
          console.log("LICENSE file added with this push");
          licenseBeingPushed = true;
          continue;
        }
        if (commits[i].added.includes("CITATION.cff")) {
          console.log("CITATION.cff file added with this push");
          citationBeingPushed = true;
          continue;
        }
        if (commits[i].added.includes("codemeta.json")) {
          console.log("codemeta.json file added with this push");
          codeMetaBeingPushed = true;
          continue;
        }
        if (licenseBeingPushed) {
          license = true;
        }
        if (citationBeingPushed) {
          citation = true;
        }
        if (codeMetaBeingPushed) {
          codemeta = true;
        }
      }
    }

    if (!license) {
      console.log("No license file found (push)");
      const title = `No license file found [${GITHUB_APP_NAME}]`;
      const body = `To make your software reusable a license file is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). No such file was found. It is important to choose your license early since it will affect your software's dependencies. If you would like me to add a license file for you, please reply here with the identifier of the license you would like from the [SPDX License List](https://spdx.org/licenses/)  (e.g., comment “@${GITHUB_APP_NAME} MIT” for the MIT license). I will then create a new branch with the corresponding license file and open a pull request for you to review and approve. You can also add a license file yourself and I will close this issue when I detect it on the main branch. If you need help with choosing a license, you can check out https://choosealicense.com.`;
      const verify = await verifyFirstIssue(context, owner, repo, title);
      if (!verify) {
        await createIssue(context, owner, repo, title, body);
      }
    } else {
      // License was found, close the issue if one was created
      const title = `No license file found [${GITHUB_APP_NAME}]`;
      await closeOpenIssue(context, owner, repo, title);
    }

    if (!citation && license) {
      const title = `No citation file found [${GITHUB_APP_NAME}]`;
      const body = `No CITATION.cff file was found at the root of your repository. The [FAIR-BioRS guidelines](https://fair-biors.org/docs/guidelines) suggests to include that file for providing metadata about your software and make it FAIR.
      If you would like me to generate a CITATION.cff file for you, please reply with "@${GITHUB_APP_NAME} Yes". I will gather the information required in the CITATION.cff that I can find automatically from your repository and include that information in my reply for your review and edit. You can also add a CITATION.cff file yourself and I will close this issue when I detect it on the main branch.
      `;
      const verify = await verifyFirstIssue(context, owner, repo, title);
      if (!verify) {
        await createIssue(context, owner, repo, title, body);
      }
    } else if (citation) {
      const title = `No citation file found [${GITHUB_APP_NAME}]`;
      await closeOpenIssue(context, owner, repo, title);
    }

    if (!codemeta && license) {
      // License was found but no codemeta.json exists
      const title = `No codemeta.json file found [${GITHUB_APP_NAME}]`;
      const body = `To make your software reusable a codemetada.json is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). No such file was found. It is important to provide software metadata to transfer metadata between software authors, repositories, and others, for the purposes of archiving, sharing, indexing, citing and discovering software. If you would like me to generate a codemeta.json file for you, please reply here with '@${GITHUB_APP_NAME} Yes'. I will gather the information required in the codemeta.json that I can find automatically from your repository and include that information in my reply for your edit or approve. You can also add a codemeta.json file yourself and I will close this issue when I detect it on the main branch.`;
      const verify = await verifyFirstIssue(context, owner, repo, title);
      if (!verify) {
        await createIssue(context, owner, repo, title, body);
      }
    } else if (codemeta) {
      const title = `No codemeta.json file found [${GITHUB_APP_NAME}]`;
      await closeOpenIssue(context, owner, repo, title);
    }
  });

  app.on("issue_comment.created", async (context) => {
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const userComment = context.payload.comment.body;
    const authorAssociation = context.payload.comment.author_association;

    if (
      context.payload.issue.title ===
        `No license file found [${GITHUB_APP_NAME}]` &&
      ["MEMBER", "OWNER"].includes(authorAssociation) &&
      userComment.includes(GITHUB_APP_NAME)
    ) {
      // Check the comment to see if the user has replied with a license
      const splitComment = userComment.split(" ");
      const selection =
        splitComment[splitComment.indexOf(`@${GITHUB_APP_NAME} license`) + 1];

      console.log("License user responded with: " + selection);

      // Create a new file with the license on the new branch and open pull request
      await createLicense(context, owner, repo, selection);
    }

    if (
      context.payload.issue.title ===
        `No citation file found [${GITHUB_APP_NAME}]` &&
      ["MEMBER", "OWNER"].includes(authorAssociation) &&
      userComment.includes(GITHUB_APP_NAME)
    ) {
      if (userComment.includes("Yes")) {
        // Gather the information for the CITATION.cff file
        await gatherCitationInfo(context, owner, repo);
      }
    }

    if (
      context.payload.issue.title ===
        `No codemeta.json file found [${GITHUB_APP_NAME}]` &&
      ["MEMBER", "OWNER"].includes(authorAssociation) &&
      userComment.includes(GITHUB_APP_NAME)
    ) {
      if (userComment.includes("Yes")) {
        // Gather the information for the codemeta.json file
        await gatherCodeMetaInfo(context, owner, repo);
      }
    }
  });
};

/**
 * * Renders the body of the dashboard issue message
 *
 * @param {string} owner - The owner of the repository
 * @param {*} repository
 * @param {*} db
 * @returns
 */
async function renderIssues(context, owner, repository, db) {
  // const issueTitle = "FAIR-BioRS Compliance Issues";
  // console.log(subjects);

  console.log("IMPORTANT");
  console.log(repository);
  console.log("IMPORTANT!!!!!");
  console.log(context);
  console.log("IMPORTANT!!!!!");

  const license = await checkForLicense(context, owner, repository);
  const citation = await checkForCitation(context, owner, repository);
  const codemeta = await checkForCodeMeta(context, owner, repository);

  const subjects = {
    citation,
    codemeta,
    license,
  };
  let baseTemplate = `# Check your compliance with the FAIR-BioRS Guidelines\n\nThis issue is your repository's dashboard for all things FAIR. You can read the [documentation](https://docs.codefair.io/dashboard) to learn more.\n\n`;

  if (!subjects.license) {
    const identifier = nanoid();

    let url = `https://codefair.io/add/license/${identifier}`;
    if (ENVIRONMENT === "dev") {
      // If in development, use localhost
      url = `http://localhost:3000/add/license/${identifier}`;
    }

    const licenseCollection = db.collection("licenseRequests");

    const existingLicense = await licenseCollection.findOne({
      repositoryId: repository.id,
    });
    console.log(existingLicense);

    if (!existingLicense) {
      // Entry does not exist in db, create a new one
      await licenseCollection.insertOne({
        identifier,
        installationId: context.payload.installation.id,
        open: true,
        owner,
        repo: repository.name,
        repositoryId: repository.id,
        timestamp: new Date(),
      });
    } else {
      // Get the identifier of the existing license request
      url = `https://codefair.io/add/license/${existingLicense.identifier}`;
      if (ENVIRONMENT === "dev") {
        // If in development, use localhost
        url = `http://localhost:3000/add/license/${existingLicense.identifier}`;
      }
      console.log("Existing license request: " + url);
    }
    // No license file found text
    const licenseBadge = `[![License](https://img.shields.io/badge/Add_License-dc2626.svg)](${url})`;
    baseTemplate += `## LICENSE\n\nNo LICENSE file found in the repository. To make your software reusable a license file is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). Any open license requests that were created are listed here. It is important to choose your license early since it will affect your software's dependencies. If you would like me to add a license file for you, please reply here with the identifier of the license you would like from the [SPDX License List](https://spdx.org/licenses/)  (e.g., comment “@${GITHUB_APP_NAME} MIT” for the MIT license). I will then create a new branch with the corresponding license file and open a pull request for you to review and approve. You can also add a license file yourself and I will close this issue when I detect it on the main branch. If you need help with choosing a license, you can check out https://choosealicense.com. You edit the license and push it when you are happy with the terms.\n\n${licenseBadge}`;
  } else {
    // License file found text
    const licenseBadge = `[![License](https://img.shields.io/badge/License_Added-6366f1.svg)]`;
    baseTemplate += `## LICENSE\n\nA LICENSE file found in the repository.\n\n${licenseBadge}`;
  }

  if (!subjects.citation && subjects.license) {
    // License was found but no citation file was found
    const identifier = nanoid();

    let url = `https://codefair.io/add/citation/${identifier}`;
    if (ENVIRONMENT === "dev") {
      // If in development, use localhost
      url = `http://localhost:3000/add/citation/${identifier}`;
    }

    const citationCollection = db.collection("citationRequests");

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
      url = `https://codefair.io/add/citation/${existingCitation.identifier}`;
      if (ENVIRONMENT === "dev") {
        // If in development, use localhost
        url = `http://localhost:3000/add/citation/${existingCitation.identifier}`;
      }
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

  if (!subjects.codemeta && subjects.license) {
    // License was found but no codemeta.json exists
    const codemetaBadge = `![CodeMeta](https://img.shields.io/badge/Add_CodeMeta-dc2626.svg)`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file was not found in the repository. To make your software reusable a codemetada.json is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org).\n\n${codemetaBadge}`;
  } else if (subjects.codemeta && subjects.license) {
    // License was found and also codemetata.json exists
    // Then add codemeta section mentioning it will be checked after license is added
    const codemetaBadge = `![CodeMeta](https://img.shields.io/badge/CodeMeta_Added-6366f1.svg)`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file found in the repository.\n\n${codemetaBadge}`;
  } else {
    // codemeta and license does not exist
    const codemetaBadge = `![CodeMeta](https://img.shields.io/badge/CodeMeta_Not_Checked-fbbf24)`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file will be checked after a license file is added. To make your software reusable a codemetada.json is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org).\n\n${codemetaBadge}`;
  }

  return baseTemplate;
}

async function getDefaultBranch(context, owner, repo) {
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

async function closeOpenIssue(context, owner, repo, title) {
  // Check if issue is open and close it
  // TODO: UPDATE THE CREATOR WHEN MOVING TO PROD
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

async function verifyFirstIssue(context, owner, repo, title) {
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

async function checkForLicense(context, owner, repo) {
  console.log("checking for license");
  try {
    await context.octokit.rest.licenses.getForRepo({
      owner,
      repo,
    });

    console.log("license found!");
    return true;
  } catch (error) {
    console.log("no license found");
    // Errors when no License is found in the repo
    return false;
  }
}

async function checkForCitation(context, owner, repo) {
  try {
    await context.octokit.rest.repos.getContent({
      owner,
      path: "CITATION.cff",
      repo,
    });

    return true;
  } catch (error) {
    return false;
  }
}

async function checkForCodeMeta(context, owner, repo) {
  try {
    await context.octokit.rest.repos.getContent({
      owner,
      path: "codemeta.json",
      repo,
    });

    return true;
  } catch (error) {
    return false;
  }
}

async function createIssue(context, owner, repo, title, body) {
  // If issue has been created, create one
  console.log("gathering issues");
  const issue = await context.octokit.issues.listForRepo({
    title,
    creator: `${GITHUB_APP_NAME}[bot]`,
    owner,
    repo,
    state: "open",
  });

  console.log("ISSUE DATA");
  console.log(issue.data);

  if (issue.data.length > 0) {
    // iterate through issues to see if there is an issue with the same title
    let noIssue = false;
    for (let i = 0; i < issue.data.length; i++) {
      if (issue.data[i].title === title) {
        noIssue = true;
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

async function gatherRepoAuthors(context, owner, repo, fileType) {
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
      if (author.data.type === "Bot") {
        continue;
      }

      const authorObj = {
        orcid: "",
      };

      const parsedNames = human.parseName(author.data.name);

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

async function gatherLanguagesUsed(context, owner, repo) {
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

async function createLicense(context, owner, repo, license) {
  // Verify there is no PR open already for the LICENSE file
  const openPR = await context.octokit.pulls.list({
    owner,
    repo,
    state: "open",
  });

  let prExists = false;

  for (const pr of openPR.data) {
    if (pr.title === "feat: ✨ LICENSE file added") {
      prExists = true;
    }
  }

  if (prExists) {
    await context.octokit.issues.createComment({
      body: `A pull request for the LICENSE file already exists here: ${openPR.data[0].html_url}`,
      issue_number: context.payload.issue.number,
      owner,
      repo,
    });

    // // comment on pull request to resolve issue
    // await context.octokit.issues.createComment({
    //   repo,
    //   owner,
    //   issue_number: openPR.data[0].number,
    //   body: `Resolves #${context.payload.issue.number}`,
    // });
    return;
  }

  // Create a new file with the license parameter (use axios to get the license from the licenses.json file)
  // Create a new branch with the license file and open a PR
  const licenseRequest = licensesAvail.find(
    (item) => item.licenseId === license,
  );
  if (licenseRequest) {
    try {
      const response = await axios.get(licenseRequest.detailsUrl);
      const responseData = response.data;

      // Create a new file
      const branch = `license-${Math.floor(Math.random() * 9999)}`;

      let defaultBranch;
      let defaultBranchName;

      try {
        defaultBranch = await context.octokit.repos.getBranch({
          branch: context.payload.repository.default_branch,
          owner,
          repo,
        });
        defaultBranchName = defaultBranch.data.name;
      } catch (error) {
        console.log("Error getting default branch");
        console.log(error);
        return;
      }

      // Create a new branch base off the default branch
      console.log(default_branch);
      console.log("Creating branch");
      await context.octokit.git.createRef({
        owner,
        ref: `refs/heads/${branch}`,
        repo,
        sha: defaultBranch.data.commit.sha,
      });

      // Create a new file
      console.log("Creating file");
      await context.octokit.repos.createOrUpdateFileContents({
        branch,
        content: Buffer.from(responseData.licenseText).toString("base64"),
        message: `feat: ✨ add LICENSE file with ${license} license terms`,
        owner,
        path: "LICENSE",
        repo,
      });

      // Create a PR from that branch with the commit of our added file
      console.log("Creating PR");
      await context.octokit.pulls.create({
        title: "feat: ✨ LICENSE file added",
        base: defaultBranchName,
        body: `Resolves #${context.payload.issue.number}`,
        head: branch,
        maintainer_can_modify: true, // Allows maintainers to edit your app's PR
        owner,
        repo,
      });

      // Comment on issue to notify user that license has been added
      console.log("Commenting on issue");
      await context.octokit.issues.createComment({
        body: `A LICENSE file with ${license} license terms has been added to a new branch and a pull request is awaiting approval. I will close this issue automatically once the pull request is approved.`,
        issue_number: context.payload.issue.number,
        owner,
        repo,
      });
    } catch (error) {
      console.log("Error fetching license file");
      console.log(error);
    }
  } else {
    // License not found, comment on issue to notify user
    console.log("License not found");
    await context.octokit.issues.createComment({
      body: `The license identifier “${license}” was not found in the SPDX License List. Please reply with a valid license identifier.`,
      issue_number: context.payload.issue.number,
      owner,
      repo,
    });
  }
}

async function createCitationFile(context, owner, repo, citationText) {
  // Here we take the citation text passed as a parameter
  // It could from probot's initial gathering or an updated version from the user

  // Create a new branch
  const branch = `citation-${Math.floor(Math.random() * 9999)}`;

  // Get the default branch of the repo
  const defaultBranch = await getDefaultBranch(context, owner, repo);
  const defaultBranchName = defaultBranch.data.name;

  // Create a new branch based off the default branch
  await context.octokit.git.createRef({
    owner,
    ref: `refs/heads/${branch}`,
    repo,
    sha: defaultBranch.data.commit.sha,
  });

  // Create a new file
  await context.octokit.repos.createOrUpdateFileContents({
    branch,
    content: Buffer.from(citationText).toString("base64"),
    message: `feat: ✨ add CITATION.cff file`,
    owner,
    path: "CITATION.cff",
    repo,
  });

  // Create a PR with the branch
  await context.octokit.pulls.create({
    title: "feat: ✨ CITATION.cff create for repo",
    base: defaultBranchName,
    body: `Resolves #${context.payload.issue.number}`,
    head: branch,
    maintainer_can_modify: true,
    owner,
    repo,
  });

  // Get the link to the CITATION.cff file in the branch created
  let citationLink = await context.octokit.repos.getContent({
    owner,
    path: "CITATION.cff",
    ref: `refs/heads/${branch}`,
    repo,
  });

  citationLink = citationLink.data.html_url;
  const editLink = citationLink.replace("blob", "edit");

  await context.octokit.issues.createComment({
    body:
      "```yaml\n" +
      citationText +
      "\n```" +
      `\n\nHere is the information I was able to gather from this repo. If you would like to add more please follow the link to edit using the GitHub UI. Once you are satisfied with the CITATION.cff you can merge the pull request and I will close this issue.
      \n\n[Edit CITATION.cff](${editLink})`,
    issue_number: context.payload.issue.number,
    owner,
    repo,
  });
}

async function createCodeMetaFile(context, owner, repo, codeMetaText) {
  // Create a new branch
  const branch = `codemeta-${Math.floor(Math.random() * 9999)}`;

  // Get the default branch of the repo
  const defaultBranch = await getDefaultBranch(context, owner, repo);
  const defaultBranchName = defaultBranch.data.name;

  // Create a new branch based off the default branch
  await context.octokit.git.createRef({
    owner,
    ref: `refs/heads/${branch}`,
    repo,
    sha: defaultBranch.data.commit.sha,
  });

  // Create a new file
  await context.octokit.repos.createOrUpdateFileContents({
    branch,
    content: Buffer.from(JSON.stringify(codeMetaText, null, 2)).toString(
      "base64",
    ),
    message: `feat: ✨ add codemeta.json file`,
    owner,
    path: "codemeta.json",
    repo,
  });

  // Create a PR with the branch
  await context.octokit.pulls.create({
    title: "feat: ✨ codemeta.json created for repo",
    base: defaultBranchName,
    body: `Resolves #${context.payload.issue.number}`,
    head: branch,
    maintainer_can_modify: true,
    owner,
    repo,
  });

  // Get the link to the codemeta.json file in the branch created
  let codemetaLink = await context.octokit.repos.getContent({
    owner,
    path: "codemeta.json",
    ref: `refs/heads/${branch}`,
    repo,
  });

  codemetaLink = codemetaLink.data.html_url;
  const editLink = codemetaLink.replace("blob", "edit");

  await context.octokit.issues.createComment({
    body:
      "```json\n" +
      JSON.stringify(codeMetaText, null, 2) +
      "\n```" +
      `\n\nHere is the information I was able to gather from this repo. If you would like to add more please follow the link to edit using the GitHub UI. Once you are satisfied with the codemeta.json you can merge the pull request and I will close this issue.
      \n\n[Edit codemeta.json](${editLink})`,
    issue_number: context.payload.issue.number,
    owner,
    repo,
  });
}

async function getDOI(context, owner, repoName) {
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

async function gatherCitationInfo(context, owner, repo) {
  // Verify there is no PR open already for the CITATION.cff file
  const openPR = await context.octokit.pulls.list({
    owner,
    repo,
    state: "open",
  });

  let prExists = false;

  for (const pr of openPR.data) {
    if (pr.title === "feat: ✨ CITATION.cff created for repo") {
      prExists = true;
    }
  }

  if (prExists) {
    await context.octokit.issues.createComment({
      body: `A PR for the CITATION.cff file already exists here: ${openPR.data[0].html_url}`,
      issue_number: context.payload.issue.number,
      owner,
      repo,
    });
    return;
  }

  // Get the release data of the repo
  const releases = await context.octokit.repos.listReleases({
    owner,
    repo,
  });

  // Get the metadata of the repo
  const repoData = await context.octokit.repos.get({
    owner,
    repo,
  });

  // Get authors of repo
  const parsedAuthors = await gatherRepoAuthors(
    context,
    owner,
    repo,
    "citation",
  );
  // Get DOI of repo (if it exists)
  const doi = await getDOI(context, owner, repo);
  // Get the repo description
  const abstract = repoData.data.description;
  // Get the license of the repo
  const licenseName = repoData.data.license;

  // date released is dependent on whether the repo has a release data (if not, use the created date)
  let dateReleased;
  if (repoData.data.released_at) {
    dateReleased = repoData.data.released_at;
  } else {
    // The date needs to be in this pattern:
    dateReleased = new Date().toISOString().split("T")[0];
  }

  // Get the homepage of the repo
  let url;
  if (repoData.data.homepage != null) {
    url = repoData.data.homepage;
  }

  // Get the keywords of the repo
  let keywords = [];
  if (repoData.data.topics != null && repoData.data.topics.length > 0) {
    console.log(repoData.data.topics);
    keywords = repoData.data.topics;
    console.log(keywords);
  }

  // Begin creating json for CITATION.cff file
  let citationObj = {
    title: repoData.data.name,
    "cff-version": "1.2.0",
    identifiers: [
      {
        description: "DOI for this software's record on Zenodo.",
        type: "doi",
      },
    ],
    message: "If you use this software, please cite it as below.",
    "repository-code": repoData.data.html_url,
    type: "software",
  };

  if (doi[0]) {
    citationObj.identifiers[0].value = doi[1];
  } else {
    citationObj.identifiers[0].value = "";
  }

  if (parsedAuthors.length > 0) {
    citationObj.authors = parsedAuthors;
  }

  if (licenseName !== null) {
    citationObj.license = licenseName.spdx_id;
  }

  if (abstract !== null) {
    citationObj.abstract = abstract;
  } else {
    citationObj.abstract = "";
  }

  if (keywords.length > 0) {
    citationObj.keywords = keywords;
  }

  if (url !== null && url !== "") {
    citationObj.url = url;
  } else {
    citationObj.url = repoData.data.html_url;
  }

  if (dateReleased !== null && dateReleased !== "") {
    citationObj["date-released"] = dateReleased;
  } else {
    citationObj["date-released"] = "";
  }

  // sort keys alphabetically
  citationObj = Object.keys(citationObj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = citationObj[key];
      return acc;
    }, {});

  const citationTemplate = yaml.dump(citationObj);

  await createCitationFile(context, owner, repo, citationTemplate);
}

async function gatherCodeMetaInfo(context, owner, repo) {
  // Gather metadata from the repo to create a codemeta.json file
  const repoData = await context.octokit.repos.get({
    owner,
    repo,
  });

  // Get the languages used in the repo
  console.log(repoData.data);

  const languagesUsed = await gatherLanguagesUsed(context, owner, repo);
  const authors = await gatherRepoAuthors(context, owner, repo, "codemeta");
  const codeRepository = repoData.data.html_url;
  const dataCreated = repoData.data.created_at;
  const dataModified = repoData.data.updated_at;
  const keywords = repoData.data.topics;
  const license = repoData.data.license.spdx_id;
  const description = repoData.data.description;
  const identifier = repoData.data.id;
  const name = repoData.data.full_name;
  let issueTracker = repoData.data.issues_url;
  // TODO: See if those two api calls are needed

  let metadata = {
    "@context": "https://doi.org/10.5063/schema/codemeta-2.0",
    "@type": "SoftwareSourceCode",
  };

  if (license !== null || license !== "") {
    metadata.license = `https://spdx.org/licenses/${license}`;
  }

  if (codeRepository !== null || codeRepository !== "") {
    metadata.codeRepository = codeRepository;
  }

  if (dataCreated !== null || dataCreated !== "") {
    metadata.dateCreated = dataCreated.split("T")[0];
  }

  if (dataModified !== null || dataModified !== "") {
    metadata.dateModified = dataModified.split("T")[0];
  }

  if (keywords.length > 0) {
    metadata.keywords = keywords;
  } else {
    metadata.keywords = [];
  }

  if (description !== null || description !== "") {
    metadata.description = description;
  }

  if (identifier !== null || identifier !== "") {
    metadata.identifier = identifier;
  }

  if (name !== null || name !== "") {
    metadata.name = name;
  }

  if (issueTracker !== null || issueTracker !== "") {
    // Remove the {/number} from the issue tracker url
    issueTracker = issueTracker.replace("{/number}", "");
    metadata.issueTracker = issueTracker;
  }

  if (languagesUsed.length > 0) {
    metadata.programmingLanguage = languagesUsed;
  } else {
    metadata.programmingLanguage = [];
  }

  if (authors.length > 0) {
    metadata.author = authors;
  } else {
    metadata.author = [];
  }

  // sort keys alphabetically
  metadata = Object.keys(metadata)
    .sort()
    .reduce((acc, key) => {
      acc[key] = metadata[key];
      return acc;
    }, {});

  await createCodeMetaFile(context, owner, repo, metadata);
}

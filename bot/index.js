import axios from "axios";
import human from "humanparser";
import yaml from "js-yaml";
import { MongoClient } from "mongodb";
import { nanoid } from "nanoid";
import licensesAvail from "./public/assets/data/licenses.json" assert { type: "json" };
import { renderIssues, createIssue } from "./utils/renderer/index.js";
import { getDefaultBranch } from "./utils/tools/index.js";

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

      const issueBody = await renderIssues(context, owner, repository, db);
      const title = `FAIR-BioRS Compliance Issues`;

      // Create an issue with the compliance issues
      // console.log("CREATING ISSUE");
      await createIssue(context, owner, repo, title, issueBody);
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

    const issueBody = await renderIssues(
      context,
      owner,
      repo,
      db,
      "",
      "",
      "",
      commits,
    );
    const title = `FAIR-BioRS Compliance Issues`;

    // Update the dashboard issue
    await createIssue(context, owner, repo, title, issueBody);
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

  app.on("pull_request.opened", async (context) => {
    console.log("PULL REQUEST OPENED");
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const prTitle = context.payload.pull_request.title;
    console.log(context);

    if (prTitle === "feat: ✨ LICENSE file added") {
      const prNumber = context.payload.pull_request.number;
      const prLink = context.payload.pull_request.html_url;
      // Check if the pull request is for the LICENSE file
      // If it is, close the issue that was opened for the license
      console.log("Issue opened for license file");
      const issueBody = await renderIssues(
        context,
        owner,
        repo,
        db,
        prTitle,
        prNumber,
        prLink,
      );
      await createIssue(
        context,
        owner,
        repo,
        "FAIR-BioRS Compliance Issues",
        issueBody,
      );
      // update dashboard issue with pr number
      // const issueTitle = `No license file found [${GITHUB_APP_NAME}]`;
      // await closeOpenIssue(context, owner, repo, issueTitle);
    }
  });
};

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

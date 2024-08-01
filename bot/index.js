// import { MongoClient } from "mongodb";
import * as express from "express";
import {
  renderIssues,
  createIssue,
  applyCWLTemplate,
} from "./utils/renderer/index.js";
import dbInstance from "./db.js";
import {
  checkEnvVariable,
  isRepoEmpty,
  verifyInstallationAnalytics,
  intializeDatabase,
} from "./utils/tools/index.js";
import { checkForLicense } from "./utils/license/index.js";
import { checkForCitation } from "./utils/citation/index.js";
import { checkForCodeMeta } from "./utils/codemeta/index.js";
import { getCWLFiles } from "./utils/cwl/index.js";

checkEnvVariable("MONGODB_URI");
checkEnvVariable("MONGODB_DB_NAME");
checkEnvVariable("GITHUB_APP_NAME");
checkEnvVariable("CODEFAIR_APP_DOMAIN");

// sourcery skip: use-object-destructuring
const GITHUB_APP_NAME = process.env.GITHUB_APP_NAME;

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default async (app, { getRouter }) => {
  // Connect to the MongoDB database
  await intializeDatabase();

  const db = dbInstance.getDb();
  const ping = db.collection("ping");

  await ping.insertOne({
    timestamp: Date.now(),
  });

  const router = getRouter("/");

  router.use(express.static("public"));

  router.get("/healthcheck", (req, res) => {
    res.status(200).send("Health check passed");
  });

  const issueTitle = `FAIR Compliance Dashboard`;

  // When the app is installed on an Org or Repository
  app.on("installation.created", async (context) => {
    const owner = context.payload.installation.account.login;

    // shows all repos you've installed the app on
    for (const repository of context.payload.repositories) {
      const repoName = repository.name;

      // Check if the installation is already in the database
      const emptyRepo = await isRepoEmpty(context, owner, repoName);

      // Check if entry in installation and analytics collection
      await verifyInstallationAnalytics(context, repository);

      const license = await checkForLicense(context, owner, repoName);
      const citation = await checkForCitation(context, owner, repository.name);
      const codemeta = await checkForCodeMeta(context, owner, repository.name);
      const cwl = await getCWLFiles(context, owner, repository.name); // This variable is an array of cwl files

      const subjects = {
        citation,
        codemeta,
        cwl,
        license,
      };

      const issueBody = await renderIssues(
        context,
        owner,
        repository,
        emptyRepo,
        subjects,
      );

      // Create an issue with the compliance issues
      await createIssue(context, owner, repository, issueTitle, issueBody);
    }
  });

  // When a new repository is added to the installation
  app.on("installation_repositories.added", async (context) => {
    // Event for when github app is alredy installed but a new repository is added
    const owner = context.payload.installation.account.login;

    for (const repository of context.payload.repositories_added) {
      // Loop through the added respotories
      const repoName = repository.name;

      const emptyRepo = await isRepoEmpty(context, owner, repoName);
      console.log("Empty Repo: ", emptyRepo);

      // Check the installation and analytics collections
      await verifyInstallationAnalytics(context, repository);

      const license = await checkForLicense(context, owner, repoName);
      const citation = await checkForCitation(context, owner, repository.name);
      const codemeta = await checkForCodeMeta(context, owner, repository.name);
      const cwl = await getCWLFiles(context, owner, repository.name); // This variable is an array of cwl files

      const subjects = {
        citation,
        codemeta,
        cwl,
        license,
      };

      const issueBody = await renderIssues(
        context,
        owner,
        repository,
        emptyRepo,
        subjects,
      );

      // Create an issue with the compliance issues
      await createIssue(context, owner, repository, issueTitle, issueBody);
    }
  });

  app.on("installation.deleted", async (context) => {
    const installationCollection = db.collection("installation");
    const licenseCollection = db.collection("licenseRequests");
    const metadataCollection = db.collection("codeMetadata");
    const cwlCollection = db.collection("cwlValidation");

    for (const repository of context.payload.repositories) {
      // Check if the installation is already in the database
      console.log(repository);
      const installation = await installationCollection.findOne({
        repositoryId: repository.id,
      });

      const license = await licenseCollection.findOne({
        repositoryId: repository.id,
      });

      const metadata = await metadataCollection.findOne({
        repositoryId: repository.id,
      });

      const cwl = await cwlCollection.findOne({
        repositoryId: repository.id,
      });

      if (installation) {
        // Remove from the database
        await installationCollection.deleteOne({
          repositoryId: repository.id,
        });
      }

      if (license) {
        await licenseCollection.deleteOne({
          repositoryId: repository.id,
        });
      }

      if (metadata) {
        await metadataCollection.deleteOne({
          repositoryId: repository.id,
        });
      }

      if (cwl) {
        await cwlCollection.deleteOne({
          repositoryId: repository.id,
        });
      }
    }
  });

  app.on("installation_repositories.removed", async (context) => {
    const installationCollection = db.collection("installation");
    const licenseCollection = db.collection("licenseRequests");
    const metadataCollection = db.collection("codeMetadata");
    const cwlCollection = db.collection("cwlValidation");

    for (const repository of context.payload.repositories_removed) {
      console.log(repository);
      const installation = await installationCollection.findOne({
        repositoryId: repository.id,
      });

      const license = await licenseCollection.findOne({
        repositoryId: repository.id,
      });

      const metadata = await metadataCollection.findOne({
        repositoryId: repository.id,
      });

      const cwl = await cwlCollection.findOne({
        repositoryId: repository.id,
      });

      if (installation) {
        // Remove from the database
        await installationCollection.deleteOne({
          repositoryId: repository.id,
        });
      }

      if (license) {
        await licenseCollection.deleteOne({
          repositoryId: repository.id,
        });
      }

      if (metadata) {
        await metadataCollection.deleteOne({
          repositoryId: repository.id,
        });
      }

      if (cwl) {
        await cwlCollection.deleteOne({
          repositoryId: repository.id,
        });
      }
    }
  });

  // When a push is made to a repository
  app.on("push", async (context) => {
    // Event for when a push is made to the repository (listens to all branches)
    const owner = context.payload.repository.owner.login;
    const repoName = context.payload.repository.name;
    const repository = context.payload.repository;

    // If push is not going to the default branch don't do anything
    if (
      context.payload.ref !==
      `refs/heads/${context.payload.repository.default_branch}`
    ) {
      console.log("Not pushing to default branch");
      return;
    }

    const emptyRepo = await isRepoEmpty(context, owner, repoName);

    await verifyInstallationAnalytics(context, repository);

    // Grab the commits being pushed
    const { commits } = context.payload;

    let license = await checkForLicense(context, owner, repoName);
    let citation = await checkForCitation(context, owner, repository.name);
    let codemeta = await checkForCodeMeta(context, owner, repository.name);
    const cwl = [];

    // Check if any of the commits added a LICENSE, CITATION, or codemeta file
    const gatheredCWLFiles = [];
    if (commits.length > 0 && commits?.added?.length > 0) {
      for (let i = 0; i < commits.length; i++) {
        for (let j = 0; i < commits.added.length; j++) {
          if (commits[i].added[j] === "LICENSE") {
            license = true;
            continue;
          }
          if (commits[i].added[j] === "CITATION.cff") {
            citation = true;
            continue;
          }
          if (commits[i].added[j] === "codemeta.json") {
            codemeta = true;
            continue;
          }
          const fileSplit = commits[i].added[j].split(".");
          if (fileSplit.includes("cwl")) {
            gatheredCWLFiles.push(commits[i].added[j]);
            continue;
          }
        }
        // TODO: This will only return the file name so request the file name and gather the file metadata
        for (let j = 0; i < commits.modified.length; j++) {
          const fileSplit = commits[i].modified[j].split(".");
          if (fileSplit.includes("cwl")) {
            gatheredCWLFiles.push(commits[i].modified[j]);
            continue;
          }
        }
      }
    }

    if (gatheredCWLFiles.length > 0) {
      // Begin requesting the file metadata for each file name
      for (let i = 0; i < gatheredCWLFiles.length; i++) {
        const cwlFile = await context.octokit.repos.getContent({
          owner,
          path: gatheredCWLFiles[i],
          repo: repoName,
        });

        cwl.push(cwlFile);
      }
    }

    const subjects = {
      citation,
      codemeta,
      cwl,
      license,
    };

    const issueBody = await renderIssues(
      context,
      owner,
      repository,
      emptyRepo,
      subjects,
    );

    // Update the dashboard issue
    await createIssue(context, owner, repository, issueTitle, issueBody);
  });

  // When a comment is made on an issue
  app.on("issue_comment.created", async (context) => {
    const owner = context.payload.repository.owner.login;
    const repoName = context.payload.repository.name;
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

      // Create a new file with the license on the new branch and open pull request
      await createLicense(context, owner, repoName, selection);
    }

    if (
      context.payload.issue.title ===
        `No citation file found [${GITHUB_APP_NAME}]` &&
      ["MEMBER", "OWNER"].includes(authorAssociation) &&
      userComment.includes(GITHUB_APP_NAME)
    ) {
      if (userComment.includes("Yes")) {
        // Gather the information for the CITATION.cff file
        await gatherCitationInfo(context, owner, repoName);
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
        await gatherCodeMetaInfo(context, owner, repoName);
      }
    }
  });

  // When a pull request is opened
  app.on("pull_request.opened", async (context) => {
    const owner = context.payload.repository.owner.login;
    const repository = context.payload.repository;
    const prTitle = context.payload.pull_request.title;
    const prLink = context.payload.pull_request.html_url;
    const definedPRTitles = [
      "feat: ✨ LICENSE file added",
      "feat: ✨ metadata files added",
    ];

    const emptyRepo = await isRepoEmpty(context, owner, repository.name);

    await verifyInstallationAnalytics(context, repository);

    if (definedPRTitles.includes(prTitle)) {
      const prInfo = {
        title: prTitle,
        link: prLink,
      };

      const license = await checkForLicense(context, owner, repository.name);
      const citation = await checkForCitation(context, owner, repository.name);
      const codemeta = await checkForCodeMeta(context, owner, repository.name);
      const cwl = await getCWLFiles(context, owner, repository.name); // This variable is an array of cwl files

      const subjects = {
        citation,
        codemeta,
        cwl,
        license,
      };
      // Check if the pull request is for the LICENSE file
      // If it is, close the issue that was opened for the license
      const issueBody = await renderIssues(
        context,
        owner,
        repository,
        emptyRepo,
        subjects,
        prInfo,
      );
      await createIssue(context, owner, repository, issueTitle, issueBody);
    }
  });

  app.on("issues.edited", async (context) => {
    const issueBody = context.payload.issue.body;

    if (issueBody.includes("<!-- @codefair-bot rerun-cwl-validation -->")) {
      const owner = context.payload.repository.owner.login;
      const repository = context.payload.repository;

      const cwl = await getCWLFiles(context, owner, repository.name);

      // Remove the section from the issue body starting from ## CWL Validations
      const slicedBody = issueBody.substring(
        0,
        issueBody.indexOf("## CWL Validations"),
      );

      const subjects = {
        cwl,
      };

      // This will also update the database
      const updatedIssueBody = await applyCWLTemplate(
        subjects,
        slicedBody,
        repository,
        owner,
        context,
      );

      // Update the issue with the new body
      await context.octokit.issues.update({
        body: updatedIssueBody,
        issue_number: context.payload.issue.number,
        owner,
        repo: repository.name,
      });
    }
  });
};

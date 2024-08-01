// import { MongoClient } from "mongodb";
import * as express from "express";
import { renderIssues, createIssue } from "./utils/renderer/index.js";
import dbInstance from "./db.js";
import {
  checkEnvVariable,
  isRepoEmpty,
  verifyInstallationAnalytics,
  intializeDatabase,
} from "./utils/tools/index.js";

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

      const issueBody = await renderIssues(
        context,
        owner,
        repository,
        emptyRepo,
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

      const issueBody = await renderIssues(
        context,
        owner,
        repository,
        emptyRepo,
      );

      // Create an issue with the compliance issues
      await createIssue(context, owner, repository, issueTitle, issueBody);
    }
  });

  app.on("installation.deleted", async (context) => {
    const installationCollection = db.collection("installation");

    for (const repository of context.payload.repositories) {
      // Check if the installation is already in the database
      const installation = await installationCollection.findOne({
        repositoryId: repository.id,
      });

      if (installation) {
        // Remove from the database
        await installationCollection.deleteOne({
          repositoryId: repository.id,
        });
      }
    }
  });

  app.on("installation_repositories.removed", async (context) => {
    const installationCollection = db.collection("installation");

    for (const repository of context.payload.repositories_removed) {
      const installation = await installationCollection.findOne({
        repositoryId: repository.id,
      });

      if (installation) {
        // Remove from the database
        await installationCollection.deleteOne({
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

    const issueBody = await renderIssues(
      context,
      owner,
      repository,
      emptyRepo,
      "",
      "",
      commits,
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
    const repoName = context.payload.repository.name;
    const repository = context.payload.repository;
    const prTitle = context.payload.pull_request.title;

    // Check if the repo name is the same as the one in the database

    const emptyRepo = await isRepoEmpty(context, owner, repoName);
    console.log("Empty Repo: ", emptyRepo);

    await verifyInstallationAnalytics(context, repository);

    if (prTitle === "feat: ✨ LICENSE file added") {
      const prLink = context.payload.pull_request.html_url;
      // Check if the pull request is for the LICENSE file
      // If it is, close the issue that was opened for the license
      const issueBody = await renderIssues(
        context,
        owner,
        repository,
        emptyRepo,
        prTitle,
        prLink,
      );
      await createIssue(context, owner, repository, issueTitle, issueBody);
    }
  });
};

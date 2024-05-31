import { MongoClient } from "mongodb";
import { renderIssues, createIssue } from "../../utils/renderer/index.js";
import { getDefaultBranch, checkEnvVariable } from "../../utils/tools/index.js";

checkEnvVariable("MONGODB_URI");
checkEnvVariable("MONGODB_DB_NAME");
checkEnvVariable("GITHUB_APP_NAME");
checkEnvVariable("DOPPLER_ENVIRONMENT");
checkEnvVariable("CODEFAIR_APP_DOMAIN");

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

  // When the app is installed on an Org or Repository
  app.on("installation.created", async (context) => {
    const owner = context.payload.installation.account.login;
    const installationCollection = db.collection("installation");

    // shows all repos you've installed the app on
    for (const repository of context.payload.repositories) {
      const repo = repository.name;
      const installationId = context.payload.installation.id;

      // Check if the installation is already in the database
      const installation = await installationCollection.findOne({
        installationId,
        repo,
        repositoryId: repository.id,
      });

      if (!installation) {
        // If the installation is not in the database, add it
        await installationCollection.insertOne({
          installationId,
          owner,
          repo,
          repositoryId: repository.id,
          timestamp: new Date(),
        });
      }

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

  // When a new repository is added to the installation
  app.on("installation_repositories.added", async (context) => {
    // Event for when github app is alredy installed but a new repository is added
    const owner = context.payload.installation.account.login;
    const installationId = context.payload.installation.id;
    const installationCollection = db.collection("installation");

    for (const repository of context.payload.repositories_added) {
      // Loop through the added respotories
      const repo = repository.name;

      // Check if the installation is already in the database
      const installation = await installationCollection.findOne({
        installationId,
        owner,
        repo,
        repositoryId: repository.id,
      });

      if (!installation) {
        // If the installation is not in the database, add it
        await installationCollection.insertOne({
          installationId,
          owner,
          repo,
          repositoryId: repository.id,
          timestamp: new Date(),
        });
      }

      const issueBody = await renderIssues(context, owner, repository, db);
      const title = `FAIR-BioRS Compliance Issues`;

      // Create an issue with the compliance issues
      // console.log("CREATING ISSUE");
      await createIssue(context, owner, repo, title, issueBody);
    }
  });

  // When a push is made to a repository
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

  // When a comment is made on an issue
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

  // When a pull request is opened
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
    }
  });
};

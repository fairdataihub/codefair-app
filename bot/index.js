"use strict";

import * as express from "express";
import { checkEnvVariable, intializeDatabase } from "./utils/tools/index.js";
import { logwatch } from "./utils/logwatch.js";
import dbInstance from "./db.js";

// Handler imports
import { registerInstallationHandlers } from "./handlers/installation.js";
import { registerPushHandler } from "./handlers/push.js";
import { registerPullRequestHandlers } from "./handlers/pullRequest.js";
import { registerIssueHandlers } from "./handlers/issue.js";

checkEnvVariable("GH_APP_NAME");
checkEnvVariable("CODEFAIR_APP_DOMAIN");

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default async (app, { getRouter }) => {
  // Connect to the database
  await intializeDatabase();

  const db = dbInstance;

  await db.ping.create({
    data: { timestamp: new Date() },
  });

  // Express routes
  const router = getRouter("/");
  router.use(express.static("public"));

  router.get("/healthcheck", (_req, res) => {
    logwatch.info("Requested healthcheck");
    res.status(200).send("Health check passed");
  });

  // for kamal
  router.get("/up", (_req, res) => {
    logwatch.info("Requested healthcheck");
    res.status(200).send("Health check passed");
  });

  // Register all event handlers
  registerInstallationHandlers(app, db);
  registerPushHandler(app, db);
  registerPullRequestHandlers(app, db);
  registerIssueHandlers(app, db);
};

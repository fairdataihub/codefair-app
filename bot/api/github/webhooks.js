/* eslint-disable @typescript-eslint/no-var-requires */
const { createNodeMiddleware, createProbot } = require("probot");

const app = require("../../index.js");
const privateKey = process.env.GH_APP_PRIVATE_KEY.replace(/\\n/g, "\n");

const probot = createProbot({
  overrides: {
    appId: process.env.APP_ID,
    privateKey,
    secret: process.env.WEBHOOK_SECRET,
  },
});

export default createNodeMiddleware(app, {
  probot,
  webhooksPath: "/api/github/webhooks",
});

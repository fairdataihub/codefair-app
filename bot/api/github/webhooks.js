/* eslint-disable @typescript-eslint/no-var-requires */
const { createNodeMiddleware, createProbot } = require("probot");

const app = require("../../index.js");

const probot = createProbot({
  overrides: {
    appId: process.env.APP_ID,
    privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
    secret: process.env.WEBHOOK_SECRET,
  },
});

export default createNodeMiddleware(app, {
  probot,
  webhooksPath: "/api/github/webhooks",
});

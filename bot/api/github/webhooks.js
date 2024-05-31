/* eslint-disable @typescript-eslint/no-var-requires */
const { createNodeMiddleware, createProbot } = require("probot");

const app = require("../../esapp");

const probot = createProbot();

export default createNodeMiddleware(app, {
  probot,
  webhooksPath: "/api/github/webhooks",
});

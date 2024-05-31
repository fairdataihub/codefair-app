import { createNodeMiddleware, createProbot } from "probot";
import app from "../../app";

const probot = createProbot();

export default createNodeMiddleware(app, {
  probot,
  webhooksPath: "/api/github/webhooks",
});

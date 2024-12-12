import { Server, Probot } from "probot";
import app from "./index.js";
import { logwatch } from "./utils/logwatch.js";
// import "dotenv/config";
const privateKey = process.env.GH_APP_PRIVATE_KEY.replace(/\\n/g, "\n");

async function startServer() {
  logwatch.info("Starting server...");

  const server = new Server({
    port: process.env.PORT || 3000,
    Probot: Probot.defaults({
      appId: process.env.GH_APP_ID,
      privateKey,
      secret: process.env.WEBHOOK_SECRET,
    }),
  });

  await server.load(app);

  server.start();
}

startServer();

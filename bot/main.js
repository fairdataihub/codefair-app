import { Server, Probot } from "probot";
import app from "./index.js";
// import "dotenv/config";

async function startServer() {
  const server = new Server({
    port: process.env.PORT || 3000,
    Probot: Probot.defaults({
      appId: process.env.GH_APP_ID,
      privateKey: process.env.PRIVATE_KEY,
      secret: process.env.WEBHOOK_SECRET,
    }),
  });

  await server.load(app);

  server.start();
}

startServer();

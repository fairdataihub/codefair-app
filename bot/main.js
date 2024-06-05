const { Server, Probot } = require("probot");
const app = require("./index.js");
// import "dotenv/config";

async function startServer() {
  const server = new Server({
    // log: console,
    Probot: Probot.defaults({
      appId: process.env.GITHUB_APP_ID,
      privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"),
      secret: process.env.WEBHOOK_SECRET,
    }),
  });

  await server.load(app);

  server.start();
}

startServer();

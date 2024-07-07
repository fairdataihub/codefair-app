/* eslint-disable no-console */
import "dotenv/config";

const main = () => {
  if (process.env.COOLIFY_API_TOKEN === undefined) {
    throw new Error("COOLIFY_API_TOKEN is not set");
  }

  // sourcery skip: use-object-destructuring
  const COOLIFY_API_TOKEN = process.env.COOLIFY_API_TOKEN;

  const BOT_DEPLOY_HOOK = process.env.BOT_DEPLOY_HOOK || "";

  console.log("Deploying bot...");

  fetch(BOT_DEPLOY_HOOK, {
    headers: {
      Authorization: `Bearer ${COOLIFY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  })
    .then((response) => response.json())
    .then((response) => {
      console.log(response);
      console.log("Deployment request sent!");
    })
    .catch((err) => console.error(err));

  const UI_DEPLOY_HOOK = process.env.UI_DEPLOY_HOOK || "";

  console.log("Deploying UI...");

  fetch(UI_DEPLOY_HOOK, {
    headers: {
      Authorization: `Bearer ${COOLIFY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  })
    .then((response) => response.json())
    .then((response) => {
      console.log(response);
      console.log("Deployment request sent!");
    })
    .catch((err) => console.error(err));
};

main();

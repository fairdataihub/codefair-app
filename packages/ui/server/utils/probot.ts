import { Probot } from "probot";
import app from "../app";

let probot: Probot;

export function useProbot(): Probot {

    console.log('useProbot')
    console.log(process.env.APP_ID)

  if (!probot) {
    probot = new Probot({
      appId: process.env.APP_ID,
      privateKey: process.env.PRIVATE_KEY,
      secret: process.env.WEBHOOK_SECRET,
    });
    probot.load(app);
  }
  return probot;
}
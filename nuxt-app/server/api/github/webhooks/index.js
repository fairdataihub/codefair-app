// import{ createNodeMiddleware, createProbot } from "probot";
// import {Probot} from "probot";

// import app from '@/server/app'

// export default defineEventHandler ( async (event) => {
//   // const probot = new Probot();

//   // return await probot.load(app);

//   return createNodeMiddleware(app, {
//     probot : createProbot(),
//     webhooksPath: "/api/webhooks",
//   });
// });

// export default createNodeMiddleware(app, {
//   probot : createProbot(),
//   webhooksPath: "/api/webhooks",
// });

// let probot;

// export default function useProbot() {
//     if (!probot) {
//       probot = new Probot({
//         appId: process.env.APP_ID,
//         privateKey: process.env.PRIVATE_KEY,
//         secret: process.env.WEBHOOK_SECRET,
//       });
//       probot.load(app);
//     }
//     return probot;
//   }

// import type { WebhookEventName } from "@octokit/webhooks-types";
// import { readRawBody } from "h3";

import { useProbot } from "@/server/utils/probot";
import { Probot } from "probot";

import app from "@/server/app";

export default eventHandler(async (event) => {

    console.log("event", event);

    const p =  new Probot({
        appId: process.env.APP_ID,
        privateKey: process.env.PRIVATE_KEY,
        secret: process.env.WEBHOOK_SECRET,
        webhookPath: "/api/github/webhooks",
    });

    await p.load(app);

    return p.webhooks.receive(event);

//   const eventName = event.headers.get("x-github-event") ;
//   const signatureSHA256 = event.headers.get("x-hub-signature-256");
//   const id = event.headers.get("x-github-delivery");
//   const body = await readRawBody(event);

//   if (!body || !signatureSHA256 || !id || !eventName) {
//     return new Response("Bad request", { status: 400 });
//   }

//   const probot = useProbot();

//   probot.webhooks.verifyAndReceive({
//     id,
//     name: eventName ,
//     payload: body,
//     signature: signatureSHA256,
//   });
});
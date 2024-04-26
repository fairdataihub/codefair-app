// import { Lucia } from "lucia";
// import { MongodbAdapter } from "@lucia-auth/adapter-mongodb"
// import { Collection } from "mongodb";
// import clientPromise from "./mongodb"

// const client = await clientPromise;
// await client.connect();

// const db = client.db();
// const User = db.collection("users") as Collection<UserDoc>;
// const Session = db.collection("sessions") as Collection<SessionDoc>;

// const adapter = new MongodbAdapter(Session, User);

// export const lucia = new Lucia(adapter, {
// 	sessionCookie: {
// 		attributes: {
// 			secure: !import.meta.dev
// 		}
// 	},
// 	getUserAttributes: (attributes) => {
// 		return {
// 			// attributes has the type of DatabaseUserAttributes
// 			githubId: attributes.github_id,
// 			username: attributes.username
// 		};
// 	}
// });

// declare module "lucia" {
//     interface Register {
//         Lucia: typeof lucia;
//         DatabaseUserAttributes: DatabaseUserAttributes;
//     }
// }

// interface DatabaseUserAttributes {
//     github_id: number;
//     username: string;
// }

// interface UserDoc {
//     _id: string;
// }

// interface SessionDoc {
//     _id: string;
//     expires_at: Date;
//     user_id: string;
// }

// import { Lucia } from "lucia";
// import { Collection } from "mongodb";
// import { MongodbAdapter } from "@lucia-auth/adapter-mongodb";
// import clientPromise from "./mongodb";
// import { GitHub } from "arctic";

// interface DatabaseUser {
// 	id: string;
// 	username: string;
// 	github_id: number;
// }

// interface UserDoc {
// 	_id: string;
// }

// interface SessionDoc {
// 	_id: string;
// 	expires_at: Date;
// 	user_id: string;
// }


// // import { webcrypto } from "crypto";
// // globalThis.crypto = webcrypto as Crypto;

// const client = await clientPromise;
// await client.connect();

// const db = client.db();
// const User = db.collection("users") as Collection<UserDoc>;
// const Session = db.collection("sessions") as Collection<SessionDoc>;

// const adapter = new MongodbAdapter(Session, User);

// export const lucia = new Lucia(adapter, {
// 	sessionCookie: {
// 		attributes: {
// 			secure: !import.meta.dev
// 		}
// 	},
// 	getUserAttributes: (attributes) => {
// 		return {
// 			username: attributes.username,
// 			githubId: attributes.github_id
// 		};
// 	}
// });

// declare module "lucia" {
// 	interface Register {
// 		Lucia: typeof lucia;
// 		DatabaseUserAttributes: Omit<DatabaseUser, "id">;
// 	}
// }

// // const config = useRuntimeConfig();

// export const github = new GitHub(process.env.GITHUB_CLIENT_ID!, process.env.GITHUB_CLIENT_SECRET!);

import { Lucia } from "lucia";
import { MongodbAdapter } from "@lucia-auth/adapter-mongodb";
import { Collection, MongoClient } from "mongodb";
import { GitHub } from "arctic";

if (!process.env.MONGODB_URI) {
    throw new Error("Please add your Mongo URI to .env.local");
}

// import { webcrypto } from "crypto"; // polyfill for nodejs crypto | can be removed when on node v20

// @ts-expect-error
// globalThis.crypto = webcrypto;

const client = new MongoClient(process.env.MONGODB_URI!);
client.connect();

const db = client.db();
const User = db.collection("users") as Collection<UserDoc>;
const Session = db.collection("sessions") as Collection<SessionDoc>;

const adapter = new MongodbAdapter(Session, User);

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		attributes: {
			secure: !import.meta.dev
		}
	},
	getUserAttributes: (attributes) => {
		return {
			username: attributes.username,
			githubId: attributes.github_id
		};
	}
});

declare module "lucia" {
	interface Register {
		Lucia: typeof lucia;
		DatabaseUserAttributes: Omit<DatabaseUser, "id">;
	}
}


interface DatabaseUser {
	id: string;
	username: string;
	github_id: number;
}


interface UserDoc {
	_id: string;
}

interface SessionDoc {
	_id: string;
	expires_at: Date;
	user_id: string;
}

export const github = new GitHub(process.env.GITHUB_CLIENT_ID!, process.env.GITHUB_CLIENT_SECRET!);

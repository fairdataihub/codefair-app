import { Lucia } from "lucia";
import { MongodbAdapter } from "@lucia-auth/adapter-mongodb";
// import { Collection, MongoClient } from "mongodb";
import { GitHub } from "arctic";
// import type { DatabaseUser } from "./mongodb";
// import type { Session, User } from "lucia";
import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  throw new Error("Please add your Mongo URI to .env");
}

await mongoose.connect(process.env.MONGODB_URI);

const userSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
  } as const,
  { _id: false },
);


const Users = mongoose.model(
  "users",
  userSchema
);

const sessionsSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    user_id: {
      type: String,
      required: true,
    },
    expires_at: {
      type: Date,
      required: true,
    },
  } as const,
  { _id: false },
);

const Sessions = mongoose.model(
  "sessions",
  sessionsSchema
);

// export let users = mongoose.models.users||mongoose.model("users", new mongoose.Schema({ _id: { type: String, required: true } }, { _id: false }));
// export let sessions = mongoose.models.sessions||mongoose.model("sessions", new mongoose.Schema({ _id: { type: String, required: true }, user_id: { type: String, required: true }, expires_at: { type: Date, required: true } }, { _id: false }));
export let users = mongoose.models.users||mongoose.model("users", userSchema);
export let sessions = mongoose.models.sessions||mongoose.model("sessions", sessionsSchema);
// export let session = mongoose.models.Session||mongoose.model("session", Session);

const adapter = new MongodbAdapter(
  mongoose.connection.collection("sessions"),
  mongoose.connection.collection("users"),
);

// const client = new MongoClient(process.env.MONGODB_URI!);
// client.connect();

// const db = client.db();
// const User = db.collection("user") as Collection<UserDoc>;
// const Session = db.collection("session") as Collection<SessionDoc>;
// const User = db.collection("users");
// const Session = db.collection("sessions");

// const adapter = new MongodbAdapter(Session, User);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: !import.meta.dev,
    },
  },
  getUserAttributes: (attributes) => {
    return {
      username: attributes.username,
      githubId: attributes.github_id,
    };
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: Omit<DatabaseUser, "id">;
  }
}
// interface UserDoc {
//   _id: String;
// }

// interface SessionDoc {
//   _id: String;
//   expires_at: Date;
//   user_id: String;
// }

export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
);

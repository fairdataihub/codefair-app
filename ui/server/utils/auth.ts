import { Lucia } from "lucia";
import { MongodbAdapter } from "@lucia-auth/adapter-mongodb";
import { GitHub } from "arctic";
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
    username: {
      type: String,
      required: true,
    },
    github_id: {
      type: String,
      required: true,
    },
    access_token: {
      type: String,
      required: false,
    },
  } as const,
  { _id: false },
);

mongoose.model("users", userSchema);

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
    access_token: {
      type: String,
      required: false,
    },
  } as const,
  { _id: false },
);

mongoose.model("sessions", sessionsSchema);

export const users =
  mongoose.models.users || mongoose.model("users", userSchema);
export const sessions =
  mongoose.models.sessions || mongoose.model("sessions", sessionsSchema);

const adapter = new MongodbAdapter(
  mongoose.connection.collection("sessions"),
  mongoose.connection.collection("users"),
);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: !import.meta.dev,
    },
  },
  getUserAttributes: (attributes) => {
    console.log("ATTRIBUTES: " + JSON.stringify(attributes));

    return {
      username: attributes.username,
      github_id: attributes.github_id,
      access_token: attributes.access_token,
    };
  },
  getSessionAttributes: (attributes) => {
    console.log("ATTRIBUTES: " + JSON.stringify(attributes));

    return attributes;
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: Omit<DatabaseUser, "id">;
  }
}

export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
);

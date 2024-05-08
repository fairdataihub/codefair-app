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
    username: {
      required: true,
      type: String,
    },
    _id: {
      required: true,
      type: String,
    },
    access_token: {
      required: false,
      type: String,
    },
    github_id: {
      required: true,
      type: String,
    },
  } as const,
  { _id: false },
);

mongoose.model("users", userSchema);

const sessionsSchema = new mongoose.Schema(
  {
    _id: {
      required: true,
      type: String,
    },
    access_token: {
      required: false,
      type: String,
    },
    expires_at: {
      required: true,
      type: Date,
    },
    user_id: {
      required: true,
      type: String,
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
  getSessionAttributes: (attributes) => {
    return {
      access_token: attributes.access_token,
    };
  },
  getUserAttributes: (attributes) => {
    return {
      username: attributes.username,
      access_token: attributes.access_token,
      github_id: attributes.github_id,
    };
  },
  sessionCookie: {
    attributes: {
      secure: !import.meta.dev,
    },
  },
});

declare module "lucia" {
  interface Register {
    DatabaseSessionAttributes: Omit<DatabaseSession, "id">;
    DatabaseUserAttributes: Omit<DatabaseUser, "id">;
    Lucia: typeof lucia;
  }
}

export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
);

import { Lucia } from "lucia";
import { GitHub } from "arctic";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { PrismaClient } from "@prisma/client";

const client = new PrismaClient();

const adapter = new PrismaAdapter(client.session, client.user);

interface DatabaseUserAttributes {
  username: string;
  access_token: string;
  github_id: number;
}

export const lucia = new Lucia(adapter, {
  getUserAttributes: (attributes) => {
    return {
      username: attributes.username,
      access_token: attributes.access_token,
      githubId: attributes.github_id,
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
    DatabaseUserAttributes: DatabaseUserAttributes;
    Lucia: typeof lucia;
  }
}

export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
);

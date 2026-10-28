import { Lucia } from "lucia";
import { GitHub } from "arctic";
import { PrismaAdapter } from "@lucia-auth/adapter-prisma";
import { PrismaClient } from "@prisma/client";
import { decryptToken, githubTokenContext } from "~/server/utils/tokenCrypto";

const client = new PrismaClient();

const adapter = new PrismaAdapter(client.session, client.user);

interface DatabaseUserAttributes {
  username: string;
  access_token: string;
  github_id: number;
  role: string;
}

export const lucia = new Lucia(adapter, {
  getUserAttributes: (attributes) => {
    return {
      username: attributes.username,
      // Stored encrypted. A token that cannot be decrypted reads as empty, so
      // protectRoute asks the user to sign in again and the row is overwritten.
      access_token:
        decryptToken(
          attributes.access_token,
          githubTokenContext(attributes.github_id),
        ) ?? "",
      github_id: attributes.github_id,
      // Read from the database on every request, so granting or revoking
      // admin applies on the user's next request.
      role: attributes.role,
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
  process.env.GH_OAUTH_CLIENT_ID!,
  process.env.GH_OAUTH_CLIENT_SECRET!,
);

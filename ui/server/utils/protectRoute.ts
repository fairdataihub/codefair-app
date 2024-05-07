/**
 * Middleware to check if the user is permitted to access the requested resource
 * The logged in user needs to have write/admin access to the github repository
 * Runs after the auth middleware
 */

import type { User, Session } from "lucia";

export default defineEventHandler(async (event) => {
  const user = event.context.user as User | null;
  const session = event.context.session as Session | null;

  if (!user || !session) {
    return event.node.res.writeHead(401).end();
  }
  const { owner, repo } = event.context.params as {
    owner: string;
    repo: string;
  };

  if (!owner || !repo) {
    return;
  }

  if (!user.access_token) {
    return event.node.res.writeHead(401).end();
  }

  const permissions = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/collaborators/${user.username}/permission`,
    {
      headers: {
        Authorization: `Bearer ${user.access_token}`,
      },
    },
  );

  if (!permissions.ok) {
    return event.node.res.writeHead(401).end();
  }

  const permissionsJson = await permissions.json();

  if (
    permissionsJson.permission !== "admin" &&
    permissionsJson.permission !== "write"
  ) {
    return event.node.res.writeHead(401).end();
  }

  return;
});

/**
 * Auth function to check that the logged in user is a Codefair admin.
 * Every /api/admin route calls this first. server/middleware/auth.ts applies
 * the same check to the whole /api/admin prefix as a second layer.
 * @param event - The event object
 * @returns The signed in admin user
 */

import type { H3Event } from "h3";
import type { User } from "lucia";

export default function requireAdmin(event: H3Event): User {
  protectRoute(event);

  const user = event.context.user as User;

  if (user.role !== "admin") {
    throw createError({
      statusCode: 403,
      statusMessage: "admin-only",
    });
  }

  return user;
}

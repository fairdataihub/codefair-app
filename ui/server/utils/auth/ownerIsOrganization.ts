import type { User } from "lucia";

const ownerIsOrganization = async (event: any, owner: string) => {
  if (!owner) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request. Missing owner in the URL params",
    });
  }

  const user = event.context.user as User;

  let ownerIsOrganization = false;

  if (user.username !== owner) {
    // Get the owner profile
    const ownerProfile = await fetch(`https://api.github.com/users/${owner}`, {
      headers: {
        Authorization: `Bearer ${user.access_token}`,
      },
    });

    if (!ownerProfile.ok) {
      throw createError({
        statusCode: 500,
        statusMessage: "failed-to-fetch-owner",
      });
    }

    const ownerProfileJson = await ownerProfile.json();

    // Check if the owner is an organization
    ownerIsOrganization = ownerProfileJson.type === "Organization";

    return ownerIsOrganization;
  }
};

export default ownerIsOrganization;

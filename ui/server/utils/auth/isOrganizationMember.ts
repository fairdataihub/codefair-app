import type { User } from "lucia";
const { GITHUB_OAUTH_APP_ID } = process.env;

const isOrganizationMember = async (
  event: any,
  orgStatus: boolean | undefined,
  owner: string,
) => {
  const user = event.context.user as User;

  if (orgStatus) {
    // Check organization membership for a user
    // https://docs.github.com/en/rest/orgs/members?apiVersion=2022-11-28#check-organization-membership-for-a-user

    const isOrgMember = await fetch(
      `https://api.github.com/orgs/${owner}/members/${user.username}`,
      {
        headers: {
          Authorization: `Bearer ${user.access_token}`,
        },
      },
    );

    if (!isOrgMember.ok) {
      const statusMessage = `unauthorized-org-access|https://github.com/orgs/${owner}/policies/applications/${GITHUB_OAUTH_APP_ID}`;

      throw createError({
        statusCode: 403,
        statusMessage,
      });
    }
  } else {
    throw createError({
      statusCode: 403,
      statusMessage: "unauthorized-account-access",
    });
  }
};

export default isOrganizationMember;
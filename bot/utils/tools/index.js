export async function getDefaultBranch(context, owner, repo) {
  let defaultBranch;

  try {
    defaultBranch = await context.octokit.repos.getBranch({
      branch: context.payload.repository.default_branch,
      owner,
      repo,
    });

    return defaultBranch;
  } catch (error) {
    console.log("Error getting the default branch");
    console.log(error);
  }
}

export async function verifyFirstIssue(context, owner, repo, title) {
  // If there is an issue that has been created by the bot, (either opened or closed) don't create another issue
  const issues = await context.octokit.issues.listForRepo({
    creator: `${GITHUB_APP_NAME}[bot]`,
    owner,
    repo,
    state: "all",
  });

  if (issues.data.length > 0) {
    // iterate through issues to see if there is an issue with the same title
    let noIssue = false;
    for (let i = 0; i < issues.data.length; i++) {
      if (issues.data[i].title === title) {
        console.log("Issue already exists, will not recreate");
        noIssue = true;
        break;
      }
    }

    if (!noIssue) {
      return false;
    } else {
      return true;
    }
  }
}

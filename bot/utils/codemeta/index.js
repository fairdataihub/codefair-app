export async function checkForCodeMeta(context, owner, repo) {
  try {
    await context.octokit.rest.repos.getContent({
      owner,
      path: "codemeta.json",
      repo,
    });

    return true;
  } catch (error) {
    return false;
  }
}

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

export async function gatherCodeMetaInfo(context, owner, repo) {
  // Gather metadata from the repo to create a codemeta.json file
  const repoData = await context.octokit.repos.get({
    owner,
    repo,
  });

  // Get the languages used in the repo
  console.log(repoData.data);

  const languagesUsed = await gatherLanguagesUsed(context, owner, repo);
  const authors = await gatherRepoAuthors(context, owner, repo, "codemeta");
  const codeRepository = repoData.data.html_url;
  const dataCreated = repoData.data.created_at;
  const dataModified = repoData.data.updated_at;
  const keywords = repoData.data.topics;
  const license = repoData.data.license.spdx_id;
  const { description } = repoData.data;
  const identifier = repoData.data.id;
  const name = repoData.data.full_name;
  let issueTracker = repoData.data.issues_url;
  // TODO: See if those two api calls are needed

  let metadata = {
    "@context": "https://doi.org/10.5063/schema/codemeta-2.0",
    "@type": "SoftwareSourceCode",
  };

  if (license !== null || license !== "") {
    metadata.license = `https://spdx.org/licenses/${license}`;
  }

  if (codeRepository !== null || codeRepository !== "") {
    metadata.codeRepository = codeRepository;
  }

  if (dataCreated !== null || dataCreated !== "") {
    metadata.dateCreated = dataCreated.split("T")[0];
  }

  if (dataModified !== null || dataModified !== "") {
    metadata.dateModified = dataModified.split("T")[0];
  }

  if (keywords.length > 0) {
    metadata.keywords = keywords;
  } else {
    metadata.keywords = [];
  }

  if (description !== null || description !== "") {
    metadata.description = description;
  }

  if (identifier !== null || identifier !== "") {
    metadata.identifier = identifier;
  }

  if (name !== null || name !== "") {
    metadata.name = name;
  }

  if (issueTracker !== null || issueTracker !== "") {
    // Remove the {/number} from the issue tracker url
    issueTracker = issueTracker.replace("{/number}", "");
    metadata.issueTracker = issueTracker;
  }

  if (languagesUsed.length > 0) {
    metadata.programmingLanguage = languagesUsed;
  } else {
    metadata.programmingLanguage = [];
  }

  if (authors.length > 0) {
    metadata.author = authors;
  } else {
    metadata.author = [];
  }

  // sort keys alphabetically
  metadata = Object.keys(metadata)
    .sort()
    .reduce((acc, key) => {
      acc[key] = metadata[key];
      return acc;
    }, {});

  await createCodeMetaFile(context, owner, repo, metadata);
}

export async function createCodeMetaFile(context, owner, repo, codeMetaText) {
  // Create a new branch
  const branch = `codemeta-${Math.floor(Math.random() * 9999)}`;

  // Get the default branch of the repo
  const defaultBranch = await getDefaultBranch(context, owner, repo);
  const defaultBranchName = defaultBranch.data.name;

  // Create a new branch based off the default branch
  await context.octokit.git.createRef({
    owner,
    ref: `refs/heads/${branch}`,
    repo,
    sha: defaultBranch.data.commit.sha,
  });

  // Create a new file
  await context.octokit.repos.createOrUpdateFileContents({
    branch,
    content: Buffer.from(JSON.stringify(codeMetaText, null, 2)).toString(
      "base64",
    ),
    message: `feat: ✨ add codemeta.json file`,
    owner,
    path: "codemeta.json",
    repo,
  });

  // Create a PR with the branch
  await context.octokit.pulls.create({
    title: "feat: ✨ codemeta.json created for repo",
    base: defaultBranchName,
    body: `Resolves #${context.payload.issue.number}`,
    head: branch,
    maintainer_can_modify: true,
    owner,
    repo,
  });

  // Get the link to the codemeta.json file in the branch created
  let codemetaLink = await context.octokit.repos.getContent({
    owner,
    path: "codemeta.json",
    ref: `refs/heads/${branch}`,
    repo,
  });

  codemetaLink = codemetaLink.data.html_url;
  const editLink = codemetaLink.replace("blob", "edit");

  await context.octokit.issues.createComment({
    body:
      "```json\n" +
      JSON.stringify(codeMetaText, null, 2) +
      "\n```" +
      `\n\nHere is the information I was able to gather from this repo. If you would like to add more please follow the link to edit using the GitHub UI. Once you are satisfied with the codemeta.json you can merge the pull request and I will close this issue.
      \n\n[Edit codemeta.json](${editLink})`,
    issue_number: context.payload.issue.number,
    owner,
    repo,
  });
}

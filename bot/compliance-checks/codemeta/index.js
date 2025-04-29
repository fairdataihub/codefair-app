import { gatherRepoAuthors } from "../../utils/tools/index.js";

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

  let metadata = {
    "@context": "https://w3id.org/codemeta/3.0",
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
      "base64"
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

/**
 * * Applies the codemeta template to the base template
 *
 * @param {object} subjects - The subjects to check for
 * @param {string} baseTemplate - The base template to add to
 * @param {*} db - The database
 * @param {object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 *
 * @returns {string} - The updated base template
 */
export async function applyCodemetaTemplate(
  subjects,
  baseTemplate,
  db,
  repository,
  owner
) {
  if (!subjects.codemeta && subjects.license) {
    // License was found but no codemeta.json exists
    const identifier = createId();

    let badgeURL = `${CODEFAIR_DOMAIN}/add/codemeta/${identifier}`;

    const codemetaCollection = db.codeMetadata;
    const existingCodemeta = await codemetaCollection.findUnique({
      repository_id: repository.id,
    });

    if (!existingCodemeta) {
      // Entry does not exist in db, create a new one
      const newDate = new Date();
      await codemetaCollection.create({
        created_at: newDate,
        identifier,
        owner,
        repo: repository.name,
        repository_id: repository.id,
        updated_at: newDate,
      });
    } else {
      // Get the identifier of the existing codemeta request
      await codemetaCollection.update({
        data: { updated_at: new Date() },
        where: { repository_id: repository.id },
      });
      badgeURL = `${CODEFAIR_DOMAIN}/add/codemeta/${existingCodemeta.identifier}`;
    }

    const codemetaBadge = `[![Citation](https://img.shields.io/badge/Add_Codemeta-dc2626.svg)](${badgeURL})`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file was not found in the repository. To make your software reusable a codemeta.json is expected at the root level of your repository.\n\n${codemetaBadge}`;
  } else if (subjects.codemeta && subjects.license) {
    // License was found and codemetata.json also exists
    // Then add codemeta section mentioning it will be checked after license is added

    if (!existingLicense) {
      // Entry does not exist in db, create a new one
      const newDate = new Date();
      await licenseCollection.create({
        data: {
          created_at: newDate,
          identifier,
          owner,
          repo: repository.name,
          repository_id: repository.id,
          updated_at: newDate,
        },
      });
    } else {
      // Get the identifier of the existing license request
      // Update the database
      await licenseCollection.update({
        data: { updated_at: new Date() },
        where: { repository_id: repository.id },
      });
      badgeURL = `${CODEFAIR_DOMAIN}/add/license/${existingLicense.identifier}`;
    }
    const codemetaBadge = `[![Citation](https://img.shields.io/badge/Edit_Codemeta-dc2626.svg)](${badgeURL})`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file found in the repository.\n\n${codemetaBadge}`;
  } else {
    // codemeta and license does not exist
    const codemetaBadge = `![CodeMeta](https://img.shields.io/badge/Codemeta_Not_Checked-fbbf24)`;
    baseTemplate += `\n\n## codemeta.json\n\nA codemeta.json file will be checked after a license file is added. To make your software reusable a codemeta.json is expected at the root level of your repository.\n\n${codemetaBadge}`;
  }

  return baseTemplate;
}

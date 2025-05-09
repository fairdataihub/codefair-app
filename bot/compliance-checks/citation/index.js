import { gatherRepoAuthors } from "../../utils/tools/index.js";

export async function checkForCitation(context, owner, repo) {
  try {
    await context.octokit.rest.repos.getContent({
      owner,
      path: "CITATION.cff",
      repo,
    });

    return true;
  } catch (error) {
    return false;
  }
}

// Currently not being used
async function gatherCitationInfo(context, owner, repo) {
  // Verify there is no PR open already for the CITATION.cff file
  const openPR = await context.octokit.pulls.list({
    owner,
    repo,
    state: "open",
  });

  let prExists = false;

  for (const pr of openPR.data) {
    if (pr.title === "feat: ✨ CITATION.cff created for repo") {
      prExists = true;
    }
  }

  if (prExists) {
    await context.octokit.issues.createComment({
      body: `A PR for the CITATION.cff file already exists here: ${openPR.data[0].html_url}`,
      issue_number: context.payload.issue.number,
      owner,
      repo,
    });
    return;
  }

  // Get the release data of the repo
  const releases = await context.octokit.repos.listReleases({
    owner,
    repo,
  });

  // Get the metadata of the repo
  const repoData = await context.octokit.repos.get({
    owner,
    repo,
  });

  // Get authors of repo
  const parsedAuthors = await gatherRepoAuthors(
    context,
    owner,
    repo,
    "citation"
  );
  // Get DOI of repo (if it exists)
  const doi = await getDOI(context, owner, repo);
  // Get the repo description
  const abstract = repoData.data.description;
  // Get the license of the repo
  const licenseName = repoData.data.license;

  // date released is dependent on whether the repo has a release data (if not, use the created date)
  let dateReleased;
  if (repoData.data.released_at) {
    dateReleased = repoData.data.released_at;
  } else {
    // The date needs to be in this pattern:
    dateReleased = new Date().toISOString().split("T")[0];
  }

  // Get the homepage of the repo
  let url;
  if (repoData.data.homepage != null) {
    url = repoData.data.homepage;
  }

  // Get the keywords of the repo
  let keywords = [];
  if (repoData.data.topics != null && repoData.data.topics.length > 0) {
    keywords = repoData.data.topics;
  }

  // Begin creating json for CITATION.cff file
  let citationObj = {
    title: repoData.data.name,
    "cff-version": "1.2.0",
    identifiers: [
      {
        description: "DOI for this software's record on Zenodo.",
        type: "doi",
      },
    ],
    message: "If you use this software, please cite it as below.",
    "repository-code": repoData.data.html_url,
    type: "software",
  };

  if (doi[0]) {
    citationObj.identifiers[0].value = doi[1];
  } else {
    citationObj.identifiers[0].value = "";
  }

  if (parsedAuthors.length > 0) {
    citationObj.authors = parsedAuthors;
  }

  if (licenseName !== null) {
    citationObj.license = licenseName.spdx_id;
  }

  if (abstract !== null) {
    citationObj.abstract = abstract;
  } else {
    citationObj.abstract = "";
  }

  if (keywords.length > 0) {
    citationObj.keywords = keywords;
  }

  if (url !== null && url !== "") {
    citationObj.url = url;
  } else {
    citationObj.url = repoData.data.html_url;
  }

  if (dateReleased !== null && dateReleased !== "") {
    citationObj["date-released"] = dateReleased;
  } else {
    citationObj["date-released"] = "";
  }

  // sort keys alphabetically
  citationObj = Object.keys(citationObj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = citationObj[key];
      return acc;
    }, {});

  const citationTemplate = yaml.dump(citationObj);

  await createCitationFile(context, owner, repo, citationTemplate);
}

export async function createCitationFile(context, owner, repo, citationText) {
  // Here we take the citation text passed as a parameter
  // It could from probot's initial gathering or an updated version from the user

  // Create a new branch
  const branch = `citation-${Math.floor(Math.random() * 9999)}`;

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
    content: Buffer.from(citationText).toString("base64"),
    message: `feat: ✨ add CITATION.cff file`,
    owner,
    path: "CITATION.cff",
    repo,
  });

  // Create a PR with the branch
  await context.octokit.pulls.create({
    title: "feat: ✨ CITATION.cff create for repo",
    base: defaultBranchName,
    body: `Resolves #${context.payload.issue.number}`,
    head: branch,
    maintainer_can_modify: true,
    owner,
    repo,
  });

  // Get the link to the CITATION.cff file in the branch created
  let citationLink = await context.octokit.repos.getContent({
    owner,
    path: "CITATION.cff",
    ref: `refs/heads/${branch}`,
    repo,
  });

  citationLink = citationLink.data.html_url;
  const editLink = citationLink.replace("blob", "edit");

  await context.octokit.issues.createComment({
    body:
      "```yaml\n" +
      citationText +
      "\n```" +
      `\n\nHere is the information I was able to gather from this repo. If you would like to add more please follow the link to edit using the GitHub UI. Once you are satisfied with the CITATION.cff you can merge the pull request and I will close this issue.
      \n\n[Edit CITATION.cff](${editLink})`,
    issue_number: context.payload.issue.number,
    owner,
    repo,
  });
}

/**
 * * Applies the citation template to the base template
 *
 * @param {object} subjects - The subjects to check for
 * @param {string} baseTemplate - The base template to add to
 * @param {*} db - The database
 * @param {object} repository - The GitHub repository information
 * @param {string} owner - The owner of the repository
 *
 * @returns {string} - The updated base template
 */
export async function applyCitationTemplate(
  subjects,
  baseTemplate,
  db,
  repository,
  owner
) {
  if (!subjects.citation && subjects.license) {
    // License was found but no citation file was found
    const identifier = createId();

    let badgeURL = `${CODEFAIR_DOMAIN}/add/citation/${identifier}`;
    const citationCollection = db.citationRequests;
    const existingCitation = await citationCollection.fineUnique({
      where: {
        repository_id: repository.id,
      },
    });

    if (!existingCitation) {
      // Entry does not exist in db, create a new one
      const newDate = new Date();
      await citationCollection.create({
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
      // Get the identifier of the existing citation request
      await citationCollection.updateOne({
        data: { updated_at: new Date() },
        where: { repository_id: repository.id },
      });
      badgeURL = `${CODEFAIR_DOMAIN}/add/citation/${existingCitation.identifier}`;
    }

    const citationBadge = `[![Citation](https://img.shields.io/badge/Add_Citation-dc2626.svg)](${badgeURL})`;
    baseTemplate += `\n\n## CITATION.cff\n\nA CITATION.cff file was not found in the repository. The [FAIR-BioRS guidelines](https://fair-biors.org/docs/guidelines) suggests to include that file for providing metadata about your software and make it FAIR.\n\n${citationBadge}`;
  } else if (subjects.citation && subjects.license) {
    // Citation file was found and license was found
    const citationBadge = `![Citation](https://img.shields.io/badge/Citation_Added-6366f1.svg)`;
    baseTemplate += `\n\n## CITATION.cff\n\nA CITATION.cff file found in the repository.\n\n${citationBadge}`;
  } else {
    // Citation file was not found and license was not found
    const citationBadge = `![Citation](https://img.shields.io/badge/Citation_Not_Checked-fbbf24)`;
    baseTemplate += `\n\n## CITATION.cff\n\nA CITATION.cff file will be checked after a license file is added. The [FAIR-BioRS guidelines](https://fair-biors.org/docs/guidelines) suggests to include that file for providing metadata about your software and make it FAIR.\n\n${citationBadge}`;
  }

  return baseTemplate;
}

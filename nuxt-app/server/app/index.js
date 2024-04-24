// const axios = require("axios");
// const human = require("humanparser");
// const licensesAvail = require("./data/licenses.json");
// const yaml = require("js-yaml");

import axios from "axios";
import human from "humanparser";
import licensesAvail from "../data/licenses.json";
import yaml from "js-yaml";

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
export default function (app) {
  console.log("event triggered");

  // Opens a PR every time someone installs your app for the first time
  // On adding the app to a repo
  app.on("installation.created", async (context) => {
    const owner = context.payload.installation.account.login;

    // shows all repos you've installed the app on
    for (const repository of context.payload.repositories) {
      const repo = repository.name;
      const license = await checkForLicense(context, owner, repo);
      const citation = await checkForCitation(context, owner, repo);
      const codemeta = await checkForCodeMeta(context, owner, repo);

      if (!license) {
        console.log("No license file found [codefair-app]");
        // If issue has been created, create one
        const title = "No license file found [codefair-app]";
        const body = `To make your software reusable a license file is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). No such file was found. It is important to choose your license early since it will affect your software's dependencies. If you would like me to add a license file for you, please reply here with the identifier of the license you would like from the [SPDX License List](https://spdx.org/licenses/)  (e.g., comment “@codefair-app MIT” for the MIT license). I will then create a new branch with the corresponding license file and open a pull request for you to review and approve. You can also add a license file yourself and I will close this issue when I detect it on the main branch. If you need help with choosing a license, you can check out https://choosealicense.com.`;
        const verify = await verifyFirstIssue(context, owner, repo, title);
        if (!verify) {
          await createIssue(context, owner, repo, title, body);
        }
      } else {
        const title = "No license file found [codefair-app]";
        await closeOpenIssue(context, owner, repo, title);
      }

      if (!citation && license) {
        // License was found but no citation file was found
        const title = "No citation file found [codefair-app]";
        const body = `No CITATION.cff file was found at the root of your repository. The [FAIR-BioRS guidelines](https://fair-biors.org/docs/guidelines) suggests to include that file for providing metadata about your software and make it FAIR.
          If you would like me to generate a CITATION.cff file for you, please reply with "@codefair-app Yes". I will gather the information required in the CITATION.cff that I can find automatically from your repository and include that information in my reply for your review and edit. You can also add a CITATION.cff file yourself and I will close this issue when I detect it on the main branch.
          `;
        const verify = await verifyFirstIssue(context, owner, repo, title);
        if (!verify) {
          await createIssue(context, owner, repo, title, body);
        }
      } else if (citation) {
        const title = "No citation file found [codefair-app]";
        await closeOpenIssue(context, owner, repo, title);
      }

      if (!codemeta && license) {
        // License was found but no codemeta.json exists
        const title = "No codemeta.json file found [codefair-app]";
        const body = `To make your software reusable a codemetada.json is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). No such file was found. It is important to provide software metadata to transfer metadata between software authors, repositories, and others, for the purposes of archiving, sharing, indexing, citing and discovering software. If you would like me to generate a codemeta.json file for you, please reply here with '@codefair-app Yes'. I will gather the information required in the codemeta.json that I can find automatically from your repository and include that information in my reply for your edit or approve. You can also add a codemeta.json file yourself and I will close this issue when I detect it on the main branch.`;
        const verify = await verifyFirstIssue(context, owner, repo, title);
        if (!verify) {
          await createIssue(context, owner, repo, title, body);
        }
      } else if (codemeta) {
        const title = "No codemeta.json file found [codefair-app]";
        await closeOpenIssue(context, owner, repo, title);
      }
    }
  });

  app.on("installation_repositories.added", async (context) => {
    // Event for when github app is alredy installed but a new repository is added
    const owner = context.payload.installation.account.login;

    for (const repository of context.payload.repositories_added) {
      // Loop through the added respotories
      const repo = repository.name;
      const license = await checkForLicense(context, owner, repo);
      const citation = await checkForCitation(context, owner, repo);
      const codemeta = await checkForCodeMeta(context, owner, repo);

      if (!license) {
        // No license was found, make an issue if one was never made before
        // If the issue was close, don't make another
        console.log("No license file found [codefair-app]");
        const title = "No license file found [codefair-app]";
        const body = `To make your software reusable a license file is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). No such file was found. It is important to choose your license early since it will affect your software's dependencies. If you would like me to add a license file for you, please reply here with the identifier of the license you would like from the [SPDX License List](https://spdx.org/licenses/)  (e.g., comment “@codefair-app MIT” for the MIT license). I will then create a new branch with the corresponding license file and open a pull request for you to review and approve. You can also add a license file yourself and I will close this issue when I detect it on the main branch. If you need help with choosing a license, you can check out https://choosealicense.com.`;
        let verify = await verifyFirstIssue(context, owner, repo, title);
        if (!verify) {
          await createIssue(context, owner, repo, title, body);
        }
      } else {
        // Check if issue is open and close it
        const title = "No license file found [codefair-app]";
        await closeOpenIssue(context, owner, repo, title);
      }

      if (!citation && license) {
        const title = "No citation file found [codefair-app]";
        const body = `No CITATION.cff file was found at the root of your repository. The [FAIR-BioRS guidelines](https://fair-biors.org/docs/guidelines) suggests to include that file for providing metadata about your software and make it FAIR.
          If you would like me to generate a CITATION.cff file for you, please reply with "@codefair-app Yes". I will gather the information required in the CITATION.cff that I can find automatically from your repository and include that information in my reply for your review and edit. You can also add a CITATION.cff file yourself and I will close this issue when I detect it on the main branch.
          `;
        let verify = await verifyFirstIssue(context, owner, repo, title);
        if (!verify) {
          await createIssue(context, owner, repo, title, body);
        }
      }

      if (!codemeta && license) {
        // License was found but no codemeta.json exists
        const title = "No codemeta.json file found [codefair-app]";
        const body = `To make your software reusable a codemetada.json is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). No such file was found. It is important to provide software metadata to transfer metadata between software authors, repositories, and others, for the purposes of archiving, sharing, indexing, citing and discovering software. If you would like me to generate a codemeta.json file for you, please reply here with '@codefair-app Yes'. I will gather the information required in the codemeta.json that I can find automatically from your repository and include that information in my reply for your edit or approve. You can also add a codemeta.json file yourself and I will close this issue when I detect it on the main branch.`;
        const verify = await verifyFirstIssue(context, owner, repo, title);
        if (!verify) {
          await createIssue(context, owner, repo, title, body);
        }
      }
    }
  });

  app.on("push", async (context) => {
    console.log("Push event triggered");
    console.log(context.payload);
    // Event for when a push is made to the repository (listens to all branches)
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    // Check if push is going to the default branch
    const default_branch = await getDefaultBranch(context, owner, repo);

    // If push is not going to the default branch don't do anything
    if (context.payload.ref != `refs/heads/${default_branch.data.name}`) {
      console.log("Not pushing to default branch");
      return;
    }

    // Grab the commits being pushed
    const { commits } = context.payload;
    let license = await checkForLicense(context, owner, repo);
    let citation = await checkForCitation(context, owner, repo);
    let codemeta = await checkForCodeMeta(context, owner, repo);

    // Check if any of the commits added a LICENSE, CITATION, or codemeta file
    if (commits.length > 0) {
      let licenseBeingPushed = false;
      let citationBeingPushed = false;
      let codeMetaBeingPushed = false;
      for (let i = 0; i < commits.length; i++) {
        if (commits[i].added.includes("LICENSE")) {
          console.log("LICENSE file added with this push");
          licenseBeingPushed = true;
          continue;
        }
        if (commits[i].added.includes("CITATION.cff")) {
          console.log("CITATION.cff file added with this push");
          citationBeingPushed = true;
          continue;
        }
        if (commits[i].added.includes("codemeta.json")) {
          console.log("codemeta.json file added with this push");
          codeMetaBeingPushed = true;
          continue;
        }
        if (licenseBeingPushed) {
          license = true;
        }
        if (citationBeingPushed) {
          citation = true;
        }
        if (codeMetaBeingPushed) {
          codemeta = true;
        }
      }
    }

    if (!license) {
      console.log("No license file found (push)");
      const title = "No license file found [codefair-app]";
      const body = `To make your software reusable a license file is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). No such file was found. It is important to choose your license early since it will affect your software's dependencies. If you would like me to add a license file for you, please reply here with the identifier of the license you would like from the [SPDX License List](https://spdx.org/licenses/)  (e.g., comment “@codefair-app MIT” for the MIT license). I will then create a new branch with the corresponding license file and open a pull request for you to review and approve. You can also add a license file yourself and I will close this issue when I detect it on the main branch. If you need help with choosing a license, you can check out https://choosealicense.com.`;
      let verify = await verifyFirstIssue(context, owner, repo, title);
      if (!verify) {
        await createIssue(context, owner, repo, title, body);
      }
    } else {
      // License was found, close the issue if one was created
      const title = "No license file found [codefair-app]";
      await closeOpenIssue(context, owner, repo, title);
    }

    if (!citation && license) {
      const title = "No citation file found [codefair-app]";
      const body = `No CITATION.cff file was found at the root of your repository. The [FAIR-BioRS guidelines](https://fair-biors.org/docs/guidelines) suggests to include that file for providing metadata about your software and make it FAIR.
      If you would like me to generate a CITATION.cff file for you, please reply with "@codefair-app Yes". I will gather the information required in the CITATION.cff that I can find automatically from your repository and include that information in my reply for your review and edit. You can also add a CITATION.cff file yourself and I will close this issue when I detect it on the main branch.
      `;
      let verify = await verifyFirstIssue(context, owner, repo, title);
      if (!verify) {
        await createIssue(context, owner, repo, title, body);
      }
    } else if (citation) {
      const title = "No citation file found [codefair-app]";
      await closeOpenIssue(context, owner, repo, title);
    }

    if (!codemeta && license) {
      // License was found but no codemeta.json exists
      const title = "No codemeta.json file found [codefair-app]";
      const body = `To make your software reusable a codemetada.json is expected at the root level of your repository, as recommended in the [FAIR-BioRS Guidelines](https://fair-biors.org). No such file was found. It is important to provide software metadata to transfer metadata between software authors, repositories, and others, for the purposes of archiving, sharing, indexing, citing and discovering software. If you would like me to generate a codemeta.json file for you, please reply here with '@codefair-app Yes'. I will gather the information required in the codemeta.json that I can find automatically from your repository and include that information in my reply for your edit or approve. You can also add a codemeta.json file yourself and I will close this issue when I detect it on the main branch.`;
      const verify = await verifyFirstIssue(context, owner, repo, title);
      if (!verify) {
        await createIssue(context, owner, repo, title, body);
      }
    } else if (codemeta) {
      const title = "No codemeta.json file found [codefair-app]";
      await closeOpenIssue(context, owner, repo, title);
    }
  });

  app.on("issue_comment.created", async (context) => {
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const userComment = context.payload.comment.body;
    const authorAssociation = context.payload.comment.author_association;
    console.log("should all be true above to move forward");

    if (
      context.payload.issue.title === "No license file found [codefair-app]" &&
      ["MEMBER", "OWNER"].includes(authorAssociation) &&
      userComment.includes("codefair-app")
    ) {
      // Check the comment to see if the user has replied with a license
      const splitComment = userComment.split(" ");
      const selection = splitComment[splitComment.indexOf("@codefair-app") + 1];

      console.log("License user responded with: " + selection);

      // Create a new file with the license on the new branch and open pull request
      await createLicense(context, owner, repo, selection);
    }

    if (
      context.payload.issue.title === "No citation file found [codefair-app]" &&
      ["MEMBER", "OWNER"].includes(authorAssociation) &&
      userComment.includes("codefair-app")
    ) {

      if (userComment.includes("Yes")) {
        // Gather the information for the CITATION.cff file
        await gatherCitationInfo(context, owner, repo);
      }
    }

    if (context.payload.issue.title === "No codemeta.json file found [codefair-app]" &&
    ["MEMBER", "OWNER"].includes(authorAssociation) &&
    userComment.includes("codefair-app")) {
      if (userComment.includes("Yes")) {
        // Gather the information for the codemeta.json file
        await gatherCodeMetaInfo(context, owner, repo);
      }
    }
  });
};

async function getDefaultBranch(context, owner, repo) {
  let default_branch;

  try {
    default_branch = await context.octokit.repos.getBranch({
      owner,
      repo,
      branch: context.payload.repository.default_branch,
    });

    return default_branch;
  } catch (error) {
    console.log("Error getting the default branch");
    console.log(error);
    return;
  }
}

async function closeOpenIssue(context, owner, repo, title) {
  // Check if issue is open and close it
  // TODO: UPDATE THE CREATOR WHEN MOVING TO PROD
  const issue = await context.octokit.issues.listForRepo({
    owner,
    repo: repo,
    state: "open",
    creator: "codefair-app[bot]",
    title: title,
  });

  if (issue.data.length > 0) {
    // If title if issue is found, close the issue
    for (let i = 0; i < issue.data.length; i++) {
      if (issue.data[i].title === title) {
        await context.octokit.issues.update({
          repo,
          owner,
          issue_number: issue.data[i].number,
          state: "closed",
        });
      }
    }
  }
}

async function verifyFirstIssue(context, owner, repo, title) {
  // If there is an issue that has been created by the bot, (either opened or closed) don't create another issue
  const issues = await context.octokit.issues.listForRepo({
    owner,
    repo,
    creator: "codefair-app[bot]",
    state: "all",
  });

  if (issues.data.length > 0) {
    // iterate through issues to see if there is an issue with the same title
    let no_issue = false;
    for (let i = 0; i < issues.data.length; i++) {
      if (issues.data[i].title === title) {
        console.log("Issue already exists, will not recreate");
        no_issue = true;
        break;
      }
    }

    if (!no_issue) {
      return false;
    } else {
      return true;
    }
  }
}

async function checkForLicense(context, owner, repo) {
  console.log("checking for license");
  try {
    await context.octokit.rest.licenses.getForRepo({
      owner,
      repo,
    });

    console.log("license found!");
    return true;
  } catch (error) {
    console.log("no license found");
    // Errors when no License is found in the repo
    return false;
  }
}

async function checkForCitation(context, owner, repo) {
  try {
    await context.octokit.rest.repos.getContent({
      owner,
      repo,
      path: "CITATION.cff",
    });

    return true;
  } catch (error) {
    return false;
  }
}

async function checkForCodeMeta(context, owner, repo) {
  try {
    await context.octokit.rest.repos.getContent({
      owner,
      repo,
      path: "codemeta.json",
    });

    return true;
  } catch (error) {
    return false;
  }
}

async function createIssue(context, owner, repo, title, body) {
  // If issue has been created, create one
  console.log("gathering issues");
  const issue = await context.octokit.issues.listForRepo({
    owner,
    repo: repo,
    state: "open",
    creator: "codefair-app[bot]",
    title: title,
  });

  console.log("ISSUE DATA");
  console.log(issue.data);

  if (issue.data.length > 0) {
    // iterate through issues to see if there is an issue with the same title
    let no_issue = false;
    for (let i = 0; i < issue.data.length; i++) {
      if (issue.data[i].title === title) {
        no_issue = true;
        break;
      }
    }

    if (!no_issue) {
      console.log("Creating an issue since no open issue was found");
      // Issue has not been created so we create one
      await context.octokit.issues.create({
        repo,
        owner,
        title: title,
        body: body,
      });
    }
  }

  if (issue.data.length === 0) {
    // Issue has not been created so we create one
    await context.octokit.issues.create({
      repo,
      owner,
      title: title,
      body: body,
    });
  }
}

async function gatherRepoAuthors(context, owner, repo, fileType) {
  // Get the list of contributors from the repo
  const contributors = await context.octokit.repos.listContributors({
    repo,
    owner,
  });

  // Get user information for each contributors
  let userInfo = await Promise.all(
    contributors.data.map(async (contributor) => {
      return await context.octokit.users.getByUsername({
        username: contributor.login,
      });
    })
  );

  let parsedAuthors = [];
  if (userInfo.length > 0) {
    userInfo.map((author) => {
      if (author.data.type === "Bot") {
        return;
      }

      let authorObj = {
        "orcid": "",
      };
      const parsedNames = human.parseName(author.data.name);
      if (author.data.company && fileType === "citation") {
        authorObj["affiliation"] = author.data.company;
      }

      if (author.data.company && fileType == "codemeta") {
        authorObj["affiliation"] = {
          "@type": "Organization",
          "name": author.data.company,
        }
      }

      if (parsedNames.firstName) {
        authorObj["given-names"] = parsedNames.firstName;
      }
      if (parsedNames.lastName) {
        authorObj["family-names"] = parsedNames.lastName;
      }
      if (author.data.email) {
        authorObj["email"] = author.data.email;
      }
      parsedAuthors.push(authorObj);
    });
  }

  return parsedAuthors;
}

async function gatherLanguagesUsed(context, owner, repo) {
  // Get the programming languages used in the repo
  let languages = await context.octokit.repos.listLanguages({
    repo,
    owner,
  });

  // Parse the data for languages used
  let languagesUsed = [];
  if (languages != {}) {
    languagesUsed = Object.keys(languages.data);
  }

  return languagesUsed;
}

async function createLicense(context, owner, repo, license) {
  // Verify there is no PR open already for the LICENSE file
  const openPR = await context.octokit.pulls.list({
    repo,
    owner,
    state: "open",
  });

  let prExists = false;
  openPR.data.map((pr) => {
    if (pr.title === "feat: ✨ LICENSE file added") {
      prExists = true;
    }
  });

  if (prExists) {
    await context.octokit.issues.createComment({
      repo,
      owner,
      issue_number: context.payload.issue.number,
      body: `A pull request for the LICENSE file already exists here: ${openPR.data[0].html_url}`,
    });

    // // comment on pull request to resolve issue
    // await context.octokit.issues.createComment({
    //   repo,
    //   owner,
    //   issue_number: openPR.data[0].number,
    //   body: `Resolves #${context.payload.issue.number}`,
    // });
    return;
  }

  // Create a new file with the license parameter (use axios to get the license from the licenses.json file)
  // Create a new branch with the license file and open a PR
  const licenseRequest = licensesAvail.find(
    (item) => item.licenseId === license
  );
  if (licenseRequest) {
    try {
      const response = await axios.get(licenseRequest.detailsUrl);
      const response_data = response.data;

      // Create a new file
      const branch = `license-${Math.floor(Math.random() * 9999)}`;

      let default_branch;
      let default_branch_name;
      try {
        default_branch = await context.octokit.repos.getBranch({
          owner,
          repo,
          branch: context.payload.repository.default_branch,
        });
        default_branch_name = default_branch.data.name;
      } catch (error) {
        console.log("Error getting default branch");
        console.log(error);
        return;
      }

      // Create a new branch base off the default branch
      console.log(default_branch);
      console.log("Creating branch");
      await context.octokit.git.createRef({
        repo,
        owner,
        ref: `refs/heads/${branch}`,
        sha: default_branch.data.commit.sha,
      });

      // Create a new file
      console.log("Creating file");
      await context.octokit.repos.createOrUpdateFileContents({
        repo,
        owner,
        path: "LICENSE",
        message: `feat: ✨ add LICENSE file with ${license} license terms`,
        content: Buffer.from(response_data.licenseText).toString("base64"),
        branch,
      });

      // Create a PR from that branch with the commit of our added file
      console.log("Creating PR");
      await context.octokit.pulls.create({
        repo,
        owner,
        title: "feat: ✨ LICENSE file added",
        head: branch,
        base: default_branch_name,
        body: `Resolves #${context.payload.issue.number}`,
        maintainer_can_modify: true, //Allows maintainers to edit your app's PR
      });

      // Comment on issue to notify user that license has been added
      console.log("Commenting on issue");
      await context.octokit.issues.createComment({
        repo,
        owner,
        issue_number: context.payload.issue.number,
        body: `A LICENSE file with ${license} license terms has been added to a new branch and a pull request is awaiting approval. I will close this issue automatically once the pull request is approved.`,
      });
    } catch (error) {
      console.log("Error fetching license file");
      console.log(error);
      return;
    }
  } else {
    // License not found, comment on issue to notify user
    console.log("License not found");
    await context.octokit.issues.createComment({
      repo,
      owner,
      issue_number: context.payload.issue.number,
      body: `The license identifier “${license}” was not found in the SPDX License List. Please reply with a valid license identifier.`,
    });
  }
}

async function createCitationFile(context, owner, repo, citationText) {
  // Here we take the citation text passed as a parameter
  // It could from probot's initial gathering or an updated version from the user

  // Create a new branch
  const branch = `citation-${Math.floor(Math.random() * 9999)}`;

  // Get the default branch of the repo
  let default_branch = await getDefaultBranch(context, owner, repo);
  let default_branch_name = default_branch.data.name;

  // Create a new branch based off the default branch
  await context.octokit.git.createRef({
    repo,
    owner,
    ref: `refs/heads/${branch}`,
    sha: default_branch.data.commit.sha,
  });

  // Create a new file
  await context.octokit.repos.createOrUpdateFileContents({
    repo,
    owner,
    path: "CITATION.cff",
    message: `feat: ✨ add CITATION.cff file`,
    content: Buffer.from(citationText).toString("base64"),
    branch,
  });

  // Create a PR with the branch
  await context.octokit.pulls.create({
    repo,
    owner,
    title: "feat: ✨ CITATION.cff create for repo",
    head: branch,
    base: default_branch_name,
    body: `Resolves #${context.payload.issue.number}`,
    maintainer_can_modify: true,
  });

  // Get the link to the CITATION.cff file in the branch created
  let citation_link = await context.octokit.repos.getContent({
    repo,
    owner,
    path: "CITATION.cff",
    ref: `refs/heads/${branch}`,
  });

  citation_link = citation_link.data.html_url;
  let edit_link = citation_link.replace("blob", "edit");

  await context.octokit.issues.createComment({
    repo,
    owner,
    issue_number: context.payload.issue.number,
    body:
      "```yaml\n" +
      citationText +
      "\n```" +
      `\n\nHere is the information I was able to gather from this repo. If you would like to add more please follow the link to edit using the GitHub UI. Once you are satisfied with the CITATION.cff you can merge the pull request and I will close this issue.
      \n\n[Edit CITATION.cff](${edit_link})`,
  });
}

async function createCodeMetaFile(context, owner, repo, codeMetaText) {
  // Create a new branch
  const branch = `codemeta-${Math.floor(Math.random() * 9999)}`;

  // Get the default branch of the repo
  let default_branch = await getDefaultBranch(context, owner, repo);
  let default_branch_name = default_branch.data.name;

  // Create a new branch based off the default branch
  await context.octokit.git.createRef({
    repo,
    owner,
    ref: `refs/heads/${branch}`,
    sha: default_branch.data.commit.sha,
  });

  // Create a new file
  await context.octokit.repos.createOrUpdateFileContents({
    repo,
    owner,
    path: "codemeta.json",
    message: `feat: ✨ add codemeta.json file`,
    content: Buffer.from(JSON.stringify(codeMetaText, null, 2)).toString("base64"),
    branch,
  });

  // Create a PR with the branch
  await context.octokit.pulls.create({
    repo,
    owner,
    title: "feat: ✨ codemeta.json created for repo",
    head: branch,
    base: default_branch_name,
    body: `Resolves #${context.payload.issue.number}`,
    maintainer_can_modify: true,
  });

  // Get the link to the codemeta.json file in the branch created
  let codemeta_link = await context.octokit.repos.getContent({
    repo,
    owner,
    path: "codemeta.json",
    ref: `refs/heads/${branch}`,
  });

  codemeta_link = codemeta_link.data.html_url;
  const edit_link = codemeta_link.replace("blob", "edit");

  await context.octokit.issues.createComment({
    repo,
    owner,
    issue_number: context.payload.issue.number,
    body:
      "```json\n" +
      JSON.stringify(codeMetaText, null, 2) +
      "\n```" +
      `\n\nHere is the information I was able to gather from this repo. If you would like to add more please follow the link to edit using the GitHub UI. Once you are satisfied with the codemeta.json you can merge the pull request and I will close this issue.
      \n\n[Edit codemeta.json](${edit_link})`,
  });
}

async function getDOI(context, owner, repoName) {
  try {
    const readme = await context.octokit.repos.getContent({
      owner,
      repo: repoName,
    });

    const readmeContent = Buffer.from(readme.data.content, "base64").toString(
      "utf-8"
    );
    const doiRegex = /10.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
    const doi = doiRegex.exec(readmeContent);

    if (doi) {
      return [true, doi[0]];
    }
  } catch (error) {
    return [false, ""];
  }
}

async function gatherCitationInfo(context, owner, repo) {
  // Verify there is no PR open already for the CITATION.cff file
  const openPR = await context.octokit.pulls.list({
    repo,
    owner,
    state: "open",
  });

  let prExists = false;
  openPR.data.map((pr) => {
    if (pr.title === "feat: ✨ CITATION.cff created for repo") {
      prExists = true;
    }
  });

  if (prExists) {
    await context.octokit.issues.createComment({
      repo,
      owner,
      issue_number: context.payload.issue.number,
      body: `A PR for the CITATION.cff file already exists here: ${openPR.data[0].html_url}`,
    });
    return;
  }

  // Get the release data of the repo
  let releases = await context.octokit.repos.listReleases({
    repo,
    owner,
  });

  // Get the metadata of the repo
  let repoData = await context.octokit.repos.get({
    repo,
    owner,
  });

  // Get authors of repo
  let parsedAuthors = await gatherRepoAuthors(context, owner, repo, "citation");
  // Get DOI of repo (if it exists)
  let doi = await getDOI(context, owner, repo);
  // Get the repo description
  let abstract = repoData.data.description;
  // Get the license of the repo
  let license_name = repoData.data.license;

  // date released is dependent on whether the repo has a release data (if not, use the created date)
  let date_released;
  if (repoData.data.released_at) {
    date_released = repoData.data.released_at;
  } else {
    // The date needs to be in this pattern:
    date_released = new Date().toISOString().split("T")[0];
  }

  // Get the homepage of the repo
  let url;
  if (repoData.data.homepage != null) {
    url = repoData.data.homepage;
  }

  // Get the keywords of the repo
  let keywords = [];
  if (repoData.data.topics != null && repoData.data.topics.length > 0) {
    console.log(repoData.data.topics);
    keywords = repoData.data.topics;
    console.log(keywords);
  }

  // Begin creating json for CITATION.cff file
  let citation_obj = {
    "cff-version": "1.2.0",
    message: "If you use this software, please cite it as below.",
    type: "software",
    identifiers: [
      {
        type: "doi",
        description: "DOI for this software's record on Zenodo.",
      },
    ],
    "repository-code": repoData.data.html_url,
    title: repoData.data.name,
  };

  if (doi[0]) {
    citation_obj["identifiers"][0]["value"] = doi[1];
  } else {
    citation_obj["identifiers"][0]["value"] = "";
  }

  if (parsedAuthors.length > 0) {
    citation_obj["authors"] = parsedAuthors;
  }

  if (license_name != null) {
    citation_obj["license"] = license_name["spdx_id"];
  }

  if (abstract != null) {
    citation_obj["abstract"] = abstract;
  } else {
    citation_obj["abstract"] = "";
  }

  if (keywords.length > 0) {
    citation_obj["keywords"] = keywords;
  }

  if (url != null && url != "") {
    citation_obj["url"] = url;
  } else {
    citation_obj["url"] = repoData.data.html_url;
  }

  if (date_released != null && date_released != "") {
    citation_obj["date-released"] = date_released;
  } else {
    citation_obj["date-released"] = "";
  }

  // sort keys alphabetically
  citation_obj = Object.keys(citation_obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = citation_obj[key];
      return acc;
    }, {});

  let citation_template = yaml.dump(citation_obj);

  await createCitationFile(context, owner, repo, citation_template);
}

async function gatherCodeMetaInfo(context, owner, repo) {
  // Gather metadata from the repo to create a codemeta.json file
  let repoData = await context.octokit.repos.get({
    repo,
    owner,
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
  const description = repoData.data.description;
  const identifier = repoData.data.id;
  const name = repoData.data.full_name;
  let issueTracker = repoData.data.issues_url;
  // TODO: See if those two api calls are needed

  let metadata = {
    "@context": "https://doi.org/10.5063/schema/codemeta-2.0",
    "@type": "SoftwareSourceCode",
  }

  if (license != null || license != "") {
    metadata["license"] = `https://spdx.org/licenses/${license}`;
  }

  if (codeRepository != null || codeRepository != "") {
    metadata["codeRepository"] = codeRepository;
  }

  if (dataCreated != null || dataCreated != "") {
    metadata["dateCreated"] = dataCreated.split("T")[0];
  }

  if (dataModified != null || dataModified != "") {
    metadata["dateModified"] = dataModified.split("T")[0];
  }

  if (keywords.length > 0) {
    metadata["keywords"] = keywords;
  } else {
    metadata["keywords"] = [];
  }

  if (description != null || description != "") {
    metadata["description"] = description;
  }

  if (identifier != null || identifier != "") {
    metadata["identifier"] = identifier;
  }

  if (name != null || name != "") {
    metadata["name"] = name;
  }

  if (issueTracker != null || issueTracker != "") {
    // Remove the {/number} from the issue tracker url
    issueTracker = issueTracker.replace("{/number}", "");
    metadata["issueTracker"] = issueTracker;
  }

  if (languagesUsed.length > 0) {
    metadata["programmingLanguage"] = languagesUsed;
  } else {
    metadata["programmingLanguage"] = [];
  }

  if (authors.length > 0) {
    metadata["author"] = authors;
  } else {
    metadata["author"] = [];
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


import { App } from "octokit";
import { nanoid } from "nanoid";
import dayjs from "dayjs";
import YAML from "yaml";

export default defineEventHandler(async (event) => {
  protectRoute(event);

  const { identifier } = event.context.params as { identifier: string };

  const codeMetadataRequest = await prisma.codeMetadata.findFirst({
    include: {
      repository: true,
    },
    where: {
      identifier,
    },
  });

  if (!codeMetadataRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: "Code metadata request not found",
    });
  }

  if (!codeMetadataRequest.repository.installation_id) {
    throw createError({
      statusCode: 404,
      statusMessage: "Installation not found",
    });
  }

  // Check if the user is authorized to access the request
  await repoWritePermissions(
    event,
    codeMetadataRequest.repository.owner,
    codeMetadataRequest.repository.repo,
  );

  const codeMetadataRecord =
    codeMetadataRequest.metadata as unknown as CodeMetadataRequest;

  // Create the codemeta file content

  const codeMetaAuthors = codeMetadataRecord.authors.map((author, index) => ({
    ...(author.affiliation && {
      affiliation: {
        name: author.affiliation,
        type: "Organization",
      },
    }),
    ...(author.email && {
      email: author.email,
    }),
    ...(author.familyName && {
      familyName: author.familyName,
    }),
    id: author.uri || `_:author_${index + 1}`,
    givenName: author.givenName,
    type: "Person",
  }));

  const codeMetaAuthorRoles = [];

  for (const [index, author] of codeMetadataRecord.authors.entries()) {
    for (const role of author.roles) {
      codeMetaAuthorRoles.push({
        ...(role.endDate && {
          endDate: dayjs(role.endDate).format("YYYY-MM-DD"),
        }),
        ...(role.role && {
          roleName: role.role,
        }),
        ...(role.startDate && {
          startDate: dayjs(role.startDate).format("YYYY-MM-DD"),
        }),
        "schema:author": author.uri || `_:author_${index + 1}`,
        type: "Role",
      });
    }
  }

  const codeMetaCombinedAuthors = [...codeMetaAuthors, ...codeMetaAuthorRoles];

  const codeMetaContributors = codeMetadataRecord.contributors.map(
    (contributor, index) => ({
      ...(contributor.affiliation && {
        affiliation: {
          name: contributor.affiliation,
          type: "Organization",
        },
      }),
      ...(contributor.email && {
        email: contributor.email,
      }),
      ...(contributor.familyName && {
        familyName: contributor.familyName,
      }),
      id: contributor.uri || `_:contributor_${index + 1}`,
      givenName: contributor.givenName,
      type: "Person",
    }),
  );

  const codeMetaContributorRoles = codeMetadataRecord.contributors.map(
    (contributor, index) => ({
      ...(contributor.roles[0].endDate && {
        endDate: dayjs(contributor.roles[0].endDate).format("YYYY-MM-DD"),
      }),
      ...(contributor.roles[0].role && {
        roleName: contributor.roles[0].role,
      }),
      ...(contributor.roles[0].startDate && {
        startDate: dayjs(contributor.roles[0].startDate).format("YYYY-MM-DD"),
      }),
      "schema:contributor": contributor.uri || `_:contributor_${index + 1}`,
    }),
  );

  const codeMetaCombinedContributors = [
    ...codeMetaContributors,
    ...codeMetaContributorRoles,
  ];

  const codeMeta = {
    name: codeMetadataRecord.name,
    "@context": "https://w3id.org/codemeta/3.0",
    ...(codeMetadataRecord.applicationCategory && {
      applicationCategory: codeMetadataRecord.applicationCategory,
    }),
    ...(codeMetaCombinedAuthors.length > 0 && {
      author: codeMetaCombinedAuthors,
    }),
    ...(codeMetaCombinedContributors.length > 0 && {
      contributor: codeMetaCombinedContributors,
    }),
    ...(codeMetadataRecord.continuousIntegration && {
      "codemeta:continuousIntegration": {
        id: codeMetadataRecord.continuousIntegration,
      },
    }),
    ...(codeMetadataRecord.isSourceCodeOf && {
      "codemeta:isSourceCodeOf": {
        id: codeMetadataRecord.isSourceCodeOf,
      },
    }),
    ...(codeMetadataRecord.codeRepository && {
      codeRepository: codeMetadataRecord.codeRepository,
    }),
    ...(codeMetadataRecord.continuousIntegration && {
      contIntegration: codeMetadataRecord.continuousIntegration,
    }),
    ...(codeMetadataRecord.creationDate && {
      dateCreated: dayjs(codeMetadataRecord.creationDate).format("YYYY-MM-DD"),
    }),
    ...(codeMetadataRecord.currentVersionReleaseDate && {
      dateModified: dayjs(codeMetadataRecord.currentVersionReleaseDate).format(
        "YYYY-MM-DD",
      ),
    }),
    ...(codeMetadataRecord.firstReleaseDate && {
      datePublished: dayjs(codeMetadataRecord.firstReleaseDate).format(
        "YYYY-MM-DD",
      ),
    }),
    ...(codeMetadataRecord.description && {
      description: codeMetadataRecord.description,
    }),
    ...(codeMetadataRecord.developmentStatus && {
      developmentStatus: codeMetadataRecord.developmentStatus,
    }),
    ...(codeMetadataRecord.currentVersionDownloadURL && {
      downloadUrl: codeMetadataRecord.currentVersionDownloadURL,
    }),
    ...(codeMetadataRecord.fundingOrganization && {
      funder: {
        name: codeMetadataRecord.fundingOrganization,
        type: "Organization",
      },
    }),
    ...(codeMetadataRecord.fundingCode && {
      funding: codeMetadataRecord.fundingCode,
    }),
    ...(codeMetadataRecord.uniqueIdentifier && {
      identifier: codeMetadataRecord.uniqueIdentifier,
    }),
    ...(codeMetadataRecord.isPartOf && {
      isPartOf: codeMetadataRecord.isPartOf,
    }),
    ...(codeMetadataRecord.issueTracker && {
      issueTracker: codeMetadataRecord.issueTracker,
    }),
    ...(codeMetadataRecord.keywords && {
      keywords: codeMetadataRecord.keywords,
    }),
    ...(codeMetadataRecord.license && {
      license: `https://spdx.org/licenses/${codeMetadataRecord.license}`,
    }),
    ...(codeMetadataRecord.operatingSystem && {
      operatingSystem: codeMetadataRecord.operatingSystem,
    }),
    ...(codeMetadataRecord.programmingLanguages && {
      programmingLanguage: codeMetadataRecord.programmingLanguages,
    }),
    ...(codeMetadataRecord.referencePublication && {
      referencePublication: codeMetadataRecord.referencePublication,
    }),
    ...(codeMetadataRecord.relatedLinks && {
      relatedLink: codeMetadataRecord.relatedLinks,
    }),
    ...(codeMetadataRecord.runtimePlatform && {
      runtimePlatform: codeMetadataRecord.runtimePlatform,
    }),
    ...(codeMetadataRecord.currentVersionReleaseNotes && {
      "schema:releaseNotes": codeMetadataRecord.currentVersionReleaseNotes,
    }),
    ...(codeMetadataRecord.reviewAspect || codeMetadataRecord.reviewBody
      ? {
          "schema:review": {
            ...(codeMetadataRecord.reviewAspect && {
              "schema:reviewAspect": codeMetadataRecord.reviewAspect,
            }),
            ...(codeMetadataRecord.reviewBody && {
              "schema:reviewBody": codeMetadataRecord.reviewBody,
            }),
            type: "schema:Review",
          },
        }
      : {}),
    ...(codeMetadataRecord.otherSoftwareRequirements && {
      softwareRequirements: codeMetadataRecord.otherSoftwareRequirements,
    }),
    ...(codeMetadataRecord.currentVersion && {
      version: codeMetadataRecord.currentVersion,
    }),
    type: "SoftwareSourceCode",
  };

  // Create an octokit app instance
  const app = new App({
    appId: process.env.GITHUB_APP_ID!,
    oauth: {
      clientId: null as unknown as string,
      clientSecret: null as unknown as string,
    },
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
  });

  const octokit = await app.getInstallationOctokit(
    codeMetadataRequest.repository.installation_id,
  );

  // Get the default branch of the repository
  const { data: repoData } = await octokit.request(
    "GET /repos/{owner}/{repo}",
    {
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
      owner: codeMetadataRequest.repository.owner,
      repo: codeMetadataRequest.repository.repo,
    },
  );

  const defaultBranch = repoData.default_branch;

  // Get the default branch reference
  const { data: refData } = await octokit.request(
    "GET /repos/{owner}/{repo}/git/ref/{ref}",
    {
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
      owner: codeMetadataRequest.repository.owner,
      ref: `heads/${defaultBranch}`,
      repo: codeMetadataRequest.repository.repo,
    },
  );

  // Create a new branch for the code metadata additions
  const newBranchName = `code-metadata-${nanoid()}`;

  // Create a new branch from the default branch
  await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
    owner: codeMetadataRequest.repository.owner,
    ref: `refs/heads/${newBranchName}`,
    repo: codeMetadataRequest.repository.repo,
    sha: refData.object.sha,
  });

  let existingCodeMetaSHA = "";

  // Check if the codemeta file already exists
  try {
    const { data: codeMetaData } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
        owner: codeMetadataRequest.repository.owner,
        path: "codemeta.json",
        ref: newBranchName,
        repo: codeMetadataRequest.repository.repo,
      },
    );

    existingCodeMetaSHA = "sha" in codeMetaData ? codeMetaData.sha : "";
  } catch (error) {
    // Do nothing
    existingCodeMetaSHA = "";
  }

  // Create a new file with the codemeta content
  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    branch: newBranchName,
    content: Buffer.from(JSON.stringify(codeMeta, null, 2)).toString("base64"),
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
    message: `feat: ✨ ${existingCodeMetaSHA ? "update" : "add"} codemeta file`,
    owner: codeMetadataRequest.repository.owner,
    path: "codemeta.json",
    repo: codeMetadataRequest.repository.repo,
    ...(existingCodeMetaSHA && { sha: existingCodeMetaSHA }),
  });

  let existingCitationCFFSHA = "";

  // Check if the citation.cff file already exists
  try {
    const { data: citationCFFData } = await octokit.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
        owner: codeMetadataRequest.repository.owner,
        path: "CITATION.cff",
        ref: newBranchName,
        repo: codeMetadataRequest.repository.repo,
      },
    );

    existingCitationCFFSHA =
      "sha" in citationCFFData ? citationCFFData.sha : "";
  } catch (error) {
    // Do nothing
    existingCitationCFFSHA = "";
  }

  // Create a new file with the citation.cff content

  const citationAuthors = codeMetadataRecord.authors.map((author) => ({
    "given-names": author.givenName,
    ...(author.familyName && {
      "family-names": author.familyName,
    }),
    ...(author.email && {
      email: author.email,
    }),
    ...(author.affiliation && {
      affiliation: author.affiliation,
    }),
  }));

  const citationCFF = {
    title: codeMetadataRecord.name,
    authors: citationAuthors,
    "cff-version": "1.2.0",
    message:
      "If you use this software, please cite it using the metadata from this file.",
    type: "software",
    ...(codeMetadataRecord.uniqueIdentifier && {
      identifiers: [
        {
          type: "doi",
          value: codeMetadataRecord.uniqueIdentifier,
        },
      ],
    }),
    ...(codeMetadataRecord.description && {
      abstract: codeMetadataRecord.description,
    }),
    ...(codeMetadataRecord.keywords && {
      keywords: codeMetadataRecord.keywords,
    }),
    ...(codeMetadataRecord.license && {
      license: codeMetadataRecord.license,
    }),
    ...(codeMetadataRecord.codeRepository && {
      "repository-code": codeMetadataRecord.codeRepository,
    }),
    ...(codeMetadataRecord.currentVersion && {
      version: codeMetadataRecord.currentVersion,
    }),
    ...(codeMetadataRecord.currentVersionReleaseDate && {
      "date-released": dayjs(
        codeMetadataRecord.currentVersionReleaseDate,
      ).format("YYYY-MM-DD"),
    }),
  };

  // Create a new file with the citation.cff content
  await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
    branch: newBranchName,
    content: Buffer.from(YAML.stringify(citationCFF)).toString("base64"),
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
    message: `feat: ✨ ${
      existingCitationCFFSHA ? "update" : "add"
    } citation file`,
    owner: codeMetadataRequest.repository.owner,
    path: "CITATION.cff",
    repo: codeMetadataRequest.repository.repo,
    ...(existingCitationCFFSHA && { sha: existingCitationCFFSHA }),
  });

  // Create a pull request for the new branch with the license content
  const { data: pullRequestData } = await octokit.request(
    "POST /repos/{owner}/{repo}/pulls",
    {
      title: `feat: ✨ ${
        existingCodeMetaSHA || existingCitationCFFSHA ? "Update" : "Add"
      } code metadata files`,
      base: defaultBranch,
      body: `This pull request ${
        existingCodeMetaSHA || existingCitationCFFSHA
          ? "updates the existing codemeta.json and CITATION.cff files in the repository"
          : "adds the codemeta.json and CITATION.cff files to the repository"
      }. Please review the changes and merge the pull request if everything looks good.`,
      head: newBranchName,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
      owner: codeMetadataRequest.repository.owner,
      repo: codeMetadataRequest.repository.repo,
    },
  );

  // Update the analytics data for the repository
  const existingAnalytics = await prisma.analytics.findFirst({
    where: {
      id: codeMetadataRequest.repository.id,
    },
  });

  if (!existingAnalytics) {
    await prisma.analytics.create({
      data: {
        id: codeMetadataRequest.repository.id,
        update_citation: 1,
        update_codemeta: 1,
      },
    });
  } else {
    await prisma.analytics.update({
      data: {
        update_citation: existingAnalytics.update_citation + 1,
        update_codemeta: existingAnalytics.update_codemeta + 1,
      },
      where: {
        id: existingAnalytics.id,
      },
    });
  }

  return {
    message: "Code metadata request updated successfully",
    prUrl: pullRequestData.html_url,
  };
});

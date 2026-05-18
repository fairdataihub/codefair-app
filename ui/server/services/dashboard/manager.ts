/**
 * Dashboard manager - orchestrates DB writes, rendering, and GitHub issue upsert for the compliance dashboard.
 *
 * Responsibilities:
 *   1. Write compliance results to the DB via each service's update*Database()
 *   2. Fetch DB metadata needed by the renderer (PR URLs, licenseId, etc.)
 *   3. Build DashboardSections and call renderDashboard()
 *   4. Build the archival section from DB state (ZenodoDeposition + metadata identifiers)
 *   5. Create or update the GitHub issue and save issue_number to the DB
 */
import type { RepositoryProvider, IssueRef } from "../providers/interface";
import type {
  CheckName,
  ComplianceSubjects,
  RunComplianceOptions,
} from "../compliance/index";
import { updateLicenseDatabase } from "../compliance/license";
import { updateMetadataDatabase } from "../compliance/metadata";
import { updateCWLDatabase } from "../compliance/cwl";
import type { CWLValidationSummary, CWLFileEntry } from "../compliance/cwl";
import type { ValidationResult } from "../compliance/metadata";
import {
  renderDashboard,
  renderEmptyRepoDashboard,
  extractIdentifiersFromCodemeta,
  extractIdentifiersFromCitation,
  type ArchivalIdentifier,
  type ArchivalSectionData,
  type DashboardSections,
} from "./renderer";
import { createId } from "~/server/utils/cuid";
import { logwatch } from "~/server/utils/logwatch";
import prisma from "~/server/utils/prisma";

const DASHBOARD_ISSUE_TITLE = "FAIR Compliance Dashboard";

// ===== DB writes per compliance service ============================

/**
 * Upserts the README compliance result for a repository in the database.
 *
 * @param repositoryId - Prisma `Installation.id` for the repository.
 * @param subjects - Compliance check results containing the `readme` subject.
 */
async function writeReadmeToDb(
  repositoryId: number,
  subjects: ComplianceSubjects,
): Promise<void> {
  const { readme } = subjects;
  const existing = await prisma.readmeValidation.findUnique({
    where: { repository_id: repositoryId },
  });

  const data = {
    contains_readme: readme.status,
    readme_content: readme.content,
    readme_path: readme.path,
  };

  if (existing) {
    await prisma.readmeValidation.update({ data, where: { id: existing.id } });
  } else {
    await prisma.readmeValidation.create({
      data: {
        identifier: createId(),
        ...data,
        repository: { connect: { id: repositoryId } },
      },
    });
  }
}

/**
 * Upserts the CONTRIBUTING and Code of Conduct compliance results for a repository in the database.
 *
 * @param repositoryId - Prisma `Installation.id` for the repository.
 * @param subjects - Compliance check results containing the `contributing` and `cofc` subjects.
 */
async function writeContributingToDb(
  repositoryId: number,
  subjects: ComplianceSubjects,
): Promise<void> {
  const { cofc, contributing } = subjects;

  const existingContrib = await prisma.contributingValidation.findUnique({
    where: { repository_id: repositoryId },
  });
  const existingCofc = await prisma.codeofConductValidation.findUnique({
    where: { repository_id: repositoryId },
  });

  const contribData = {
    contains_contrib: contributing.status,
    contrib_content: contributing.content,
    contrib_path: contributing.path,
  };
  const cofcData = {
    code_content: cofc.content,
    code_path: cofc.path,
    contains_code: cofc.status,
  };

  if (existingContrib) {
    await prisma.contributingValidation.update({
      data: contribData,
      where: { id: existingContrib.id },
    });
  } else {
    await prisma.contributingValidation.create({
      data: {
        identifier: createId(),
        ...contribData,
        repository: { connect: { id: repositoryId } },
      },
    });
  }

  if (existingCofc) {
    await prisma.codeofConductValidation.update({
      data: cofcData,
      where: { id: existingCofc.id },
    });
  } else {
    await prisma.codeofConductValidation.create({
      data: {
        identifier: createId(),
        ...cofcData,
        repository: { connect: { id: repositoryId } },
      },
    });
  }
}

// ===== Archival identifier extraction ==============================

/**
 * Fetches `codemeta.json` and `CITATION.cff` from the repository (when present)
 * and extracts any DOI / non-DOI identifiers from them.
 *
 * Used to populate the archival section when no Codefair-published Zenodo DOI
 * exists yet in the database.  Errors from individual file fetches are non-fatal:
 * the failing file is skipped and a warning is logged.
 *
 * @param provider - Repository provider for GitHub API calls.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param metadataExists - Flags indicating which metadata files are present.
 * @returns Deduplicated array of classified identifiers found across both files.
 */
async function fetchArchivalIdentifiers(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
  metadataExists: { citation: boolean; codemeta: boolean },
): Promise<ArchivalIdentifier[]> {
  const all: ArchivalIdentifier[] = [];

  if (metadataExists.codemeta) {
    try {
      const file = await provider.getFileContent(owner, repo, "codemeta.json");
      if (file?.content) {
        all.push(...extractIdentifiersFromCodemeta(file.content));
      }
    } catch (err: any) {
      logwatch.warn({
        action: "archival",
        error: err?.message,
        message: "Failed to fetch codemeta.json for identifier extraction",
        owner,
        repo,
      });
    }
  }

  if (metadataExists.citation) {
    try {
      const file = await provider.getFileContent(owner, repo, "CITATION.cff");
      if (file?.content) {
        all.push(...extractIdentifiersFromCitation(file.content));
      }
    } catch (err: any) {
      logwatch.warn({
        action: "archival",
        error: err?.message,
        message: "Failed to fetch CITATION.cff for identifier extraction",
        owner,
        repo,
      });
    }
  }

  // Deduplicate by value
  const seen = new Set<string>();
  return all.filter((id) => {
    if (seen.has(id.value)) return false;
    seen.add(id.value);
    return true;
  });
}

// ===== PR staleness check ========================================

/**
 * Verifies that a stored PR URL still points to an open pull request.
 * If the PR is no longer open, `clearFn` is called to remove the stale URL from the DB.
 *
 * @param provider - Repository provider for GitHub API calls.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param prUrl - Stored PR URL to verify (e.g. `https://github.com/owner/repo/pull/42`).
 * @param clearFn - Async callback that clears the PR URL in the DB when the PR is closed.
 * @returns The original `prUrl` if the PR is open, or `""` if closed, deleted, or invalid.
 */
async function verifyPrUrl(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
  prUrl: string,
  clearFn: () => Promise<void>,
): Promise<string> {
  if (!prUrl) return "";
  try {
    const pullNumber = parseInt(prUrl.split("/").pop() ?? "0", 10);
    if (!pullNumber) return "";
    const pr = await provider.getPullRequest(owner, repo, pullNumber);
    if (pr.state === "open") return prUrl;
    await clearFn();
    return "";
  } catch {
    return "";
  }
}

// ===== Shared render + upsert core =================================

/**
 * Fetches DB metadata, verifies PR URLs, renders the dashboard, and upserts the
 * GitHub issue.
 *
 * @param provider - Repository provider for GitHub API calls.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param repositoryId - Prisma `Installation.id` for the repository.
 * @param subjects - Compliance check results (may be reconstructed from DB for refresh path).
 * @param cwlSummary - Aggregated CWL validation result, or `null` if no CWL files are present.
 * @param installation - Cached installation row with `disabled` flag and stored `issue_number`.
 */
async function _renderAndUpsertFromDbState(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
  repositoryId: number,
  subjects: ComplianceSubjects,
  cwlSummary: CWLValidationSummary | null,
  installation: {
    disabled: boolean | null;
    issue_number: number | null;
  } | null,
): Promise<void> {
  // Fetch DB metadata for rendering (PR URLs, licenseId, custom title)
  const [licenseDb, metadataDb, readmeDb, contributingDb, cofcDb, zenodoDb] =
    await Promise.all([
      prisma.licenseRequest.findUnique({
        where: { repository_id: repositoryId },
      }),
      prisma.codeMetadata.findUnique({
        where: { repository_id: repositoryId },
      }),
      prisma.readmeValidation.findUnique({
        where: { repository_id: repositoryId },
      }),
      prisma.contributingValidation.findUnique({
        where: { repository_id: repositoryId },
      }),
      prisma.codeofConductValidation.findUnique({
        where: { repository_id: repositoryId },
      }),
      prisma.zenodoDeposition.findUnique({
        where: { repository_id: repositoryId },
      }),
    ]);

  const clearPr = (fn: () => Promise<unknown>) => () =>
    fn().then(() => undefined);

  const [
    licensePrUrl,
    metadataPrUrl,
    readmePrUrl,
    contributingPrUrl,
    cofcPrUrl,
  ] = await Promise.all([
    verifyPrUrl(
      provider,
      owner,
      repo,
      licenseDb?.pull_request_url ?? "",
      clearPr(() =>
        prisma.licenseRequest.update({
          data: { pull_request_url: "" },
          where: { repository_id: repositoryId },
        }),
      ),
    ),
    verifyPrUrl(
      provider,
      owner,
      repo,
      metadataDb?.pull_request_url ?? "",
      clearPr(() =>
        prisma.codeMetadata.update({
          data: { pull_request_url: "" },
          where: { repository_id: repositoryId },
        }),
      ),
    ),
    verifyPrUrl(
      provider,
      owner,
      repo,
      readmeDb?.pull_request_url ?? "",
      clearPr(() =>
        prisma.readmeValidation.update({
          data: { pull_request_url: "" },
          where: { repository_id: repositoryId },
        }),
      ),
    ),
    verifyPrUrl(
      provider,
      owner,
      repo,
      contributingDb?.pull_request_url ?? "",
      clearPr(() =>
        prisma.contributingValidation.update({
          data: { pull_request_url: "" },
          where: { repository_id: repositoryId },
        }),
      ),
    ),
    verifyPrUrl(
      provider,
      owner,
      repo,
      cofcDb?.pull_request_url ?? "",
      clearPr(() =>
        prisma.codeofConductValidation.update({
          data: { pull_request_url: "" },
          where: { repository_id: repositoryId },
        }),
      ),
    ),
  ]);

  // Build validation objects from DB
  const codemetaValidation: ValidationResult | null = metadataDb
    ? {
        isValid: metadataDb.codemeta_status === "valid",
        message: metadataDb.codemeta_validation_message || "",
        status:
          (metadataDb.codemeta_status as "valid" | "invalid" | "unknown") ||
          "unknown",
      }
    : null;

  const citationValidation: ValidationResult | null = metadataDb
    ? {
        isValid: metadataDb.citation_status === "valid",
        message: metadataDb.citation_validation_message || "",
        status:
          (metadataDb.citation_status as "valid" | "invalid" | "unknown") ||
          "unknown",
      }
    : null;

  // Find existing open issue for upsert
  let openIssue: IssueRef | null = null;

  if (installation?.issue_number) {
    const fetched = await provider.getIssue(
      owner,
      repo,
      installation.issue_number,
    );
    if (fetched?.state === "open") {
      openIssue = fetched;
      logwatch.info({
        action: "dashboard.upsert",
        issueNumber: installation.issue_number,
        message: "Using stored issue number for upsert",
        owner,
        repo,
      });
    }
  }

  // Build archival section data from DB
  const hasPublishedDoi = Boolean(zenodoDb?.last_published_zenodo_doi);
  const archivalIdentifiers = hasPublishedDoi
    ? []
    : await fetchArchivalIdentifiers(provider, owner, repo, {
        citation: subjects.metadata.citation,
        codemeta: subjects.metadata.codemeta,
      });

  const archival: ArchivalSectionData = {
    identifiers: archivalIdentifiers,
    licensePresent: subjects.license.status,
    zenodoDeposition: zenodoDb
      ? {
          githubTagName: zenodoDb.github_tag_name ?? null,
          lastPublishedDoi: zenodoDb.last_published_zenodo_doi ?? null,
          zenodoId: zenodoDb.zenodo_id ?? null,
        }
      : null,
  };

  // Render the dashboard
  const sections: DashboardSections = {
    archival,
    cofc: { pullRequestUrl: cofcPrUrl, result: subjects.cofc },
    contributing: {
      pullRequestUrl: contributingPrUrl,
      result: subjects.contributing,
    },
    cwl: { summary: cwlSummary },
    license: {
      customLicenseTitle: licenseDb?.custom_license_title ?? "",
      license: subjects.license,
      licenseId: licenseDb?.license_id ?? null,
      pullRequestUrl: licensePrUrl,
    },
    metadata: {
      citationValidation,
      codemetaValidation,
      exists: subjects.metadata,
      licensePresent: subjects.license.status,
      pullRequestUrl: metadataPrUrl,
    },
    owner,
    readme: { pullRequestUrl: readmePrUrl, readme: subjects.readme },
    repo,
  };

  const body = renderDashboard(sections);

  // Create or update the GitHub issue
  await upsertIssue(provider, owner, repo, repositoryId, body, openIssue);
}

// ===== DB subject reconstruction ===================================

/**
 * Reads all compliance records from the DB and reconstructs a `ComplianceSubjects`
 * object along with a `CWLValidationSummary`. Used after partial DB writes so that
 * the render step always has the full picture rather than stubs for unchecked items.
 *
 * @param repositoryId - Prisma `Installation.id` for the repository.
 * @returns An object containing the reconstructed `ComplianceSubjects` and `CWLValidationSummary`.
 */
async function _subjectsFromDb(repositoryId: number): Promise<{
  cwlSummary: CWLValidationSummary | null;
  subjects: ComplianceSubjects;
}> {
  const [licenseDb, metadataDb, readmeDb, contributingDb, cofcDb, cwlDb] =
    await Promise.all([
      prisma.licenseRequest.findUnique({
        where: { repository_id: repositoryId },
      }),
      prisma.codeMetadata.findUnique({
        where: { repository_id: repositoryId },
      }),
      prisma.readmeValidation.findUnique({
        where: { repository_id: repositoryId },
      }),
      prisma.contributingValidation.findUnique({
        where: { repository_id: repositoryId },
      }),
      prisma.codeofConductValidation.findUnique({
        where: { repository_id: repositoryId },
      }),
      prisma.cwlValidation.findUnique({
        where: { repository_id: repositoryId },
      }),
    ]);

  const subjects: ComplianceSubjects = {
    cofc: {
      content: cofcDb?.code_content ?? "",
      path: cofcDb?.code_path ?? "",
      status: cofcDb?.contains_code ?? false,
    },
    contributing: {
      content: contributingDb?.contrib_content ?? "",
      path: contributingDb?.contrib_path ?? "",
      status: contributingDb?.contains_contrib ?? false,
    },
    cwl: null,
    license: {
      content: licenseDb?.license_content ?? "",
      path: "",
      spdx_id: licenseDb?.license_id ?? null,
      status: licenseDb?.contains_license ?? false,
    },
    metadata: {
      citation: metadataDb?.contains_citation ?? false,
      codemeta: metadataDb?.contains_codemeta ?? false,
    },
    readme: {
      content: readmeDb?.readme_content ?? "",
      path: readmeDb?.readme_path ?? "",
      status: readmeDb?.contains_readme ?? false,
    },
  };

  let cwlSummary: CWLValidationSummary | null = null;
  if (cwlDb?.contains_cwl_files) {
    const files = (cwlDb.files ?? []) as unknown as CWLFileEntry[];
    cwlSummary = {
      failedCount: files.filter((f) => f.validation_status === "invalid")
        .length,
      files,
      validOverall: cwlDb.overall_status === "valid",
    };
  }

  return { cwlSummary, subjects };
}

// ===== Main entry point ========================================

/**
 * Orchestrates DB writes, renders the dashboard, and creates/updates the GitHub issue.
 *
 * Only the checks included in `opts` are written to the DB; skipped checks retain
 * their existing DB values and those stored values are used for rendering.
 *
 * @param provider - Repository provider (GitHub Octokit wrapper)
 * @param owner - Repository owner login
 * @param repo - Repository name
 * @param repositoryId - Prisma `Installation.id`
 * @param subjects - Result of `runComplianceChecks()`
 * @param emptyRepo - Set to true when the repository has no content yet
 * @param opts - The same options passed to `runComplianceChecks()`, used to determine which DB writes to perform
 */
export async function createOrUpdateDashboardIssue(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
  repositoryId: number,
  subjects: ComplianceSubjects,
  emptyRepo = false,
  opts: RunComplianceOptions = {},
): Promise<void> {
  const installation = await prisma.installation.findUnique({
    select: { disabled: true, issue_number: true },
    where: { id: repositoryId },
  });
  if (installation?.disabled) {
    logwatch.info({
      action: "dashboard.update",
      issueNumber: installation.issue_number ?? undefined,
      message: "Skipping update - installation disabled",
      owner,
      repo,
    });
    return;
  }

  // 1. Handle empty repo
  if (emptyRepo) {
    const body = renderEmptyRepoDashboard();
    await upsertIssue(provider, owner, repo, repositoryId, body, null);
    return;
  }

  // 2. Determine which checks actually ran
  const isFullRun = opts.fullCodefairRun === true || !opts.checks?.length;
  const ranChecks = new Set(opts.checks ?? []);
  const ran = (name: CheckName) => isFullRun || ranChecks.has(name);

  // 3. Write only the changed checks to DB
  const dbWrites: Promise<unknown>[] = [];
  if (ran("license")) {
    dbWrites.push(updateLicenseDatabase(repositoryId, subjects.license));
  }
  if (ran("metadata")) {
    dbWrites.push(
      updateMetadataDatabase(
        provider,
        owner,
        repo,
        repositoryId,
        subjects.metadata,
      ),
    );
  }
  if (ran("readme")) {
    dbWrites.push(writeReadmeToDb(repositoryId, subjects));
  }
  if (ran("contributing") || ran("cofc")) {
    dbWrites.push(writeContributingToDb(repositoryId, subjects));
  }
  await Promise.all(dbWrites);

  let cwlSummary: CWLValidationSummary | null = null;
  if (subjects.cwl) {
    cwlSummary = await updateCWLDatabase(repositoryId, subjects.cwl);
  }

  // 4. Reconstruct full subjects from DB so skipped checks use their stored values.
  // For full runs, subjects already reflects everything written above so skip the round-trip.
  let renderSubjects = subjects;
  let renderCwlSummary = cwlSummary;
  if (!isFullRun) {
    const db = await _subjectsFromDb(repositoryId);
    renderSubjects = db.subjects;
    renderCwlSummary = db.cwlSummary;
  }

  // 5. Render and upsert from the now-current DB state
  await _renderAndUpsertFromDbState(
    provider,
    owner,
    repo,
    repositoryId,
    renderSubjects,
    renderCwlSummary,
    installation,
  );
}

// ===== Lightweight re-render from DB (no compliance re-check =======

/**
 * Re-renders and updates the dashboard issue using only existing DB state,
 * without running compliance checks again.
 *
 * Use this when the compliance state of the repo has not changed and only the
 * PR badge needs to be added or removed (e.g. on `pull_request.closed`).
 *
 * @param provider - Repository provider for GitHub API calls.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param repositoryId - Prisma `Installation.id` for the repository.
 */
export async function refreshDashboardFromDb(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
  repositoryId: number,
): Promise<void> {
  const installation = await prisma.installation.findUnique({
    select: { disabled: true, issue_number: true },
    where: { id: repositoryId },
  });
  if (installation?.disabled) {
    logwatch.info({
      action: "dashboard.refresh",
      issueNumber: installation.issue_number ?? undefined,
      message: "Skipping refresh - installation disabled",
      owner,
      repo,
    });
    return;
  }

  const { cwlSummary, subjects } = await _subjectsFromDb(repositoryId);

  await _renderAndUpsertFromDbState(
    provider,
    owner,
    repo,
    repositoryId,
    subjects,
    cwlSummary,
    installation,
  );
}

// ===== Issue upsert =========================================

/**
 * Creates or updates the FAIR Compliance Dashboard GitHub issue for a repository.
 *
 * Resolution order:
 *  1. If `openIssue` is provided, update it directly (fast path).
 *  2. If the cached issue was deleted, recreate it.
 *  3. Otherwise, search all bot-authored issues by title and update the first open match,
 *     or create a new one if none exist.
 *
 * The resolved issue number is always persisted to the DB via `saveIssueNumber`.
 *
 * @param provider - Repository provider for GitHub API calls.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param repositoryId - Prisma `Installation.id` for the repository.
 * @param body - Rendered Markdown body for the dashboard issue.
 * @param openIssue - Known open issue reference, or `null` to trigger a title search.
 */
async function upsertIssue(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
  repositoryId: number,
  body: string,
  openIssue: IssueRef | null,
): Promise<void> {
  // Fast path: we already know the open issue from step 5
  if (openIssue) {
    try {
      await provider.updateIssue(owner, repo, openIssue.number, body);
      await saveIssueNumber(repositoryId, openIssue.number);
      logwatch.success({
        action: "dashboard.upsert",
        issueNumber: openIssue.number,
        message: "Updated existing issue",
        owner,
        repo,
      });
      return;
    } catch (err: any) {
      if (!err?.message?.includes("deleted")) throw err;
      logwatch.warn({
        action: "dashboard.upsert",
        issueNumber: openIssue.number,
        message: "Issue was deleted - recreating",
        owner,
        repo,
      });
      // disabled is already checked in createOrUpdateDashboardIssue before we get here
      const created = await provider.createIssue(
        owner,
        repo,
        DASHBOARD_ISSUE_TITLE,
        body,
      );
      await saveIssueNumber(repositoryId, created.number);
      logwatch.success({
        action: "dashboard.upsert",
        issueNumber: created.number,
        message: "Recreated deleted issue",
        owner,
        repo,
      });
      return;
    }
  }

  // no stored issue number or issue not found open - search by title
  const botLogin = provider.getBotLogin();
  const allIssues = await provider.listIssues(owner, repo, {
    creator: botLogin,
    state: "all",
  });

  const matchingTitle = allIssues.filter(
    (i) => i.title === DASHBOARD_ISSUE_TITLE,
  );

  if (matchingTitle.length === 0) {
    const created = await provider.createIssue(
      owner,
      repo,
      DASHBOARD_ISSUE_TITLE,
      body,
    );
    await saveIssueNumber(repositoryId, created.number);
    logwatch.success({
      action: "dashboard.upsert",
      issueNumber: created.number,
      message: "Created new issue",
      owner,
      repo,
    });
    return;
  }

  const foundOpen = matchingTitle.find((i) => i.state === "open");
  if (!foundOpen) {
    // All matching issues are closed - disabled is already checked above, so recreate
    const created = await provider.createIssue(
      owner,
      repo,
      DASHBOARD_ISSUE_TITLE,
      body,
    );
    await saveIssueNumber(repositoryId, created.number);
    logwatch.success({
      action: "dashboard.upsert",
      issueNumber: created.number,
      message: "Recreated closed issue",
      owner,
      repo,
    });
    return;
  }

  await provider.updateIssue(owner, repo, foundOpen.number, body);
  await saveIssueNumber(repositoryId, foundOpen.number);
  logwatch.success({
    action: "dashboard.upsert",
    issueNumber: foundOpen.number,
    message: "Updated existing issue",
    owner,
    repo,
  });
}

/**
 * Persists the dashboard issue number to the installation record in the database.
 *
 * @param repositoryId - Prisma `Installation.id` for the repository.
 * @param issueNumber - GitHub issue number to save.
 */
async function saveIssueNumber(
  repositoryId: number,
  issueNumber: number,
): Promise<void> {
  await prisma.installation.update({
    data: { disabled: false, issue_number: issueNumber },
    where: { id: repositoryId },
  });
}

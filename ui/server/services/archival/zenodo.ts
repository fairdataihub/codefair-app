/**
 * Zenodo archival service.
 *
 * Contains all Zenodo API interactions and the full publication
 * workflow.
 *
 * Improvements over the original bot implementation:
 *  - Token validation auto-refreshes valid sessions (posters-science pattern)
 *  - Invalid / expired tokens are deleted automatically
 *  - Error messages include the Zenodo API response body for easier debugging
 *  - The full workflow is driven by a progress callback for SSE streaming
 *  - Deposition creation, versioning and file cleanup are consolidated in one place
 */

import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";
import type {
  ArchivalProvider,
  ArchivalPublicationOptions,
  ArchivalTokenValidation,
  ExistingDeposition,
  ProgressCallback,
  PublicationResult,
} from "./interface";
import {
  extractRecordDoi,
  HttpError,
  type RdmRecord,
  UPLOAD_MAX_ATTEMPTS,
  type UploadSource,
  type WorkingDraft,
  ZenodoRdmClient,
} from "./zenodo-rdm";
import { runConcurrently } from "./run-concurrently";
import { GitHubRepositoryProvider } from "~/server/services/providers/github";
import { refreshDashboardFromDb } from "~/server/services/dashboard/manager";
import { logwatch } from "~/server/utils/logwatch";
import prisma from "~/server/utils/prisma";
import licensesJson from "~/assets/data/licenses.json";

// ===== Internal config helpers =======================================

/**
 * Returns the Zenodo REST API base URL from environment config.
 * @returns The value of ZENODO_API_ENDPOINT, or an empty string if unset.
 */
function zenodoApiEndpoint(): string {
  return process.env.ZENODO_API_ENDPOINT ?? "";
}

/**
 * Returns the Zenodo base URL used for OAuth endpoints from environment config.
 * @returns The value of ZENODO_ENDPOINT, or an empty string if unset.
 */
function zenodoEndpoint(): string {
  return process.env.ZENODO_ENDPOINT ?? "";
}

/**
 * Returns how many release files are transferred to Zenodo at once.
 * Transfers are streamed, so this trades speed against load on Zenodo rather
 * than server memory.
 * @returns ZENODO_UPLOAD_CONCURRENCY when it is a positive integer, else 3.
 */
function zenodoUploadConcurrency(): number {
  const value = Number.parseInt(
    process.env.ZENODO_UPLOAD_CONCURRENCY ?? "",
    10,
  );
  return Number.isInteger(value) && value > 0 ? value : 3;
}

/** Minimum gap between byte-progress events for a single file. */
const UPLOAD_PROGRESS_INTERVAL_MS = 1000;

// ===== Token management =============================================

/**
 * Refreshes a user's Zenodo OAuth token using the stored refresh token.
 * Updates the database record with the new tokens and expiry.
 * @param userId - Codefair user ID whose token should be refreshed.
 * @param refreshToken - The stored OAuth refresh token.
 * @returns Resolves when the token has been updated in the database.
 */
async function refreshZenodoToken(
  userId: string,
  refreshToken: string,
): Promise<void> {
  const body = new URLSearchParams({
    client_id: process.env.ZENODO_CLIENT_ID ?? "",
    client_secret: process.env.ZENODO_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(`${zenodoEndpoint()}/oauth/token`, {
    body: body.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {
      // ignore
    }
    logwatch.warn({
      action: "zenodo.refreshToken",
      body,
      message: `Token refresh failed (${res.status}) for user ${userId}`,
      userId,
    });
    return;
  }

  const tokenBody = await res.json();
  const {
    access_token: accessToken,
    expires_in: expiresIn,
    refresh_token: rotatedRefreshToken,
  } = tokenBody;

  await prisma.zenodoToken.update({
    data: {
      expires_at: new Date(Date.now() + expiresIn * 1000),
      refresh_token: rotatedRefreshToken,
      token: accessToken,
    },
    where: { user_id: userId },
  });

  logwatch.info({
    action: "zenodo.refreshToken",
    message: "Token refreshed successfully",
    userId,
  });
}

/**
 * Validates the stored Zenodo token for `userId`.
 *
 * - If no token is stored: returns `{ valid: false }`.
 * - If the token is invalid / Zenodo rejects it: deletes the token and returns `{ valid: false }`.
 * - If the token is valid: refreshes the session and returns `{ valid: true, existingDepositions }`.
 * @param userId - Codefair user ID to validate.
 * @returns Token validation result including existing depositions on success.
 */
export async function validateZenodoToken(
  userId: string,
): Promise<ArchivalTokenValidation> {
  const tokenRecord = await prisma.zenodoToken.findFirst({
    where: { user_id: userId },
  });

  if (!tokenRecord) {
    return {
      existingDepositions: [],
      message: "No Zenodo token found",
      valid: false,
    };
  }

  let records;
  try {
    records = await new ZenodoRdmClient(
      zenodoApiEndpoint(),
      tokenRecord.token,
    ).listUserRecords();
  } catch (error: any) {
    const status = error instanceof HttpError ? error.status : undefined;
    if (status === 401 || status === 403) {
      await prisma.zenodoToken.delete({ where: { user_id: userId } });
      logwatch.warn({
        action: "zenodo.validateToken",
        message: `Zenodo rejected the token (${status}); token deleted`,
        userId,
      });
      return {
        existingDepositions: [],
        message: "Zenodo token is invalid or expired",
        valid: false,
      };
    }

    logwatch.warn({
      action: "zenodo.validateToken",
      message: `Zenodo token check failed without invalidating the token: ${error.message}`,
      userId,
    });
    return {
      existingDepositions: [],
      message: "Could not reach Zenodo, please try again shortly",
      valid: false,
    };
  }

  await refreshZenodoToken(userId, tokenRecord.refresh_token);

  const existingDepositions: ExistingDeposition[] = records.map((record) => ({
    id: record.id,
    title: record.title,
    conceptrecid: record.conceptDoi ?? "",
    state: record.isPublished ? "done" : "unsubmitted",
    submitted: record.isPublished,
  }));

  logwatch.info({
    action: "zenodo.validateToken",
    depositionCount: existingDepositions.length,
    message: "Zenodo token validated successfully",
    userId,
  });

  return {
    existingDepositions,
    message: "Zenodo token is valid",
    valid: true,
  };
}

// ===== InvenioRDM metadata helpers ==================================

type RdmCreator = {
  affiliations?: Array<{ name: string }>;
  person_or_org: {
    name: string;
    family_name?: string;
    given_name?: string;
    identifiers?: Array<{ identifier: string; scheme: "orcid" }>;
    type: "organizational" | "personal";
  };
};

function extractOrcid(author: Record<string, any>): string | undefined {
  const candidates = [author.orcid, author.id, author["@id"]];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const match = candidate.match(
      /(?:https?:\/\/orcid\.org\/)?(\d{4}-\d{4}-\d{4}-[\dX]{4})/i,
    );
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function buildRdmCreators(codemeta: Record<string, any>): RdmCreator[] {
  const rawAuthors = Array.isArray(codemeta.author)
    ? codemeta.author
    : codemeta.author
      ? [codemeta.author]
      : [];
  const creators = rawAuthors
    .filter((author: any) => author?.type !== "Role")
    .map((author: any): RdmCreator => {
      const organization = author.type === "Organization";
      const givenName = String(author.givenName ?? "").trim();
      const familyName = String(author.familyName ?? "").trim();
      const name = organization
        ? String(author.name ?? givenName ?? "Unknown").trim()
        : familyName
          ? `${familyName}, ${givenName}`.replace(/,\s*$/, "")
          : String(author.name ?? givenName ?? "Unknown").trim();
      const orcid = extractOrcid(author);
      const affiliationName =
        typeof author.affiliation === "string"
          ? author.affiliation
          : author.affiliation?.name;
      // InvenioRDM rejects people without a family name, so an author listed
      // with a single name uses it as the family name.
      return {
        person_or_org: {
          name: name || "Unknown",
          type: organization ? "organizational" : "personal",
          ...(!organization &&
            familyName &&
            givenName && { given_name: givenName }),
          ...(!organization && {
            family_name: familyName || name || "Unknown",
          }),
          ...(orcid && {
            identifiers: [{ identifier: orcid, scheme: "orcid" as const }],
          }),
        },
        ...(affiliationName && {
          affiliations: [{ name: String(affiliationName) }],
        }),
      };
    });

  return creators.length
    ? creators
    : [
        {
          person_or_org: {
            name: "Unknown",
            family_name: "Unknown",
            type: "personal",
          },
        },
      ];
}

function buildRdmDraftSeed(codemeta: Record<string, any>) {
  return {
    access: { files: "public", record: "public" },
    files: { enabled: true },
    metadata: {
      title: codemeta.name ?? "Untitled software",
      creators: buildRdmCreators(codemeta),
      publication_date: new Date().toISOString().slice(0, 10),
      publisher: "Zenodo",
      resource_type: { id: "software" },
    },
  };
}

function buildRdmMetadata(
  codemeta: Record<string, any>,
  depositMeta: { accessRight: string; version: string },
  licenseId: string,
  draft: RdmRecord,
) {
  const keywords = Array.isArray(codemeta.keywords)
    ? codemeta.keywords.filter((keyword: unknown) =>
        Boolean(String(keyword ?? "").trim()),
      )
    : [];
  // Optional in InvenioRDM, but rejected when shorter than 3 characters.
  const description = String(codemeta.description ?? "").trim();
  return {
    access: {
      files: depositMeta.accessRight === "open" ? "public" : "restricted",
      record: depositMeta.accessRight === "open" ? "public" : "restricted",
    },
    files: { enabled: true },
    metadata: {
      title: codemeta.name ?? "Untitled software",
      creators: buildRdmCreators(codemeta),
      ...(description.length >= 3 && { description }),
      publication_date: new Date().toISOString().slice(0, 10),
      publisher: "Zenodo",
      resource_type: { id: "software" },
      rights: [{ id: licenseId.toLowerCase() }],
      version: depositMeta.version || codemeta.version || "",
      ...(keywords.length && {
        subjects: keywords.map((subject: unknown) => ({
          subject: String(subject),
        })),
      }),
    },
    ...(draft.pids && { pids: draft.pids }),
  };
}

// ===== Repo file helpers =============================================

const DOI_REGEX = /10\.\d{4,9}(?:\.\d+)?\/[-A-Za-z0-9:/_.;()[\]\\]+/;

/**
 * Normalises a raw DOI-ish string to a bare DOI (e.g. `10.5281/zenodo.123`).
 * @param raw - Raw DOI string, which may be a full URL or a bare DOI.
 * @returns A bare DOI string stripped of any `https://doi.org/` prefix.
 */
function normaliseDoi(raw: string): string {
  const trimmed = (raw ?? "").trim();
  const urlMatch = trimmed.match(/^https?:\/\/(?:dx\.)?doi\.org\/(.+)/i);
  if (urlMatch?.[1]) {
    const m = urlMatch[1].trim().match(DOI_REGEX);
    return m ? m[0] : urlMatch[1].trim();
  }
  const m = trimmed.match(DOI_REGEX);
  return m ? m[0] : trimmed;
}

/**
 * Commits updated `CITATION.cff` and `codemeta.json` to the repository's
 * default branch, injecting the Zenodo DOI and version.
 * @param provider - GitHub repository provider instance.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param doi - Raw DOI from Zenodo (may be a URL or bare DOI).
 * @param version - Release version string to inject into the metadata files.
 * @param licenseId - SPDX license identifier.
 * @returns The updated codemeta.json object.
 */
async function updateRepoMetadataWithDoi(
  provider: GitHubRepositoryProvider,
  owner: string,
  repo: string,
  doi: string,
  version: string,
  licenseId: string,
): Promise<Record<string, any>> {
  const today = new Date().toISOString().split("T")[0];
  const doiValue = normaliseDoi(doi);
  const doiUrl = `https://doi.org/${doiValue}`;

  // --- CITATION.cff ---
  const citationFile = await provider.getFileContent(
    owner,
    repo,
    "CITATION.cff",
  );
  if (citationFile?.content) {
    const parsed = yamlLoad(citationFile.content) as Record<string, any>;
    parsed.doi = doiValue;
    parsed["date-released"] = today;
    if (version) parsed.version = version;
    if (licenseId && licenseId !== "Custom") parsed.license = licenseId;

    await provider.commitFile(owner, repo, {
      branch: (await provider.getRepoInfo(owner, repo)).defaultBranch,
      content: Buffer.from(
        yamlDump(parsed, { indent: 2, noRefs: true }),
      ).toString("base64"),
      message: "chore: 📝 Update CITATION.cff with Zenodo identifier",
      path: "CITATION.cff",
      sha: citationFile.sha,
    });
    logwatch.info({
      action: "zenodo.updateRepoMetadata",
      doi: doiValue,
      message: "CITATION.cff updated with Zenodo DOI",
      owner,
      repo,
    });
  } else {
    logwatch.info({
      action: "zenodo.updateRepoMetadata",
      message: "CITATION.cff not found, skipping",
      owner,
      repo,
    });
  }

  // --- codemeta.json ---
  const codemetaFile = await provider.getFileContent(
    owner,
    repo,
    "codemeta.json",
  );
  if (!codemetaFile?.content) {
    throw new Error("codemeta.json not found in repository");
  }

  const codemeta = JSON.parse(codemetaFile.content) as Record<string, any>;
  codemeta.identifier = doiUrl;
  codemeta.dateModified = today;
  if (version) codemeta.version = version;
  if (licenseId && licenseId !== "Custom") {
    codemeta.license = `https://spdx.org/licenses/${licenseId}`;
  }

  await provider.commitFile(owner, repo, {
    branch: (await provider.getRepoInfo(owner, repo)).defaultBranch,
    content: Buffer.from(JSON.stringify(codemeta, null, 2)).toString("base64"),
    message: "chore: 📝 Update codemeta.json with Zenodo identifier",
    path: "codemeta.json",
    sha: codemetaFile.sha,
  });
  logwatch.info({
    action: "zenodo.updateRepoMetadata",
    doi: doiValue,
    message: "codemeta.json updated with Zenodo DOI",
    owner,
    repo,
  });

  return codemeta;
}

// ===== GitHub release helpers ========================================

/**
 * Downloads the zip archive of the repository's default branch to disk.
 * GitHub generates the archive on the fly without a Content-Length, so it is
 * saved first to learn its size before streaming it to Zenodo.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param token - GitHub user OAuth token.
 * @param destination - File path to write the archive to.
 * @param signal - Aborts the download.
 * @returns Size of the downloaded archive in bytes.
 */
async function downloadRepositoryZip(
  owner: string,
  repo: string,
  token: string,
  destination: string,
  signal?: AbortSignal,
): Promise<number> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/zipball`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "follow",
      signal,
    },
  );

  if (!res.ok || !res.body) {
    logwatch.error({
      action: "zenodo.downloadRepoZip",
      message: `Failed to download repository zip (${res.status})`,
      owner,
      repo,
      stack: new Error(
        `Failed to download repository zip: ${res.status} ${res.statusText}`,
      ).stack,
    });
    throw new HttpError(
      `Failed to download repository zip: ${res.status} ${res.statusText}`,
      res.status,
    );
  }

  await pipeline(
    Readable.fromWeb(res.body as NodeReadableStream<Uint8Array>),
    createWriteStream(destination),
    { signal },
  );
  const { size } = await stat(destination);
  logwatch.info({
    action: "zenodo.downloadRepoZip",
    bytes: size,
    message: "Repository zip downloaded",
    owner,
    repo,
  });
  return size;
}

/**
 * Fetches the release assets for a given GitHub release ID.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param releaseId - Numeric GitHub release ID as a string.
 * @param userToken - GitHub user OAuth token.
 * @returns Array of release asset descriptors with id, name, size, and url.
 */
async function fetchReleaseAssets(
  owner: string,
  repo: string,
  releaseId: string,
  userToken: string,
): Promise<Array<{ id: number; name: string; size: number; url: string }>> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${userToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!res.ok) {
    logwatch.error({
      action: "zenodo.fetchReleaseAssets",
      message: `Failed to fetch release assets (${res.status})`,
      owner,
      releaseId,
      repo,
      stack: new Error(
        `Failed to fetch release assets: ${res.status} ${res.statusText}`,
      ).stack,
    });
    throw new HttpError(
      `Failed to fetch release assets: ${res.status} ${res.statusText}`,
      res.status,
    );
  }

  const data = await res.json();
  const assets = (data ?? []).map((a: any) => ({
    id: a.id,
    name: a.name,
    size: a.size,
    url: a.url,
  }));
  logwatch.info({
    action: "zenodo.fetchReleaseAssets",
    assetCount: assets.length,
    message: "Release assets fetched",
    releaseId,
  });
  return assets;
}

/**
 * Opens a download stream for a single GitHub release asset.
 * @param assetUrl - GitHub asset download URL.
 * @param userToken - GitHub user OAuth token.
 * @param signal - Aborts the download.
 * @returns The asset's bytes as a stream.
 */
async function openReleaseAsset(
  assetUrl: string,
  userToken: string,
  signal?: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(assetUrl, {
    headers: {
      Accept: "application/octet-stream",
      Authorization: `Bearer ${userToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "follow",
    signal,
  });

  if (!res.ok || !res.body) {
    logwatch.error({
      action: "zenodo.downloadReleaseAsset",
      assetUrl,
      message: `Failed to download release asset (${res.status})`,
      stack: new Error(
        `Failed to download release asset: ${res.status} ${res.statusText}`,
      ).stack,
    });
    throw new HttpError(
      `Failed to download release asset: ${res.status} ${res.statusText}`,
      res.status,
    );
  }

  return res.body;
}

/**
 * Publishes a GitHub draft release (sets `draft: false`).
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param releaseId - Numeric GitHub release ID as a string.
 * @param userToken - GitHub user OAuth token.
 * @returns Resolves when the release has been published.
 */
async function publishGitHubRelease(
  owner: string,
  repo: string,
  releaseId: string,
  userToken: string,
): Promise<void> {
  // Fetch the repo's default branch so we can pass it as target_commitish.
  // Without target_commitish, GitHub returns 422 when the release's tag doesn't
  // exist as a git ref yet (phantom draft tags). Using the default branch name
  // (not a SHA) ensures GitHub resolves to the current HEAD - which includes the
  // metadata commit pushed in step 4.
  const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${userToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  const defaultBranch = repoRes.ok
    ? ((await repoRes.json()).default_branch as string | undefined)
    : undefined;

  const patchBody = {
    draft: false,
    ...(defaultBranch ? { target_commitish: defaultBranch } : {}),
  };

  logwatch.info({
    action: "zenodo.publishGitHubRelease",
    defaultBranch,
    message: "Patching GitHub release to published",
    owner,
    patchBody,
    releaseId,
    repo,
  });

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}`,
    {
      body: JSON.stringify(patchBody),
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${userToken}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: "PATCH",
    },
  );

  if (!res.ok) {
    let ghErrorBody = "";
    try {
      ghErrorBody = await res.text();
    } catch {
      // ignore
    }
    logwatch.error({
      action: "zenodo.publishGitHubRelease",
      ghErrorBody,
      message: `Failed to publish GitHub release (${res.status})`,
      owner,
      releaseId,
      repo,
      stack: new Error(
        `Failed to publish GitHub release: ${res.status} ${res.statusText}`,
      ).stack,
    });
    throw new HttpError(
      `Failed to publish GitHub release: ${res.status} ${res.statusText}`,
      res.status,
    );
  }

  logwatch.info({
    action: "zenodo.publishGitHubRelease",
    message: "GitHub draft release published",
    owner,
    releaseId,
    repo,
  });
}

// ===== Main orchestrator =============================================

/**
 * Loads and validates the repository metadata needed to seed an RDM draft.
 *
 * @returns Parsed codemeta and a validated SPDX license identifier.
 */
async function loadPublicationMetadata(
  installationId: number,
  owner: string,
  repo: string,
  repositoryId: number,
) {
  const provider = await GitHubRepositoryProvider.create(installationId);
  const codemetaFile = await provider.getFileContent(
    owner,
    repo,
    "codemeta.json",
  );
  if (!codemetaFile?.content)
    throw new Error("codemeta.json not found in repository");

  const codemeta = JSON.parse(codemetaFile.content) as Record<string, any>;
  const licenseDb = await prisma.licenseRequest.findFirst({
    where: { repository_id: repositoryId },
  });
  const rawLicenseUrl: string =
    codemeta.license ??
    (licenseDb?.license_id
      ? `https://spdx.org/licenses/${licenseDb.license_id}`
      : "");
  const matchedLicense = (licensesJson as any[]).find(
    (license) => license.detailsUrl === `${rawLicenseUrl}.json`,
  );
  const licenseId = matchedLicense?.licenseId ?? licenseDb?.license_id ?? "";
  if (!licenseId) {
    throw new Error(
      "Could not resolve a valid SPDX license ID for this repository",
    );
  }
  if (licenseId === "Custom") {
    throw new Error(
      "Custom licenses are not supported by Zenodo's API. Please select a valid SPDX license.",
    );
  }
  return { codemeta, licenseId };
}

/**
 * Saves the release form for a repository. An in-progress publication's draft
 * and status are kept unless the user moves to a different release or tag, so
 * saving never orphans a draft or a published record that a retry would finish.
 * @returns The saved deposition row.
 */
export async function saveZenodoReleaseSelection(selection: {
  metadata: { accessRight: string; version: string };
  release: string;
  repositoryId: number;
  tag: string;
  useExistingDeposition: boolean;
  userId: string;
}) {
  const releaseId = parseInt(selection.release) || null;
  const form = {
    existing_zenodo_deposition_id: selection.useExistingDeposition,
    github_release_id: releaseId,
    github_tag_name: selection.tag,
    user_id: selection.userId,
    zenodo_metadata: selection.metadata,
  };
  const existing = await prisma.zenodoDeposition.findFirst({
    where: { repository_id: selection.repositoryId },
  });
  if (!existing) {
    return prisma.zenodoDeposition.create({
      data: { ...form, repository_id: selection.repositoryId, status: "draft" },
    });
  }

  const sameRelease =
    existing.github_release_id === releaseId &&
    existing.github_tag_name === selection.tag;
  return prisma.zenodoDeposition.update({
    data: sameRelease
      ? form
      : {
          ...form,
          draft_target_zenodo_id: null,
          draft_zenodo_id: null,
          status: "draft",
        },
    where: { repository_id: selection.repositoryId },
  });
}

/** How often a running publication refreshes its lock. */
const PUBLISH_LOCK_HEARTBEAT_MS = 60_000;
/** A lock not refreshed for this long belongs to a publication that died. */
const PUBLISH_LOCK_STALE_MS = 5 * 60_000;

/**
 * Whether a publication is running for the repository, judged by a lock that
 * is still being refreshed.
 * @returns True while another publication holds a live lock.
 */
export async function isPublicationRunning(
  repositoryId: number,
): Promise<boolean> {
  const row = await prisma.zenodoDeposition.findFirst({
    where: { repository_id: repositoryId },
  });
  return Boolean(
    row?.publish_lock_at &&
    row.publish_lock_at.getTime() > Date.now() - PUBLISH_LOCK_STALE_MS,
  );
}

/**
 * Claims the repository's publication lock so only one publication runs at a
 * time. The claim is a single conditional update, so concurrent requests
 * cannot both win. The lock is refreshed until released; if the server dies
 * mid-publication it goes stale and can be claimed again.
 * @returns A function that releases the lock, or null when it is held.
 */
export async function claimPublicationLock(
  repositoryId: number,
): Promise<(() => Promise<void>) | null> {
  const now = new Date();
  const { count } = await prisma.zenodoDeposition.updateMany({
    data: { publish_lock_at: now },
    where: {
      OR: [
        { publish_lock_at: null },
        {
          publish_lock_at: {
            lt: new Date(now.getTime() - PUBLISH_LOCK_STALE_MS),
          },
        },
      ],
      repository_id: repositoryId,
    },
  });
  if (!count) return null;

  const heartbeat = setInterval(() => {
    prisma.zenodoDeposition
      .updateMany({
        data: { publish_lock_at: new Date() },
        where: { repository_id: repositoryId },
      })
      .catch((error: any) => {
        logwatch.warn({
          action: "zenodo.publishLock",
          error: error?.message,
          message: "Could not refresh the publication lock",
          repositoryId,
        });
      });
  }, PUBLISH_LOCK_HEARTBEAT_MS);

  return async () => {
    clearInterval(heartbeat);
    await prisma.zenodoDeposition
      .updateMany({
        data: { publish_lock_at: null },
        where: { repository_id: repositoryId },
      })
      .catch((error: any) => {
        logwatch.warn({
          action: "zenodo.publishLock",
          error: error?.message,
          message: "Could not release the publication lock",
          repositoryId,
        });
      });
  };
}

/** Runs the active Zenodo publication workflow through the InvenioRDM API. */
export async function beginZenodoPublication(
  opts: ArchivalPublicationOptions,
  onProgress?: ProgressCallback,
): Promise<PublicationResult> {
  const {
    installationId,
    metadata,
    owner,
    release,
    repo,
    repositoryId,
    tag,
    userAccessToken,
    userId,
  } = opts;

  const tokenRecord = await prisma.zenodoToken.findFirst({
    where: { user_id: userId },
  });
  if (!tokenRecord)
    return { error: "Zenodo token not found for user", success: false };

  const client = new ZenodoRdmClient(zenodoApiEndpoint(), tokenRecord.token);
  const checkpoint = await prisma.zenodoDeposition.findFirst({
    where: { repository_id: repositoryId },
  });

  const refreshDashboard = async () => {
    try {
      const provider = await GitHubRepositoryProvider.create(installationId);
      await refreshDashboardFromDb(provider, owner, repo, repositoryId);
    } catch (error: any) {
      logwatch.warn({
        action: "zenodo.publish",
        error: error?.message,
        message: "Failed to re-render dashboard after publication",
        owner,
        repo,
      });
    }
  };

  // Failures also go to the client over SSE, but it may have disconnected, so
  // every failure is recorded here too.
  const logFailure = (step: string, error: any, zenodoRecordId?: number) => {
    logwatch.error({
      action: "zenodo.publish",
      error: error?.message ?? String(error),
      message: `Zenodo publication failed at the ${step} step`,
      owner,
      repo,
      stack: error?.stack,
      step,
      userId,
      ...(zenodoRecordId && { zenodoRecordId }),
    });
  };

  // Zenodo is published while GitHub is still a draft: finish only the local
  // half of the transaction instead of minting another Zenodo version.
  const finishGitHubRelease = async (
    publishedDoi: string,
    recordId: number,
  ): Promise<PublicationResult> => {
    await onProgress?.({
      message: "Finishing the GitHub release for the published Zenodo record…",
      status: "in_progress",
      step: "publish",
    });
    try {
      await publishGitHubRelease(owner, repo, release, userAccessToken);
      await prisma.zenodoDeposition.update({
        data: { status: "published" },
        where: { repository_id: repositoryId },
      });
      await refreshDashboard();
      const data = {
        doi: publishedDoi,
        htmlUrl: `${zenodoEndpoint()}/records/${recordId}`,
      };
      await onProgress?.({
        data,
        message: "Successfully published to Zenodo!",
        status: "completed",
        step: "publish",
      });
      return { data, success: true };
    } catch (error: any) {
      logFailure("publish", error, recordId);
      await onProgress?.({
        message: error.message,
        status: "error",
        step: "publish",
      });
      return { error: error.message, success: false };
    }
  };

  if (
    checkpoint?.status === "zenodo-published" &&
    checkpoint.github_release_id === (parseInt(release) || null) &&
    checkpoint.github_tag_name === tag &&
    checkpoint.zenodo_id &&
    checkpoint.last_published_zenodo_doi
  ) {
    return finishGitHubRelease(
      checkpoint.last_published_zenodo_doi,
      checkpoint.zenodo_id,
    );
  }

  await onProgress?.({
    message: "Loading repository metadata…",
    status: "in_progress",
    step: "metadata",
  });
  let codemeta: Record<string, any>;
  let licenseId: string;
  try {
    ({ codemeta, licenseId } = await loadPublicationMetadata(
      installationId,
      owner,
      repo,
      repositoryId,
    ));
  } catch (error: any) {
    logFailure("metadata", error);
    await onProgress?.({
      message: error.message,
      status: "error",
      step: "metadata",
    });
    return { error: error.message, success: false };
  }
  await onProgress?.({
    message: "Metadata loaded",
    status: "completed",
    step: "metadata",
  });

  await onProgress?.({
    message: "Preparing Zenodo record draft…",
    status: "in_progress",
    step: "deposition",
  });

  // The record the user asked for: an existing record to version, or null for
  // a new deposition.
  const target = opts.mode === "existing" ? (opts.depositionId ?? null) : null;

  // The user changed their target after a failed attempt. Drafts this workflow
  // created are discarded; a draft the user picked themselves is left alone.
  const abandonDraft = async (draftId: number, draftTarget: number | null) => {
    if (draftId === draftTarget) return;
    await client.discardDraft(draftId).catch((cleanupError: any) => {
      logwatch.warn({
        action: "zenodo.abandonDraft",
        error: cleanupError.message,
        message: `Could not discard abandoned draft ${draftId}`,
        owner,
        repo,
      });
    });
  };

  // The previous draft may have been deleted on zenodo.org, or belong to
  // another maintainer whose token cannot read it. Either way it is gone for
  // this run, which then starts over with the selected target.
  const resolvePreviousDraft = async (draftId: number) => {
    try {
      return await client.resolveState(draftId);
    } catch (error) {
      if (
        error instanceof HttpError &&
        [403, 404, 410].includes(error.status)
      ) {
        return { kind: "missing" as const };
      }
      throw error;
    }
  };

  let workingDraft!: WorkingDraft;
  let workingRecordId = 0;
  let draftCheckpointSaved = false;
  let repositoryMutationStarted = false;
  try {
    // A retry for the same target resumes the previous attempt's draft. Its
    // state on Zenodo decides what happens next, since an attempt can fail
    // after Zenodo publishes, or the user can publish it on zenodo.org.
    let resumedDraft: WorkingDraft | undefined;
    const previousDraftId = checkpoint?.draft_zenodo_id ?? null;
    const previousTarget = checkpoint?.draft_target_zenodo_id ?? null;
    if (previousDraftId && previousTarget === target) {
      const state = await resolvePreviousDraft(previousDraftId);
      if (state.kind === "published") {
        const publishedDoi = extractRecordDoi(state.record);
        if (!publishedDoi) {
          throw new Error(
            `Zenodo record ${previousDraftId} is published but has no DOI`,
          );
        }
        await prisma.zenodoDeposition.update({
          data: {
            draft_target_zenodo_id: null,
            draft_zenodo_id: null,
            existing_zenodo_deposition_id: true,
            last_published_zenodo_doi: publishedDoi,
            status: "zenodo-published",
            zenodo_id: previousDraftId,
          },
          where: { repository_id: repositoryId },
        });
        await onProgress?.({
          message: "The Zenodo record was already published",
          status: "completed",
          step: "deposition",
        });
        return finishGitHubRelease(publishedDoi, previousDraftId);
      }
      if (state.kind === "draft") {
        resumedDraft = { origin: "reused_draft", record: state.record };
      } else {
        logwatch.warn({
          action: "zenodo.resumeDraft",
          message: `Draft ${previousDraftId} from the previous attempt is gone, starting over`,
          owner,
          repo,
        });
      }
    } else if (previousDraftId) {
      await abandonDraft(previousDraftId, previousTarget);
    }

    workingDraft =
      resumedDraft ??
      (await client.acquireWorkingDraft(
        opts.mode,
        opts.depositionId,
        buildRdmDraftSeed(codemeta),
      ));
    workingRecordId = Number(workingDraft.record.id);
    if (!Number.isFinite(workingRecordId) || workingRecordId <= 0) {
      throw new Error("Zenodo returned a draft without a usable record ID");
    }

    // zenodo_id stays the last published record (the dashboard badge links to
    // it); the draft and the record it versions are tracked separately.
    const draftCheckpoint = {
      draft_target_zenodo_id: target,
      draft_zenodo_id: workingRecordId,
      status: "draft",
    };
    if (checkpoint) {
      await prisma.zenodoDeposition.update({
        data: draftCheckpoint,
        where: { repository_id: repositoryId },
      });
    } else {
      await prisma.zenodoDeposition.create({
        data: {
          ...draftCheckpoint,
          github_release_id: parseInt(release) || null,
          github_tag_name: tag,
          repository_id: repositoryId,
          user_id: userId,
          zenodo_metadata: metadata,
        },
      });
    }
    draftCheckpointSaved = true;
    await client.purgeDraftFiles(workingRecordId);
  } catch (error: any) {
    if (
      workingRecordId &&
      !draftCheckpointSaved &&
      ["new_deposition", "new_version"].includes(workingDraft?.origin)
    ) {
      await client.discardDraft(workingRecordId).catch((cleanupError: any) => {
        logwatch.warn({
          action: "zenodo.cleanupUncheckpointedDraft",
          error: cleanupError.message,
          message: `Could not discard uncheckpointed draft ${workingRecordId}`,
        });
      });
    }
    logFailure("deposition", error, workingRecordId || undefined);
    await onProgress?.({
      message: error.message,
      status: "error",
      step: "deposition",
    });
    return { error: error.message, success: false };
  }

  await onProgress?.({
    message: "Zenodo record draft ready",
    status: "completed",
    step: "deposition",
  });

  const failDraft = async (
    error: any,
    step: "upload_metadata" | "update_repo" | "upload_files" | "publish",
  ) => {
    const message = error?.message ?? String(error);
    logFailure(step, error, workingRecordId);
    if (
      workingDraft.origin === "new_deposition" &&
      !repositoryMutationStarted
    ) {
      try {
        await client.discardDraft(workingRecordId);
        await prisma.zenodoDeposition.update({
          data: {
            draft_target_zenodo_id: null,
            draft_zenodo_id: null,
            status: "error",
          },
          where: { repository_id: repositoryId },
        });
      } catch (cleanupError: any) {
        await prisma.zenodoDeposition.update({
          data: { status: "error" },
          where: { repository_id: repositoryId },
        });
        logwatch.warn({
          action: "zenodo.cleanupDraft",
          error: cleanupError.message,
          message: `Draft ${workingRecordId} was retained for a safe retry`,
        });
      }
    } else {
      await prisma.zenodoDeposition
        .update({
          data: { status: "error" },
          where: { repository_id: repositoryId },
        })
        .catch(() => undefined);
    }
    await onProgress?.({ message, status: "error", step });
    return { error: message, success: false } as PublicationResult;
  };

  await onProgress?.({
    message: "Reserving a DOI and updating Zenodo metadata…",
    status: "in_progress",
    step: "upload_metadata",
  });
  let doi: string;
  try {
    // A draft PUT replaces the complete record. Update metadata first, then
    // reserve the DOI so the reservation cannot be erased by a later PUT.
    const updatedDraft = await client.updateMetadata(
      workingRecordId,
      buildRdmMetadata(codemeta, metadata, licenseId, workingDraft.record),
    );
    doi = await client.reserveDoi(workingRecordId, updatedDraft);
  } catch (error: any) {
    return failDraft(error, "upload_metadata");
  }
  await onProgress?.({
    message: "Zenodo metadata updated",
    status: "completed",
    step: "upload_metadata",
  });

  await onProgress?.({
    message: "Committing DOI to repository metadata files…",
    status: "in_progress",
    step: "update_repo",
  });
  repositoryMutationStarted = true;
  try {
    const provider = await GitHubRepositoryProvider.create(installationId);
    codemeta = await updateRepoMetadataWithDoi(
      provider,
      owner,
      repo,
      doi,
      metadata.version,
      licenseId,
    );
  } catch (error: any) {
    return failDraft(error, "update_repo");
  }
  await onProgress?.({
    message: "Repository metadata files updated",
    status: "completed",
    step: "update_repo",
  });

  await onProgress?.({
    message: "Fetching release assets from GitHub…",
    status: "in_progress",
    step: "upload_files",
  });
  let workDir: string | undefined;
  try {
    workDir = await mkdtemp(join(tmpdir(), "codefair-zenodo-"));
    const zipPath = join(workDir, "source.zip");
    const assets = await fetchReleaseAssets(
      owner,
      repo,
      release,
      userAccessToken,
    );

    // Release assets stream straight from GitHub to Zenodo. The source archive
    // goes first: GitHub only reveals its size once it has been downloaded,
    // so starting it early completes the byte totals sooner.
    const sources: Array<{
      name: string;
      prepare: (signal: AbortSignal) => Promise<UploadSource>;
      size?: number;
    }> = [
      {
        name: `${repo}-${tag}.zip`,
        prepare: async (signal) => ({
          open: () =>
            Promise.resolve(
              Readable.toWeb(
                createReadStream(zipPath),
              ) as ReadableStream<Uint8Array>,
            ),
          size: await downloadRepositoryZip(
            owner,
            repo,
            userAccessToken,
            zipPath,
            signal,
          ),
        }),
      },
      ...assets.map((asset) => ({
        name: asset.name,
        prepare: () =>
          Promise.resolve({
            open: (signal?: AbortSignal) =>
              openReleaseAsset(asset.url, userAccessToken, signal),
            size: asset.size,
          }),
        size: asset.size,
      })),
    ];

    const files: ZenodoUploadFileProgress[] = sources.map(({ name, size }) => ({
      name,
      size,
      status: "pending",
    }));
    await onProgress?.({
      message: `Uploading ${files.length} file${files.length === 1 ? "" : "s"} to Zenodo…`,
      status: "in_progress",
      step: "upload_files",
      upload: {
        files: structuredClone(files),
        maxAttempts: UPLOAD_MAX_ATTEMPTS,
        type: "list",
      },
    });

    await runConcurrently(
      sources.length,
      zenodoUploadConcurrency(),
      async (index, signal) => {
        const file = files[index]!;
        const position = `${index + 1} of ${files.length}`;
        const reportUpload = (message: string) =>
          onProgress?.({
            message,
            status: "in_progress",
            step: "upload_files",
            upload: { file: { ...file }, index, type: "file" },
          });

        try {
          if (file.size === undefined) {
            file.status = "downloading";
            await reportUpload(
              `Downloading ${file.name} from GitHub (${position})…`,
            );
          }
          const source = await sources[index]!.prepare(signal);
          file.size = source.size;

          const startedAt = Date.now();
          let lastBytesReport = 0;
          await client.uploadFile(workingRecordId, file.name, source, {
            onBytes: (sent) => {
              file.uploadedBytes = sent;
              if (Date.now() - lastBytesReport < UPLOAD_PROGRESS_INTERVAL_MS) {
                return;
              }
              lastBytesReport = Date.now();
              reportUpload(`Uploading ${file.name} to Zenodo (${position})…`);
            },
            onPhase: async (event) => {
              file.attempt = event.attempt;
              file.status = event.phase;
              if (event.phase !== "committing") file.uploadedBytes = 0;
              if (event.phase === "retrying") {
                logwatch.warn({
                  action: "zenodo.uploadFile",
                  attempt: event.attempt,
                  error: event.error,
                  file: file.name,
                  message: `Retrying upload of ${file.name} (attempt ${event.attempt} of ${UPLOAD_MAX_ATTEMPTS})`,
                  owner,
                  repo,
                });
              }
              await reportUpload(
                event.phase === "uploading"
                  ? `Uploading ${file.name} to Zenodo (${position})…`
                  : event.phase === "committing"
                    ? `Finalizing ${file.name} on Zenodo (${position})…`
                    : `Retrying ${file.name} (attempt ${event.attempt} of ${UPLOAD_MAX_ATTEMPTS})…`,
              );
            },
            signal,
          });

          file.status = "completed";
          logwatch.info({
            action: "zenodo.uploadFile",
            bytes: source.size,
            durationMs: Date.now() - startedAt,
            file: file.name,
            message: `Uploaded ${file.name} to Zenodo (${position})`,
            owner,
            repo,
          });
          await reportUpload(`Uploaded ${file.name} (${position})`);
        } catch (error) {
          // Before the abort, this file is the one that failed; after it, the
          // transfer was only cancelled because another file failed.
          file.status = signal.aborted ? "pending" : "error";
          file.uploadedBytes = 0;
          await reportUpload(
            signal.aborted
              ? `Cancelled ${file.name} (${position})`
              : `Failed to upload ${file.name} (${position})`,
          );
          throw error;
        }
      },
    );
  } catch (error: any) {
    return failDraft(error, "upload_files");
  } finally {
    if (workDir) {
      await rm(workDir, { force: true, recursive: true }).catch(
        () => undefined,
      );
    }
  }
  await onProgress?.({
    message: "Files uploaded to Zenodo",
    status: "completed",
    step: "upload_files",
  });

  await onProgress?.({
    message: "Publishing to Zenodo and releasing on GitHub…",
    status: "in_progress",
    step: "publish",
  });
  let publishedDoi = doi;
  let htmlUrl = `${zenodoEndpoint()}/records/${workingRecordId}`;
  try {
    try {
      const published = await client.publish(workingRecordId);
      publishedDoi = published.doi ?? doi;
      htmlUrl = published.recordUrl || htmlUrl;
    } catch (publishError: any) {
      // The connection can fail after Zenodo commits the publication. Resolve
      // the remote state before deciding that publication failed.
      const state = await client.resolveState(workingRecordId);
      if (state.kind !== "published") throw publishError;
      publishedDoi = extractRecordDoi(state.record) ?? doi;
      htmlUrl =
        state.record.links?.self_html ??
        state.record.links?.record_html ??
        state.record.links?.latest_html ??
        htmlUrl;
    }

    await prisma.zenodoDeposition.update({
      data: {
        draft_target_zenodo_id: null,
        draft_zenodo_id: null,
        existing_zenodo_deposition_id: true,
        last_published_zenodo_doi: publishedDoi,
        status: "zenodo-published",
        zenodo_id: workingRecordId,
      },
      where: { repository_id: repositoryId },
    });

    await publishGitHubRelease(owner, repo, release, userAccessToken);
    await prisma.zenodoDeposition.update({
      data: { status: "published" },
      where: { repository_id: repositoryId },
    });
    await refreshDashboard();
  } catch (error: any) {
    // Keep zenodo-published checkpoints intact so a retry finishes GitHub only.
    const latest = await prisma.zenodoDeposition.findFirst({
      where: { repository_id: repositoryId },
    });
    if (latest?.status === "zenodo-published") {
      logFailure("publish", error, workingRecordId);
      await onProgress?.({
        message: error.message,
        status: "error",
        step: "publish",
      });
      return { error: error.message, success: false };
    }
    return failDraft(error, "publish");
  }

  const data = { doi: publishedDoi, htmlUrl };
  await onProgress?.({
    data,
    message: "Successfully published to Zenodo!",
    status: "completed",
    step: "publish",
  });
  logwatch.info({
    action: "zenodo.publish.complete",
    doi: publishedDoi,
    message: "InvenioRDM publication workflow completed successfully",
    owner,
    repo,
    userId,
  });
  return { data, success: true };
}

// ===== ArchivalProvider implementation ==============================

/**
 * Zenodo implementation of `ArchivalProvider`.
 * Instantiate once and share across requests.
 */
export class ZenodoProvider implements ArchivalProvider {
  /**
   * @param userId - Codefair user ID whose Zenodo token should be validated.
   * @returns Token validation result including existing depositions on success.
   */
  validateToken(userId: string): Promise<ArchivalTokenValidation> {
    return validateZenodoToken(userId);
  }

  /**
   * @param state - Opaque state string to echo back in the OAuth callback.
   * @returns Full Zenodo OAuth authorization URL.
   */
  getLoginUrl(state: string): string {
    const base = zenodoEndpoint();
    const clientId = process.env.ZENODO_CLIENT_ID ?? "";
    const redirectUri = process.env.ZENODO_REDIRECT_URI ?? "";
    const scope = encodeURIComponent("deposit:write deposit:actions");
    return `${base}/oauth/authorize?response_type=code&client_id=${clientId}&scope=${scope}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  /**
   * @param opts - Publication options including repo details, user token, and metadata.
   * @param onProgress - Optional callback to receive incremental progress events.
   * @returns Publication result with DOI and HTML URL on success, or an error message.
   */
  beginPublication(
    opts: ArchivalPublicationOptions,
    onProgress?: ProgressCallback,
  ): Promise<PublicationResult> {
    return beginZenodoPublication(opts, onProgress);
  }
}

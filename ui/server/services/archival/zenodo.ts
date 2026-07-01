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

import { load as yamlLoad, dump as yamlDump } from "js-yaml";
import type {
  ArchivalProvider,
  ArchivalPublicationOptions,
  ArchivalTokenValidation,
  ExistingDeposition,
  ProgressCallback,
  ProgressStep,
  PublicationResult,
} from "./interface";
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

// Request timeouts so a stalled network call can never hang the publication
// workflow indefinitely. Metadata/API calls are quick; file up/downloads and
// the repo zipball can be large, so they get a much longer budget.
const ZENODO_API_TIMEOUT_MS = 60_000; // metadata / publish / deposition / API calls
const ZENODO_UPLOAD_TIMEOUT_MS = 300_000; // file up/downloads & repo zipball

// ===== Error helper ==================================================

/**
 * Extracts a useful error string from a failed Zenodo API response,
 * including the response body for validation details.
 * @param operation - Human-readable label for the operation that failed.
 * @param response - The failed fetch Response object.
 * @returns A formatted error string including the HTTP status and response body.
 */
async function getZenodoErrorMessage(
  operation: string,
  response: Response,
): Promise<string> {
  let body = "";
  try {
    body = await response.text();
  } catch {
    // ignore body read errors
  }
  return `${operation}: ${response.status} ${response.statusText}${body ? ` — ${body}` : ""}`;
}

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
    signal: AbortSignal.timeout(ZENODO_API_TIMEOUT_MS),
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

  const { access_token, expires_in, refresh_token } = await res.json();

  await prisma.zenodoToken.update({
    data: {
      expires_at: new Date(Date.now() + expires_in * 1000),
      refresh_token,
      token: access_token,
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

  const res = await fetch(`${zenodoApiEndpoint()}/deposit/depositions`, {
    headers: { Authorization: `Bearer ${tokenRecord.token}` },
    signal: AbortSignal.timeout(ZENODO_API_TIMEOUT_MS),
  });

  if (!res.ok) {
    // Token invalid or expired - remove it so the user is prompted to reconnect
    await prisma.zenodoToken.delete({ where: { user_id: userId } });
    logwatch.warn({
      action: "zenodo.validateToken",
      message: `Zenodo token invalid or expired (${res.status}), token deleted`,
      userId,
    });
    return {
      existingDepositions: [],
      message: "Zenodo token is invalid or expired",
      valid: false,
    };
  }

  // Token is valid - extend the session
  await refreshZenodoToken(userId, tokenRecord.refresh_token);

  const data = await res.json();
  const existingDepositions: ExistingDeposition[] = (data ?? []).map(
    (d: any) => ({
      id: d.id,
      title: d.metadata?.title ?? "",
      conceptrecid: d.conceptrecid,
      state: d.state,
      submitted: d.submitted,
    }),
  );

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

// ===== Deposition management =========================================

/**
 * Creates a new empty Zenodo deposition and returns the deposition object.
 * @param token - Zenodo OAuth access token.
 * @returns The newly created deposition object from the Zenodo API.
 */
async function createNewZenodoDeposition(token: string): Promise<any> {
  const res = await fetch(`${zenodoApiEndpoint()}/deposit/depositions`, {
    body: JSON.stringify({}),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(ZENODO_API_TIMEOUT_MS),
  });

  if (!res.ok) {
    const msg = await getZenodoErrorMessage("createNewZenodoDeposition", res);
    throw new Error(msg);
  }

  const deposition = await res.json();
  logwatch.info({
    action: "zenodo.createDeposition",
    depositionId: deposition.record_id,
    message: "New Zenodo deposition created",
  });
  return deposition;
}

/**
 * Fetches an existing deposition.
 * First attempts to resolve the latest published version via
 * `/records/{id}/versions/latest`; falls back to the draft endpoint
 * `/deposit/depositions/{id}` when the record is not yet published (404).
 * @param token - Zenodo OAuth access token.
 * @param depositionId - Numeric Zenodo deposition record ID.
 * @returns The deposition object from the Zenodo API.
 */
async function fetchExistingZenodoDeposition(
  token: string,
  depositionId: number,
): Promise<any> {
  const latestRes = await fetch(
    `${zenodoApiEndpoint()}/records/${depositionId}/versions/latest`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(ZENODO_API_TIMEOUT_MS),
    },
  );

  if (latestRes.status === 404) {
    // Not yet published - try the draft endpoint
    logwatch.warn({
      action: "zenodo.fetchDeposition",
      depositionId,
      message: "Latest version not found (404), falling back to draft endpoint",
    });
    const draftRes = await fetch(
      `${zenodoApiEndpoint()}/deposit/depositions/${depositionId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(ZENODO_API_TIMEOUT_MS),
      },
    );

    if (!draftRes.ok) {
      const msg = await getZenodoErrorMessage(
        "fetchExistingZenodoDeposition (draft)",
        draftRes,
      );
      throw new Error(msg);
    }

    const draft = await draftRes.json();
    logwatch.info({
      action: "zenodo.fetchDeposition",
      depositionId,
      message: "Fetched existing deposition as draft",
    });
    return draft;
  }

  if (!latestRes.ok) {
    const msg = await getZenodoErrorMessage(
      "fetchExistingZenodoDeposition (latest)",
      latestRes,
    );
    throw new Error(msg);
  }

  const latest = await latestRes.json();
  logwatch.info({
    action: "zenodo.fetchDeposition",
    depositionId,
    message: "Fetched latest published version of deposition",
  });
  return latest;
}

/**
 * Creates a new draft version of an already-published deposition.
 * @param token - Zenodo OAuth access token.
 * @param depositionId - Numeric ID of the published deposition to version.
 * @returns The new draft deposition object.
 */
async function createNewVersionOfDeposition(
  token: string,
  depositionId: number,
): Promise<any> {
  const url = `${zenodoApiEndpoint()}/deposit/depositions/${depositionId}/actions/newversion`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
    signal: AbortSignal.timeout(ZENODO_API_TIMEOUT_MS),
  });

  if (!res.ok) {
    const msg = await getZenodoErrorMessage(
      "createNewVersionOfDeposition",
      res,
    );
    logwatch.error({
      action: "zenodo.createNewVersion",
      depositionId,
      message: `Failed to create new version of deposition (${res.status})`,
      stack: new Error(msg).stack,
    });
    throw new Error(msg);
  }

  const newVersion = await res.json();
  logwatch.info({
    action: "zenodo.createNewVersion",
    message: "New draft version created for existing deposition",
    newDepositionId: newVersion.record_id,
    previousDepositionId: depositionId,
  });
  return newVersion;
}

/**
 * Deletes a single file from a Zenodo draft deposition.
 * @param depositionId - Numeric ID of the draft deposition.
 * @param token - Zenodo OAuth access token.
 * @param fileName - Name of the file to delete.
 * @returns Resolves when the file has been deleted.
 */
async function deleteFileFromZenodo(
  depositionId: number,
  token: string,
  fileName: string,
): Promise<void> {
  const res = await fetch(
    `${zenodoApiEndpoint()}/records/${depositionId}/draft/files/${encodeURIComponent(fileName)}?access_token=${token}`,
    {
      method: "DELETE",
      signal: AbortSignal.timeout(ZENODO_API_TIMEOUT_MS),
    },
  );

  if (!res.ok) {
    const msg = await getZenodoErrorMessage(
      `deleteFileFromZenodo (${fileName})`,
      res,
    );
    logwatch.error({
      action: "zenodo.deleteFile",
      depositionId,
      fileName,
      message: `Failed to delete file from Zenodo deposition (${res.status})`,
      stack: new Error(msg).stack,
    });
    throw new Error(msg);
  }
}

/**
 * Returns the working draft deposition to upload files into.
 *
 * - `"new"` - creates a fresh deposition.
 * - `"existing"` - resolves the latest version; if already published creates a
 *   new draft version; if still a draft deletes all existing files.
 *
 * In both existing deposition cases any pre-existing files in the draft are
 * removed so we start with a clean slate.
 * @param mode - Whether to create a new deposition or reuse an existing one.
 * @param depositionId - Required when mode is "existing"; the target deposition ID.
 * @param token - Zenodo OAuth access token.
 * @returns The working draft deposition object ready to receive file uploads.
 */
async function getWorkingDeposition(
  mode: "new" | "existing",
  depositionId: number | undefined,
  token: string,
): Promise<any> {
  if (mode === "new") {
    logwatch.info({
      action: "zenodo.getWorkingDeposition",
      message: "Creating new deposition",
    });
    return createNewZenodoDeposition(token);
  }

  // mode === "existing"
  const existing = await fetchExistingZenodoDeposition(token, depositionId!);

  if (existing.submitted === false) {
    // It's an unsubmitted draft — purge its files then reuse it
    logwatch.info({
      action: "zenodo.getWorkingDeposition",
      depositionId,
      message: "Reusing existing unsubmitted draft, purging files",
    });
    for (const file of existing.files ?? []) {
      await deleteFileFromZenodo(depositionId!, token, file.filename);
    }
    return existing;
  }

  // Submitted (published) - create a new version draft
  logwatch.info({
    action: "zenodo.getWorkingDeposition",
    depositionId,
    message: "Deposition already published, creating new version draft",
  });
  const newVersion = await createNewVersionOfDeposition(
    token,
    existing.id ?? depositionId!,
  );

  for (const file of newVersion.files ?? []) {
    await deleteFileFromZenodo(newVersion.record_id, token, file.filename);
  }

  return newVersion;
}

// ===== Metadata helpers =============================================

/**
 * Builds the Zenodo metadata payload from a parsed `codemeta.json` object,
 * the pre-reserved DOI, and optional user-supplied overrides.
 * @param codemeta - Parsed codemeta.json object from the repository.
 * @param depositMeta - User-supplied access right and version overrides.
 * @param repositoryId - Prisma repository ID.
 * @param doi - Pre-reserved DOI string from the deposition.
 * @param licenseId - SPDX license identifier.
 * @returns Zenodo metadata payload object ready for a PUT request.
 */
function buildZenodoMetadata(
  codemeta: Record<string, any>,
  depositMeta: { accessRight: string; version: string },
  doi: string,
  licenseId: string,
): { metadata: Record<string, any> } {
  const today = new Date().toISOString().split("T")[0];

  const creators = (codemeta.author ?? [])
    .filter((a: any) => a?.type !== "Role")
    .map((a: any) => {
      const entry: Record<string, string> = {};
      entry.name = a.familyName
        ? `${a.familyName}, ${a.givenName ?? ""}`
        : (a.givenName ?? a.name ?? "Unknown");
      if (a.affiliation?.name) entry.affiliation = a.affiliation.name;
      if (a.orcid) entry.orcid = a.orcid;
      return entry;
    });

  return {
    metadata: {
      title: codemeta.name ?? "",
      access_right: depositMeta.accessRight || "open",
      creators,
      description: codemeta.description ?? "",
      keywords: codemeta.keywords ?? [],
      license: licenseId,
      prereserve_doi: { doi },
      publication_date: today,
      upload_type: "software",
      version: depositMeta.version || codemeta.version || "",
    },
  };
}

// ===== Zenodo API write helpers =====================================

/**
 * Updates the metadata on an existing Zenodo draft deposition.
 * Automatically re-applies `upload_type: "software"` if Zenodo strips it.
 * @param depositionId - Numeric ID of the draft deposition to update.
 * @param token - Zenodo OAuth access token.
 * @param metadata - Zenodo metadata payload as returned by buildZenodoMetadata.
 * @returns The updated deposition object from the Zenodo API.
 */
async function updateDepositionMetadata(
  depositionId: number,
  token: string,
  metadata: Record<string, any>,
): Promise<any> {
  const url = `${zenodoApiEndpoint()}/deposit/depositions/${depositionId}`;
  const res = await fetch(url, {
    body: JSON.stringify(metadata),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "PUT",
    signal: AbortSignal.timeout(ZENODO_API_TIMEOUT_MS),
  });

  if (!res.ok) {
    const msg = await getZenodoErrorMessage("updateDepositionMetadata", res);
    logwatch.error({
      action: "zenodo.updateMetadata",
      depositionId,
      message: `Failed to update deposition metadata (${res.status})`,
      stack: new Error(msg).stack,
    });
    throw new Error(msg);
  }

  const updated = await res.json();

  // Zenodo can strip upload_type - re-apply if missing
  if (!updated?.metadata?.upload_type) {
    logwatch.info({
      action: "zenodo.updateMetadata",
      depositionId,
      message: "Zenodo stripped upload_type, re-applying 'software'",
    });
    const fixed = { ...updated.metadata, upload_type: "software" };
    return updateDepositionMetadata(depositionId, token, { metadata: fixed });
  }

  logwatch.info({
    action: "zenodo.updateMetadata",
    depositionId,
    message: "Deposition metadata updated",
  });
  return updated;
}

/**
 * Uploads a single file to a Zenodo deposition bucket.
 * @param bucketUrl - Zenodo S3 bucket URL from deposition.links.bucket.
 * @param token - Zenodo OAuth access token.
 * @param filename - Name to give the file in the deposition.
 * @param content - Raw file bytes.
 * @returns Resolves when the upload is complete.
 */
async function uploadFileToZenodoBucket(
  bucketUrl: string,
  token: string,
  filename: string,
  content: Blob | Buffer | ArrayBuffer,
): Promise<void> {
  const url = `${bucketUrl}/${encodeURIComponent(filename)}`;
  const res = await fetch(url, {
    body: content as BodyInit,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
    },
    method: "PUT",
    signal: AbortSignal.timeout(ZENODO_UPLOAD_TIMEOUT_MS),
  });

  if (!res.ok) {
    const msg = await getZenodoErrorMessage(
      `uploadFileToZenodoBucket (${filename})`,
      res,
    );
    logwatch.error({
      action: "zenodo.uploadFile",
      filename,
      message: `Failed to upload file to Zenodo bucket (${res.status})`,
      stack: new Error(msg).stack,
    });
    throw new Error(msg);
  }

  logwatch.info({
    action: "zenodo.uploadFile",
    filename,
    message: "File uploaded to Zenodo bucket",
  });
}

/**
 * Publishes a Zenodo draft deposition.
 * @param token - Zenodo OAuth access token.
 * @param depositionId - Numeric ID of the draft deposition to publish.
 * @returns The published deposition object from the Zenodo API.
 */
async function publishZenodoDeposition(
  token: string,
  depositionId: number,
): Promise<any> {
  const url = `${zenodoApiEndpoint()}/deposit/depositions/${depositionId}/actions/publish`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(ZENODO_API_TIMEOUT_MS),
  });

  if (!res.ok) {
    const msg = await getZenodoErrorMessage("publishZenodoDeposition", res);
    logwatch.error({
      action: "zenodo.publishDeposition",
      depositionId,
      message: `Failed to publish Zenodo deposition (${res.status})`,
      stack: new Error(msg).stack,
    });
    throw new Error(msg);
  }

  const published = await res.json();
  logwatch.info({
    action: "zenodo.publishDeposition",
    depositionId,
    doi: published.doi,
    message: "Zenodo deposition published",
  });
  return published;
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
 * Downloads the zip archive of the repository's default branch.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param token - GitHub user OAuth token.
 * @returns Raw zip archive bytes as an ArrayBuffer.
 */
async function downloadRepositoryZip(
  owner: string,
  repo: string,
  token: string,
): Promise<ArrayBuffer> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/zipball`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(ZENODO_UPLOAD_TIMEOUT_MS),
    },
  );

  if (!res.ok) {
    logwatch.error({
      action: "zenodo.downloadRepoZip",
      message: `Failed to download repository zip (${res.status})`,
      owner,
      repo,
      stack: new Error(
        `Failed to download repository zip: ${res.status} ${res.statusText}`,
      ).stack,
    });
    throw new Error(
      `Failed to download repository zip: ${res.status} ${res.statusText}`,
    );
  }

  const bytes = await res.arrayBuffer();
  logwatch.info({
    action: "zenodo.downloadRepoZip",
    message: "Repository zip downloaded",
    owner,
    repo,
  });
  return bytes;
}

/**
 * Fetches the release assets for a given GitHub release ID.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param releaseId - Numeric GitHub release ID as a string.
 * @param userToken - GitHub user OAuth token.
 * @returns Array of release asset descriptors with id, name, and url.
 */
async function fetchReleaseAssets(
  owner: string,
  repo: string,
  releaseId: string,
  userToken: string,
): Promise<Array<{ id: number; name: string; url: string }>> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${userToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(ZENODO_API_TIMEOUT_MS),
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
    throw new Error(
      `Failed to fetch release assets: ${res.status} ${res.statusText}`,
    );
  }

  const data = await res.json();
  const assets = (data ?? []).map((a: any) => ({
    id: a.id,
    name: a.name,
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
 * Downloads a single GitHub release asset by its URL and returns the raw bytes.
 * @param assetUrl - GitHub asset download URL.
 * @param userToken - GitHub user OAuth token.
 * @returns Raw asset bytes as an ArrayBuffer.
 */
async function downloadReleaseAsset(
  assetUrl: string,
  userToken: string,
): Promise<ArrayBuffer> {
  const res = await fetch(assetUrl, {
    headers: {
      Accept: "application/octet-stream",
      Authorization: `Bearer ${userToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(ZENODO_UPLOAD_TIMEOUT_MS),
  });

  if (!res.ok) {
    logwatch.error({
      action: "zenodo.downloadReleaseAsset",
      assetUrl,
      message: `Failed to download release asset (${res.status})`,
      stack: new Error(
        `Failed to download release asset: ${res.status} ${res.statusText}`,
      ).stack,
    });
    throw new Error(
      `Failed to download release asset: ${res.status} ${res.statusText}`,
    );
  }

  return res.arrayBuffer();
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
    signal: AbortSignal.timeout(ZENODO_API_TIMEOUT_MS),
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
      signal: AbortSignal.timeout(ZENODO_API_TIMEOUT_MS),
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
    throw new Error(
      `Failed to publish GitHub release: ${res.status} ${res.statusText}`,
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
 * Runs the full Zenodo publication workflow, reporting progress via `onProgress`.
 *
 * Steps:
 *  1. deposition - create or resolve the working Zenodo draft
 *  2. metadata - fetch repo codemeta.json + resolve license
 *  3. upload_metadata - push metadata to Zenodo
 *  4. update_repo - commit DOI-updated metadata files to the default branch
 *  5. upload_files - upload release assets + repo zip to Zenodo bucket
 *  6. publish - publish Zenodo deposition + GitHub release + DB update
 * @param opts - Publication options including repo details, user token, and metadata.
 * @param onProgress - Optional callback to receive incremental progress events.
 * @returns Publication result with DOI and HTML URL on success, or an error message.
 */
export async function beginZenodoPublication(
  opts: ArchivalPublicationOptions,
  onProgress?: ProgressCallback,
): Promise<PublicationResult> {
  const {
    installationId,
    metadata,
    mode,
    owner,
    release,
    repo,
    repositoryId,
    tag,
    userAccessToken,
    userId,
  } = opts;

  const depositionId = opts.depositionId;

  logwatch.info({
    action: "zenodo.publish.start",
    message: "Zenodo publication workflow started",
    mode,
    owner,
    repo,
    userId,
  });

  // Retrieve token
  const tokenRecord = await prisma.zenodoToken.findFirst({
    where: { user_id: userId },
  });

  if (!tokenRecord) {
    logwatch.error({
      action: "zenodo.publish.start",
      message: "Zenodo token not found for user, aborting publication",
      owner,
      repo,
      userId,
    });
    return { error: "Zenodo token not found for user", success: false };
  }

  const token = tokenRecord.token;

  // Mark the deposition as actively publishing. This lets a dropped SSE stream
  // be reconciled against the DB: "publishing" means the workflow is still
  // running, distinct from a "draft" (saved but not started) or a terminal
  // "published"/"error" state. The row was already upserted by the POST handler.
  await prisma.zenodoDeposition
    .update({
      data: { status: "publishing" },
      where: { repository_id: repositoryId },
    })
    .catch(() => undefined);

  /**
   * Records a workflow step failure: logs it, marks the deposition row as
   * errored (so a dropped SSE stream reconciles to a real failure instead of a
   * false "still running"), emits an SSE error event, and returns the failed
   * result. Used by every step's catch so failures are persisted uniformly.
   * @param step - The workflow step that failed.
   * @param err - The thrown error.
   * @returns A failed PublicationResult carrying the error message.
   */
  const failPublication = async (
    step: ProgressStep,
    err: any,
  ): Promise<PublicationResult> => {
    logwatch.error({
      action: `zenodo.publish.${step}`,
      error: err.stack ?? err.message,
      message: err.message,
      owner,
      repo,
      userId,
    });
    await prisma.zenodoDeposition
      .update({
        data: { status: "error" },
        where: { repository_id: repositoryId },
      })
      .catch(() => undefined);
    await onProgress?.({
      message: err.message,
      status: "error",
      step,
    });
    return { error: err.message, success: false };
  };

  // == Step 1: deposition ===================================
  await onProgress?.({
    message: "Preparing Zenodo deposition…",
    status: "in_progress",
    step: "deposition",
  });

  let deposition: any;
  try {
    deposition = await getWorkingDeposition(mode, depositionId, token);
  } catch (err: any) {
    return await failPublication("deposition", err);
  }

  const newDepositionId: number = deposition.record_id;
  const bucketUrl: string = deposition.links.bucket;
  const doi: string = deposition.metadata.prereserve_doi.doi;

  // Upsert DB record. Keep status "publishing" (set above) so the workflow
  // stays reconcilable as in-progress through the long upload steps below.
  const existingDep = await prisma.zenodoDeposition.findFirst({
    where: { repository_id: repositoryId },
  });

  if (existingDep) {
    await prisma.zenodoDeposition.update({
      data: {
        github_release_id: parseInt(release) || null,
        github_tag_name: tag,
        status: "publishing",
        user_id: userId,
        zenodo_id: newDepositionId,
        zenodo_metadata: metadata,
      },
      where: { repository_id: repositoryId },
    });
  } else {
    await prisma.zenodoDeposition.create({
      data: {
        existing_zenodo_deposition_id: mode === "existing",
        github_release_id: parseInt(release) || null,
        github_tag_name: tag,
        repository_id: repositoryId,
        status: "publishing",
        user_id: userId,
        zenodo_id: newDepositionId,
        zenodo_metadata: metadata,
      },
    });
  }

  await onProgress?.({
    message: "Deposition ready",
    status: "completed",
    step: "deposition",
  });

  // == Step 2: metadata ===================================
  await onProgress?.({
    message: "Loading repository metadata…",
    status: "in_progress",
    step: "metadata",
  });

  let codemeta: Record<string, any>;
  let licenseId: string;

  try {
    const provider = await GitHubRepositoryProvider.create(installationId);
    const codemetaFile = await provider.getFileContent(
      owner,
      repo,
      "codemeta.json",
    );

    if (!codemetaFile?.content) {
      throw new Error("codemeta.json not found in repository");
    }

    codemeta = JSON.parse(codemetaFile.content);

    // Resolve license: prefer codemeta, fall back to DB
    const licenseDb = await prisma.licenseRequest.findFirst({
      where: { repository_id: repositoryId },
    });

    const rawLicenseUrl: string =
      codemeta.license ??
      (licenseDb?.license_id
        ? `https://spdx.org/licenses/${licenseDb.license_id}`
        : "");

    const matchedLicense = (licensesJson as any[]).find(
      (l) => l.detailsUrl === `${rawLicenseUrl}.json`,
    );

    licenseId = matchedLicense?.licenseId ?? licenseDb?.license_id ?? "";

    if (!licenseId) {
      logwatch.warn({
        action: "zenodo.publish.metadata",
        licenseDb,
        message:
          "Could not resolve a valid SPDX license ID for this repository",
        owner,
        repo,
        userId,
      });
      throw new Error(
        `Could not resolve a valid SPDX license ID for this repository`,
      );
    }

    if (licenseId === "Custom") {
      logwatch.warn({
        action: "zenodo.publish.metadata",
        licenseDb,
        message: "Custom license detected, which is not supported by Zenodo",
        owner,
        repo,
        userId,
      });
      throw new Error(
        "Custom licenses are not supported by Zenodo's API. Please select a valid SPDX license.",
      );
    }
  } catch (err: any) {
    return await failPublication("metadata", err);
  }

  await onProgress?.({
    message: "Metadata loaded",
    status: "completed",
    step: "metadata",
  });

  // == Step 3: upload_metadata =================================
  await onProgress?.({
    message: "Updating metadata on Zenodo…",
    status: "in_progress",
    step: "upload_metadata",
  });

  try {
    const zenodoMeta = buildZenodoMetadata(codemeta, metadata, doi, licenseId);
    await updateDepositionMetadata(newDepositionId, token, zenodoMeta);
  } catch (err: any) {
    return await failPublication("upload_metadata", err);
  }

  await onProgress?.({
    message: "Zenodo metadata updated",
    status: "completed",
    step: "upload_metadata",
  });

  // == Step 4: update_repo ========================
  await onProgress?.({
    message: "Committing DOI to repository metadata files…",
    status: "in_progress",
    step: "update_repo",
  });

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
  } catch (err: any) {
    return await failPublication("update_repo", err);
  }

  await onProgress?.({
    message: "Repository metadata files updated",
    status: "completed",
    step: "update_repo",
  });

  // == Step 5: upload_files ========================
  await onProgress?.({
    message: "Uploading files to Zenodo…",
    status: "in_progress",
    step: "upload_files",
  });

  try {
    // Upload release assets
    const assets = await fetchReleaseAssets(
      owner,
      repo,
      release,
      userAccessToken,
    );

    for (const asset of assets) {
      const bytes = await downloadReleaseAsset(asset.url, userAccessToken);
      await uploadFileToZenodoBucket(bucketUrl, token, asset.name, bytes);
    }

    // Upload repository zip archive
    const zipBytes = await downloadRepositoryZip(owner, repo, userAccessToken);
    const zipFilename = `${repo}-${tag}.zip`;
    await uploadFileToZenodoBucket(bucketUrl, token, zipFilename, zipBytes);
  } catch (err: any) {
    return await failPublication("upload_files", err);
  }

  await onProgress?.({
    message: "Files uploaded to Zenodo",
    status: "completed",
    step: "upload_files",
  });

  // == Step 6: publish ============================================
  await onProgress?.({
    message: "Publishing to Zenodo and releasing on GitHub…",
    status: "in_progress",
    step: "publish",
  });

  let publishedDoi: string;
  let htmlUrl: string;

  try {
    const published = await publishZenodoDeposition(token, newDepositionId);
    publishedDoi = published.doi ?? doi;
    htmlUrl = published.links?.latest_html ?? "";

    // Publish the GitHub draft release
    await publishGitHubRelease(owner, repo, release, userAccessToken);

    // Update DB
    await prisma.zenodoDeposition.update({
      data: {
        existing_zenodo_deposition_id: true,
        last_published_zenodo_doi: publishedDoi,
        status: "published",
        zenodo_id: newDepositionId,
      },
      where: { repository_id: repositoryId },
    });

    // Re-render the dashboard issue from current DB state
    try {
      const provider = await GitHubRepositoryProvider.create(installationId);
      await refreshDashboardFromDb(provider, owner, repo, repositoryId);
    } catch (renderErr: any) {
      logwatch.warn({
        action: "zenodo.publish",
        error: renderErr?.message,
        message: "Failed to re-render dashboard after publication",
        owner,
        repo,
      });
    }
  } catch (err: any) {
    return await failPublication("publish", err);
  }

  await onProgress?.({
    data: { doi: publishedDoi, htmlUrl },
    message: "Successfully published to Zenodo!",
    status: "completed",
    step: "publish",
  });

  logwatch.info({
    action: "zenodo.publish.complete",
    doi: publishedDoi,
    message: "Zenodo publication workflow completed successfully",
    owner,
    repo,
    userId,
  });

  return { data: { doi: publishedDoi, htmlUrl }, success: true };
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

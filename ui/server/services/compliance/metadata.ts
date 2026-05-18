/**
 * Metadata compliance service (codemeta.json + CITATION.cff).
 */
import yaml from "js-yaml";
import type { RepositoryProvider } from "../providers/interface";
import prisma from "~/server/utils/prisma";
import { createId } from "~/server/utils/cuid";
import { logwatch } from "~/server/utils/logwatch";

// == Metadata shape stored in CodeMetadata.metadata ==========================

export interface AuthorRecord {
  affiliation: string;
  email: string;
  familyName: string;
  givenName: string;
  roles: { endDate: number | null; role: string; startDate: number | null }[];
  uri?: string;
}

export interface MetadataRecord {
  name: string;
  applicationCategory: string | null;
  authors: AuthorRecord[];
  codeRepository: string;
  continuousIntegration: string;
  contributors: AuthorRecord[];
  creationDate: number | null;
  currentVersion: string;
  currentVersionDownloadURL: string;
  currentVersionReleaseDate: number | null;
  currentVersionReleaseNotes: string;
  description: string;
  developmentStatus: string | null;
  firstReleaseDate: number | null;
  fundingCode: string;
  fundingOrganization: string;
  isPartOf: string;
  isSourceCodeOf: string;
  issueTracker: string;
  keywords: string[];
  license: string | null;
  operatingSystem: string[];
  otherSoftwareRequirements: string[];
  programmingLanguages: string[];
  referencePublication: string;
  relatedLinks: string[];
  reviewAspect: string;
  reviewBody: string;
  runtimePlatform: string[];
  uniqueIdentifier: string;
}

type LogCtx = { installationId?: number; owner?: string; repo?: string };

const VALIDATOR_URL = process.env.VALIDATOR_URL ?? "";

// == Types =====================================================================

export interface MetadataExistsResult {
  citation: boolean;
  codemeta: boolean;
}

export interface FileInfo {
  content: string;
  downloadUrl: string | null;
  /** Raw download URL (used by citation validator). */
  sha: string;
}

export interface ValidationResult {
  details?: Record<string, unknown> | null;
  isValid: boolean;
  message: string;
  status: "valid" | "invalid" | "unknown";
}

// == Helpers ===================================================================

/**
 * Strips a leading BOM character and trims whitespace from raw file content.
 * @param raw - Raw string content read from a file.
 * @returns Cleaned string ready for parsing.
 */
function normalizeText(raw: string): string {
  return raw.replace(/^\uFEFF/, "").trim();
}

/**
 * Constructs a successful {@link ValidationResult}.
 * @param message - Human-readable success message.
 * @param details - Optional structured details from the validator.
 */
function makeValid(
  message: string,
  details?: Record<string, unknown> | null,
): ValidationResult {
  return { details: details ?? null, isValid: true, message, status: "valid" };
}

/**
 * Constructs a failed {@link ValidationResult} with a known-invalid status.
 * @param message - Human-readable failure message.
 * @param details - Optional structured details from the validator.
 */
function makeInvalid(
  message: string,
  details?: Record<string, unknown> | null,
): ValidationResult {
  return {
    details: details ?? null,
    isValid: false,
    message,
    status: "invalid",
  };
}

/**
 * Constructs a {@link ValidationResult} for cases where validity cannot be determined
 * (e.g., the validator service returned an unexpected error).
 * @param message - Human-readable description of what went wrong.
 * @param details - Optional structured details (e.g., HTTP status, raw response).
 */
function makeUnknown(
  message: string,
  details?: Record<string, unknown> | null,
): ValidationResult {
  return {
    details: details ?? null,
    isValid: false,
    message,
    status: "unknown",
  };
}

/**
 * Constructs a {@link ValidationResult} from a caught exception.
 * @param error - The error that was thrown during validation.
 */
function makeError(error: Error): ValidationResult {
  return {
    details: { error: error.message },
    isValid: false,
    message: `Validation error: ${error.message}`,
    status: "unknown",
  };
}

// == Validation (fetch calls to Flask validator) =================================

/**
 * Validates a `codemeta.json` file against the Flask validator service.
 * Performs local JSON parsing and required-field checks before making the
 * remote call, so malformed files are rejected without a network round-trip.
 * @param info - File content and metadata retrieved from the repository.
 * @returns A {@link ValidationResult} describing whether the file is valid.
 */
async function validateCodemeta(
  info: FileInfo,
  ctx?: LogCtx,
): Promise<ValidationResult> {
  const logCtx = { action: "metadata.validate.codemeta", ...ctx };

  if (!info.content) {
    logwatch.warn({
      ...logCtx,
      message: "codemeta.json content is null or undefined",
    });
    return makeInvalid("codemeta.json content is null or undefined");
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(normalizeText(info.content));
  } catch (err: any) {
    logwatch.warn({
      ...logCtx,
      error: err.message,
      message: "Failed to parse codemeta.json as JSON",
      stack: err.stack,
    });
    return makeInvalid(`Invalid JSON in codemeta.json: ${err.message}`);
  }

  const missing = ["name", "author", "description"].filter((f) => !obj[f]);
  if (missing.length) {
    logwatch.warn({
      ...logCtx,
      message: "codemeta.json is missing required fields",
      missingFields: missing,
    });
    return makeInvalid(`Required fields missing: ${missing.join(", ")}`);
  }

  try {
    const resp = await fetch(`${VALIDATOR_URL}/validate-codemeta`, {
      body: JSON.stringify({ file_content: obj }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await resp.json()) as {
      error?: string;
      message?: string;
      version?: string;
    };
    if (!resp.ok) {
      logwatch.warn({
        ...logCtx,
        message: "Codemeta validator returned non-ok response",
        statusCode: resp.status,
      });
      return makeUnknown(`Validator returned error (${resp.status})`, {
        response: result,
        statusCode: resp.status,
      });
    }
    return result.message === "valid"
      ? makeValid(
          `Codemeta valid according to schema [v${result.version}](https://github.com/fairdataihub/codefair-app/blob/main/validator/${result.version === "3.0" ? "codemeta-schema.json" : "codemeta-schema2.0.json"})`,
          {
            version: result.version,
          },
        )
      : makeInvalid(result.error ?? "Validation failed", {
          version: result.version,
        });
  } catch (err: any) {
    logwatch.error({
      ...logCtx,
      error: err.message,
      message: "Fetch to codemeta validator failed",
      stack: err.stack,
    });
    return makeError(err);
  }
}

/**
 * Validates a `CITATION.cff` file against the Flask validator service.
 * Performs local YAML parsing and required-field checks before making the
 * remote call. The validator receives the file's raw download URL rather than
 * its content because the citation validator fetches the file itself.
 * @param info - File content and metadata retrieved from the repository.
 * @returns A {@link ValidationResult} describing whether the file is valid.
 */
async function validateCitation(
  info: FileInfo,
  ctx?: LogCtx,
): Promise<ValidationResult> {
  const logCtx = { action: "metadata.validate.citation", ...ctx };

  if (!info.content) {
    logwatch.warn({
      ...logCtx,
      message: "CITATION.cff content is null or undefined",
    });
    return makeInvalid("CITATION.cff content is null or undefined");
  }

  let doc: any;
  try {
    doc = yaml.load(normalizeText(info.content));
  } catch (err: any) {
    logwatch.warn({
      ...logCtx,
      error: err.message,
      message: "Failed to parse CITATION.cff as YAML",
      stack: err.stack,
    });
    return makeInvalid(`Invalid YAML in CITATION.cff: ${err.message}`);
  }

  if (!doc?.title || !Array.isArray(doc.authors) || doc.authors.length === 0) {
    logwatch.warn({
      ...logCtx,
      hasAuthors: Array.isArray(doc?.authors) && doc.authors.length > 0,
      hasTitle: Boolean(doc?.title),
      message: "CITATION.cff is missing required fields",
    });
    return makeInvalid("Required fields (title, authors) missing or empty");
  }

  try {
    const resp = await fetch(`${VALIDATOR_URL}/validate-citation`, {
      body: JSON.stringify({ file_path: info.downloadUrl }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const result = (await resp.json()) as {
      error?: string;
      message?: string;
      output?: string;
    };
    if (!resp.ok) {
      logwatch.warn({
        ...logCtx,
        message: "Citation validator returned non-ok response",
        statusCode: resp.status,
      });
      return makeUnknown(`Validator returned error (${resp.status})`, {
        response: result,
        statusCode: resp.status,
      });
    }
    return result.message === "valid"
      ? makeValid(
          result.output
            ? "Citation valid according to the schema [v1.2.0](https://github.com/citation-file-format/citation-file-format/blob/main/schema.json)"
            : "Valid CITATION.cff",
        )
      : makeInvalid(result.error ?? "Validation failed");
  } catch (err: any) {
    logwatch.error({
      ...logCtx,
      error: err.message,
      message: "Fetch to citation validator failed",
      stack: err.stack,
    });
    return makeError(err);
  }
}

// == Public API =========================================================

/**
 * Checks whether `codemeta.json` and `CITATION.cff` exist in the repository.
 * @param provider - Repository provider used to fetch file contents.
 * @param owner - GitHub owner (user or organisation) of the repository.
 * @param repo - Repository name.
 * @returns An object indicating which metadata files are present.
 */
export async function checkMetadataFilesExists(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
): Promise<MetadataExistsResult> {
  const [codemetaFile, citationFile] = await Promise.all([
    provider.getFileContent(owner, repo, "codemeta.json"),
    provider.getFileContent(owner, repo, "CITATION.cff"),
  ]);
  return {
    citation: citationFile !== null,
    codemeta: codemetaFile !== null,
  };
}

/**
 * Validates a metadata file via the Flask validator service.
 * Delegates to the appropriate type-specific validator based on `fileType`.
 * @param info - File content and metadata retrieved from the repository.
 * @param fileType - Which metadata file to validate (`"codemeta"` or `"citation"`).
 * @returns A {@link ValidationResult} describing whether the file is valid.
 */
export function validateMetadata(
  info: FileInfo,
  fileType: "codemeta" | "citation",
  ctx?: LogCtx,
): Promise<ValidationResult> {
  switch (fileType) {
    case "codemeta":
      return validateCodemeta(info, ctx);
    case "citation":
      return validateCitation(info, ctx);
    default:
      logwatch.warn({
        action: "metadata.validate",
        ...ctx,
        fileType,
        message: "validateMetadata called with unsupported file type",
      });
      return Promise.resolve(makeInvalid(`Unsupported file type: ${fileType}`));
  }
}

// == Metadata conversion helpers (ported from bot/compliance-checks/metadata/index.js) ==

function convertDateToUnix(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const ts = Date.parse(dateStr);
  return Number.isNaN(ts) ? null : ts;
}

/**
 * Converts a raw codemeta.json object to the normalised DB metadata shape.
 * Handles author/contributor role splitting and SPDX license URL extraction.
 */
export function convertCodemetaForDB(
  obj: Record<string, any>,
): Partial<MetadataRecord> {
  const sortedAuthors: AuthorRecord[] = [];
  const sortedContributors: AuthorRecord[] = [];

  if (Array.isArray(obj?.author)) {
    obj.author.forEach((a: any) => {
      if (a.type === "Person" || a.type === "Organization") {
        sortedAuthors.push({
          affiliation: a.affiliation?.name ?? a.affiliation ?? "",
          email: a.email ?? "",
          familyName: a.familyName ?? "",
          givenName: a.givenName ?? "",
          roles: [],
          uri: a["@id"] ?? a.id ?? "",
        });
      }
    });
    obj.author.forEach((a: any) => {
      if (a.type === "Role") {
        const targetUri = a["schema:author"] ?? a.author ?? "";
        const match = sortedAuthors.find((au) => au.uri === targetUri);
        if (match) {
          match.roles.push({
            endDate: convertDateToUnix(a.endDate),
            role: a.roleName ?? "",
            startDate: convertDateToUnix(a.startDate),
          });
        }
      }
    });
  }

  if (Array.isArray(obj?.contributor)) {
    obj.contributor.forEach((c: any) => {
      if (c.type === "Person" || c.type === "Organization") {
        sortedContributors.push({
          affiliation: c.affiliation?.name ?? c.affiliation ?? "",
          email: c.email ?? "",
          familyName: c.familyName ?? "",
          givenName: c.givenName ?? "",
          roles: [],
          uri: c["@id"] ?? c.id ?? "",
        });
      }
    });
    obj.contributor.forEach((c: any) => {
      if (c.type === "Role") {
        const targetUri = c["schema:contributor"] ?? c.contributor ?? "";
        const match = sortedContributors.find((co) => co.uri === targetUri);
        if (match) {
          match.roles.push({
            endDate: convertDateToUnix(c.endDate),
            role: c.roleName ?? "",
            startDate: convertDateToUnix(c.startDate),
          });
        }
      }
    });
  }

  // Strip blank-node URIs
  for (const a of sortedAuthors) {
    if (a.uri?.startsWith("_:")) delete a.uri;
  }
  for (const c of sortedContributors) {
    if (c.uri?.startsWith("_:")) delete c.uri;
  }

  // Extract SPDX ID from license URL
  let licenseId: string | null = null;
  if (obj?.license) {
    const m = String(obj.license).match(/https:\/\/spdx\.org\/licenses\/(.*)/);
    if (m) licenseId = m[1];
  }

  return {
    name: obj?.name ?? null,
    applicationCategory: obj?.applicationCategory ?? null,
    authors: sortedAuthors,
    codeRepository: obj?.codeRepository ?? "",
    continuousIntegration: obj?.["codemeta:continuousIntegration"]?.id ?? "",
    contributors: sortedContributors,
    creationDate: convertDateToUnix(obj?.dateCreated),
    currentVersion: obj?.version ?? "",
    currentVersionDownloadURL: obj?.downloadUrl ?? "",
    currentVersionReleaseDate: convertDateToUnix(obj?.dateModified),
    currentVersionReleaseNotes: obj?.["schema:releaseNotes"] ?? "",
    description: obj?.description ?? "",
    developmentStatus: obj?.developmentStatus ?? null,
    firstReleaseDate: convertDateToUnix(obj?.datePublished),
    fundingCode: obj?.funding ?? "",
    fundingOrganization: obj?.funder?.name ?? "",
    isPartOf: obj?.isPartOf ?? "",
    isSourceCodeOf: obj?.["codemeta:isSourceCodeOf"]?.id ?? "",
    issueTracker: obj?.issueTracker ?? "",
    keywords: obj?.keywords ?? [],
    license: licenseId,
    operatingSystem: obj?.operatingSystem ?? [],
    otherSoftwareRequirements: obj?.softwareRequirements ?? [],
    programmingLanguages: obj?.programmingLanguage ?? [],
    referencePublication: obj?.referencePublication ?? "",
    relatedLinks: obj?.relatedLink ?? [],
    reviewAspect: obj?.reviewAspect ?? "",
    reviewBody: obj?.reviewBody ?? "",
    runtimePlatform: obj?.runtimePlatform ?? [],
    uniqueIdentifier: obj?.identifier ?? "",
  };
}

/**
 * Converts a raw CITATION.cff YAML object to a partial DB metadata shape.
 */
export function convertCitationForDB(
  doc: Record<string, any>,
): Partial<MetadataRecord> {
  const authors: AuthorRecord[] = [];
  if (Array.isArray(doc?.authors)) {
    for (const a of doc.authors) {
      authors.push({
        affiliation: a.affiliation ?? "",
        email: a.email ?? "",
        familyName: a["family-names"] ?? "",
        givenName: a["given-names"] ?? "",
        roles: [],
      });
    }
  }
  return {
    authors,
    codeRepository: doc?.["repository-code"] ?? "",
    currentVersion: doc?.version ? String(doc.version) : "",
    currentVersionReleaseDate: doc?.["date-released"]
      ? convertDateToUnix(String(doc["date-released"]))
      : null,
    description: doc?.abstract ?? "",
    keywords: doc?.keywords ?? [],
    license: doc?.license ?? null,
    uniqueIdentifier: doc?.doi ?? "",
  };
}

/**
 * Gathers base metadata from the GitHub API via the provider.
 * Equivalent to the bot's `gatherMetadata()`.
 */
export async function gatherBaseMetadata(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
): Promise<MetadataRecord> {
  const [repoInfo, languages, contributors, releases] = await Promise.all([
    provider.getRepoInfo(owner, repo),
    provider.listLanguages(owner, repo),
    provider.listContributors(owner, repo),
    provider.listReleases(owner, repo),
  ]);

  // Try to find a DOI in the README
  let doi = "";
  try {
    const readme = await provider.getFileContent(owner, repo, "README.md");
    if (readme?.content) {
      const m = readme.content.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i);
      if (m) doi = m[0];
    }
  } catch {
    // Non-critical — swallow
  }

  const latestRelease = releases[0];
  const mappedAuthors: AuthorRecord[] = contributors
    .filter((c) => c.type !== "Bot")
    .map((c) => ({
      affiliation: c.company ?? "",
      email: c.email ?? "",
      familyName: "",
      givenName: c.name ?? c.login,
      roles: [],
    }));

  return {
    name: repoInfo.name,
    applicationCategory: null,
    authors: mappedAuthors,
    codeRepository: repoInfo.htmlUrl,
    continuousIntegration: "",
    contributors: [],
    creationDate: repoInfo.createdAt ?? null,
    currentVersion: latestRelease?.tagName ?? "",
    currentVersionDownloadURL: latestRelease?.htmlUrl ?? "",
    currentVersionReleaseDate: latestRelease?.publishedAt ?? null,
    currentVersionReleaseNotes: latestRelease?.body ?? "",
    description: repoInfo.description ?? "",
    developmentStatus: null,
    firstReleaseDate: latestRelease?.publishedAt ?? null,
    fundingCode: "",
    fundingOrganization: "",
    isPartOf: "",
    isSourceCodeOf: "",
    issueTracker: `https://github.com/${owner}/${repo}/issues`,
    keywords: repoInfo.topics,
    license: repoInfo.license,
    operatingSystem: [],
    otherSoftwareRequirements: [],
    programmingLanguages: languages,
    referencePublication: doi,
    relatedLinks: [],
    reviewAspect: "",
    reviewBody: "",
    runtimePlatform: [],
    uniqueIdentifier: "",
  };
}

/**
 * Overlays existing DB metadata on top of freshly gathered data,
 * preserving user edits. Equivalent to the bot's `applyDbMetadata()`.
 */
export function applyDbMetadata(
  existingMetadata: Record<string, any>,
  metadata: MetadataRecord,
): MetadataRecord {
  const e = existingMetadata;
  metadata.name = e.name || metadata.name || "";
  metadata.authors = e.authors || metadata.authors || [];
  metadata.contributors = e.contributors || metadata.contributors || [];
  metadata.applicationCategory =
    e.applicationCategory ?? metadata.applicationCategory ?? null;
  metadata.codeRepository = e.codeRepository || metadata.codeRepository || "";
  metadata.continuousIntegration =
    e.continuousIntegration || metadata.continuousIntegration || "";
  metadata.creationDate = e.creationDate ?? metadata.creationDate ?? null;
  metadata.currentVersion = e.currentVersion || metadata.currentVersion || "";
  metadata.currentVersionDownloadURL =
    e.currentVersionDownloadURL || metadata.currentVersionDownloadURL || "";
  metadata.currentVersionReleaseDate =
    e.currentVersionReleaseDate ?? metadata.currentVersionReleaseDate ?? null;
  metadata.currentVersionReleaseNotes =
    e.currentVersionReleaseNotes || metadata.currentVersionReleaseNotes || "";
  metadata.description = e.description || metadata.description || "";
  metadata.developmentStatus =
    e.developmentStatus ?? metadata.developmentStatus ?? null;
  metadata.firstReleaseDate =
    e.firstReleaseDate ?? metadata.firstReleaseDate ?? null;
  metadata.fundingCode = e.fundingCode || metadata.fundingCode || "";
  metadata.fundingOrganization =
    e.fundingOrganization || metadata.fundingOrganization || "";
  metadata.isPartOf = e.isPartOf || metadata.isPartOf || "";
  metadata.isSourceCodeOf = e.isSourceCodeOf || metadata.isSourceCodeOf || "";
  metadata.issueTracker = e.issueTracker || metadata.issueTracker || "";
  metadata.keywords = e.keywords || metadata.keywords || [];
  metadata.license = e.license ?? metadata.license ?? null;
  metadata.operatingSystem =
    e.operatingSystem || metadata.operatingSystem || [];
  metadata.otherSoftwareRequirements =
    e.otherSoftwareRequirements || metadata.otherSoftwareRequirements || [];
  metadata.programmingLanguages =
    e.programmingLanguages || metadata.programmingLanguages || [];
  metadata.referencePublication =
    e.referencePublication || metadata.referencePublication || "";
  metadata.relatedLinks = e.relatedLinks || metadata.relatedLinks || [];
  metadata.reviewAspect = e.reviewAspect || metadata.reviewAspect || "";
  metadata.reviewBody = e.reviewBody || metadata.reviewBody || "";
  metadata.runtimePlatform =
    e.runtimePlatform || metadata.runtimePlatform || [];
  metadata.uniqueIdentifier =
    e.uniqueIdentifier || metadata.uniqueIdentifier || "";

  metadata.authors = metadata.authors.map((a) => ({
    ...a,
    roles: a.roles ?? [],
  }));
  return metadata;
}

/**
 * Parses codemeta.json content and merges it into the metadata object.
 * codemeta takes precedence over existing DB and GitHub API values.
 */
export function applyCodemetaMetadata(
  content: string,
  metadata: MetadataRecord,
): MetadataRecord {
  let obj: Record<string, any>;
  try {
    obj = JSON.parse(normalizeText(content));
  } catch {
    return metadata;
  }
  const cm = convertCodemetaForDB(obj);

  metadata.name = cm.name || metadata.name || "";
  metadata.applicationCategory =
    cm.applicationCategory ?? metadata.applicationCategory ?? null;
  metadata.codeRepository = cm.codeRepository || metadata.codeRepository || "";
  metadata.continuousIntegration =
    cm.continuousIntegration || metadata.continuousIntegration || "";
  metadata.creationDate = cm.creationDate ?? metadata.creationDate ?? null;
  metadata.currentVersion = cm.currentVersion || metadata.currentVersion || "";
  metadata.currentVersionDownloadURL =
    cm.currentVersionDownloadURL || metadata.currentVersionDownloadURL || "";
  metadata.currentVersionReleaseDate =
    cm.currentVersionReleaseDate ?? metadata.currentVersionReleaseDate ?? null;
  metadata.currentVersionReleaseNotes =
    cm.currentVersionReleaseNotes || metadata.currentVersionReleaseNotes || "";
  metadata.description = cm.description || metadata.description || "";
  metadata.developmentStatus =
    cm.developmentStatus ?? metadata.developmentStatus ?? null;
  metadata.firstReleaseDate =
    cm.firstReleaseDate ?? metadata.firstReleaseDate ?? null;
  metadata.fundingCode = cm.fundingCode || metadata.fundingCode || "";
  metadata.fundingOrganization =
    cm.fundingOrganization || metadata.fundingOrganization || "";
  metadata.isPartOf = cm.isPartOf || metadata.isPartOf || "";
  metadata.isSourceCodeOf = cm.isSourceCodeOf || metadata.isSourceCodeOf || "";
  metadata.issueTracker = cm.issueTracker || metadata.issueTracker || "";
  metadata.keywords = cm.keywords?.length ? cm.keywords : metadata.keywords;
  metadata.license = cm.license ?? metadata.license ?? null;
  metadata.operatingSystem = cm.operatingSystem?.length
    ? cm.operatingSystem
    : metadata.operatingSystem;
  metadata.otherSoftwareRequirements = cm.otherSoftwareRequirements?.length
    ? cm.otherSoftwareRequirements
    : metadata.otherSoftwareRequirements;
  metadata.programmingLanguages = cm.programmingLanguages?.length
    ? cm.programmingLanguages
    : metadata.programmingLanguages;
  metadata.referencePublication =
    cm.referencePublication || metadata.referencePublication || "";
  metadata.relatedLinks = cm.relatedLinks?.length
    ? cm.relatedLinks
    : metadata.relatedLinks;
  metadata.reviewAspect = cm.reviewAspect || metadata.reviewAspect || "";
  metadata.reviewBody = cm.reviewBody || metadata.reviewBody || "";
  metadata.runtimePlatform = cm.runtimePlatform?.length
    ? cm.runtimePlatform
    : metadata.runtimePlatform;
  metadata.uniqueIdentifier =
    cm.uniqueIdentifier || metadata.uniqueIdentifier || "";

  // Merge authors (match by familyName+givenName, merge roles)
  if (cm.authors && cm.authors.length > 0) {
    const updated = cm.authors.map((incoming) => {
      const existing = metadata.authors.find(
        (a) =>
          a.familyName === incoming.familyName &&
          a.givenName === incoming.givenName,
      );
      if (!existing) return incoming;
      const mergedRoles = [
        ...(existing.roles ?? []),
        ...(incoming.roles ?? []).filter(
          (nr) =>
            !(existing.roles ?? []).some(
              (er) => er.role === nr.role && er.startDate === nr.startDate,
            ),
        ),
      ];
      return {
        ...existing,
        ...incoming,
        affiliation: incoming.affiliation || existing.affiliation || "",
        email: incoming.email || existing.email || "",
        roles: mergedRoles,
        uri: incoming.uri || existing.uri || "",
      };
    });
    const untouched = metadata.authors.filter(
      (a) =>
        !cm.authors!.some(
          (c) => c.familyName === a.familyName && c.givenName === a.givenName,
        ),
    );
    metadata.authors = [...untouched, ...updated];
  }

  // Merge contributors
  if (cm.contributors && cm.contributors.length > 0) {
    const updated = cm.contributors.map((incoming) => {
      const existing = metadata.contributors.find(
        (c) =>
          c.familyName === incoming.familyName &&
          c.givenName === incoming.givenName,
      );
      if (!existing) return incoming;
      const mergedRoles = [
        ...(existing.roles ?? []),
        ...(incoming.roles ?? []).filter(
          (nr) =>
            !(existing.roles ?? []).some(
              (er) => er.role === nr.role && er.startDate === nr.startDate,
            ),
        ),
      ];
      return {
        ...existing,
        ...incoming,
        affiliation: incoming.affiliation || existing.affiliation || "",
        email: incoming.email || existing.email || "",
        roles: mergedRoles,
        uri: incoming.uri || existing.uri || "",
      };
    });
    const untouched = metadata.contributors.filter(
      (c) =>
        !cm.contributors!.some(
          (i) => i.familyName === c.familyName && i.givenName === c.givenName,
        ),
    );
    metadata.contributors = [...untouched, ...updated];
  }

  return metadata;
}

/**
 * Parses CITATION.cff content and merges it into the metadata object.
 * Citation fields take the highest precedence.
 */
export function applyCitationMetadata(
  content: string,
  metadata: MetadataRecord,
): MetadataRecord {
  let doc: Record<string, any>;
  try {
    doc = yaml.load(normalizeText(content)) as Record<string, any>;
  } catch {
    return metadata;
  }
  const cit = convertCitationForDB(doc);

  metadata.license = cit.license ?? metadata.license ?? null;
  metadata.codeRepository = cit.codeRepository || metadata.codeRepository || "";
  metadata.currentVersion = cit.currentVersion || metadata.currentVersion || "";
  metadata.currentVersionReleaseDate =
    cit.currentVersionReleaseDate ?? metadata.currentVersionReleaseDate ?? null;
  metadata.keywords = cit.keywords?.length ? cit.keywords : metadata.keywords;
  metadata.uniqueIdentifier =
    cit.uniqueIdentifier || metadata.uniqueIdentifier || "";
  metadata.description = cit.description || metadata.description || "";

  if (cit.authors && cit.authors.length > 0) {
    if (metadata.authors.length > 0) {
      const updated = cit.authors.map((incoming) => {
        const existing = metadata.authors.find(
          (a) =>
            a.familyName === incoming.familyName &&
            a.givenName === incoming.givenName,
        );
        if (!existing) return incoming;
        return {
          ...existing,
          ...incoming,
          affiliation: incoming.affiliation || existing.affiliation || "",
          email: incoming.email || existing.email || "",
        };
      });
      metadata.authors = updated;
    } else {
      metadata.authors = [...cit.authors];
    }
  }

  return metadata;
}

/**
 * Ensures the CodeMetadata record exists for a repository.
 * Creates a skeleton record if missing.
 */
async function ensureMetadataRecord(
  repositoryId: number,
  subjects: MetadataExistsResult,
) {
  const existing = await prisma.codeMetadata.findUnique({
    where: { repository_id: repositoryId },
  });
  if (existing) return existing;

  return prisma.codeMetadata.create({
    data: {
      citation_status: "",
      citation_validation_message: "",
      codemeta_status: "",
      codemeta_validation_message: "",
      contains_citation: subjects.citation,
      contains_codemeta: subjects.codemeta,
      contains_metadata: subjects.citation && subjects.codemeta,
      identifier: createId(),
      metadata: {},
      repository: { connect: { id: repositoryId } },
    },
  });
}

/**
 * Runs the full metadata pipeline: gathers from GitHub API, merges codemeta.json
 * and CITATION.cff, validates both files, and persists everything to the database.
 * Creates the `CodeMetadata` record if it does not yet exist.
 *
 * Priority (highest → lowest): CITATION.cff > codemeta.json > existing DB edits > GitHub API
 *
 * @param provider - Repository provider used to fetch file contents.
 * @param owner - GitHub owner (user or organisation) of the repository.
 * @param repo - Repository name.
 * @param repositoryId - Primary key of the repository row in the database.
 * @param subjects - Which metadata files exist, from {@link checkMetadataFilesExists}.
 * @returns Booleans indicating whether each file passed validation.
 */
export async function updateMetadataDatabase(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
  repositoryId: number,
  subjects: MetadataExistsResult,
): Promise<{ validCitation: boolean; validCodemeta: boolean }> {
  const logCtx = { action: "metadata.update", owner, repo };

  // 1. Ensure DB record exists
  const existing = await ensureMetadataRecord(repositoryId, subjects);

  // 2. Gather base metadata from GitHub API
  let metadata = await gatherBaseMetadata(provider, owner, repo);
  logwatch.info({
    ...logCtx,
    message: "Base metadata gathered from GitHub API",
  });

  // 3. Overlay existing DB metadata to preserve user edits
  metadata = applyDbMetadata(
    existing.metadata as Record<string, any>,
    metadata,
  );

  // 4. Process codemeta.json: merge content + validate (single fetch)
  let codemetaValidation: ValidationResult = {
    isValid: existing.codemeta_status === "valid",
    message: existing.codemeta_validation_message || "Not yet validated",
    status:
      (existing.codemeta_status as "valid" | "invalid" | "unknown") ||
      "unknown",
  };

  if (subjects.codemeta) {
    const file = await provider.getFileContent(owner, repo, "codemeta.json");
    if (file) {
      metadata = applyCodemetaMetadata(file.content, metadata);
      codemetaValidation = await validateCodemeta(
        { content: file.content, downloadUrl: file.downloadUrl, sha: file.sha },
        { owner, repo },
      );
      logwatch.info({
        ...logCtx,
        message: "codemeta.json applied and validated",
        status: codemetaValidation.status,
        validationMessage: codemetaValidation.message,
      });
    } else {
      logwatch.warn({
        ...logCtx,
        message: "codemeta.json expected but not found in repository",
      });
      codemetaValidation = makeInvalid("File not found");
    }
  }

  // 5. Process CITATION.cff: merge content + validate (single fetch)
  let citationValidation: ValidationResult = {
    isValid: existing.citation_status === "valid",
    message: existing.citation_validation_message || "Not yet validated",
    status:
      (existing.citation_status as "valid" | "invalid" | "unknown") ||
      "unknown",
  };

  if (subjects.citation) {
    const file = await provider.getFileContent(owner, repo, "CITATION.cff");
    if (file) {
      metadata = applyCitationMetadata(file.content, metadata);
      citationValidation = await validateCitation(
        { content: file.content, downloadUrl: file.downloadUrl, sha: file.sha },
        { owner, repo },
      );
      logwatch.info({
        ...logCtx,
        message: "CITATION.cff applied and validated",
        status: citationValidation.status,
        validationMessage: citationValidation.message,
      });
    } else {
      logwatch.warn({
        ...logCtx,
        message: "CITATION.cff expected but not found in repository",
      });
      citationValidation = makeInvalid("File not found");
    }
  }

  // 6. Persist merged metadata + validation results to DB
  await prisma.codeMetadata.update({
    data: {
      citation_status: citationValidation.status,
      citation_validation_message: citationValidation.message,
      codemeta_status: codemetaValidation.status,
      codemeta_validation_message: codemetaValidation.message,
      contains_citation: subjects.citation,
      contains_codemeta: subjects.codemeta,
      contains_metadata: subjects.citation && subjects.codemeta,
      metadata: metadata as any,
    },
    where: { repository_id: repositoryId },
  });

  logwatch.info({ ...logCtx, message: "CodeMetadata record updated" });

  return {
    validCitation: citationValidation.isValid,
    validCodemeta: codemetaValidation.isValid,
  };
}

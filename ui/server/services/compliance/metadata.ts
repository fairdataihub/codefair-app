/**
 * Metadata compliance service (codemeta.json + CITATION.cff).
 */
import yaml from "js-yaml";
import type { RepositoryProvider } from "../providers/interface";
import prisma from "~/server/utils/prisma";
import { createId } from "~/server/utils/cuid";

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
async function validateCodemeta(info: FileInfo): Promise<ValidationResult> {
  if (!info.content) {
    return makeInvalid("codemeta.json content is null or undefined");
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(normalizeText(info.content));
  } catch (err: any) {
    return makeInvalid(`Invalid JSON in codemeta.json: ${err.message}`);
  }

  const missing = ["name", "author", "description"].filter((f) => !obj[f]);
  if (missing.length) {
    return makeInvalid(`Required fields missing: ${missing.join(", ")}`);
  }

  try {
    const resp = await fetch(`${VALIDATOR_URL}/validate-codemeta`, {
      body: JSON.stringify({ file_content: obj }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    console.log(resp);
    const result = (await resp.json()) as {
      error?: string;
      message?: string;
      version?: string;
    };
    if (!resp.ok) {
      return makeUnknown(`Validator returned error (${resp.status})`, {
        response: result,
        statusCode: resp.status,
      });
    }
    return result.message === "valid"
      ? makeValid(`Valid (schema v${result.version})`, {
          version: result.version,
        })
      : makeInvalid(result.error ?? "Validation failed", {
          version: result.version,
        });
  } catch (err: any) {
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
async function validateCitation(info: FileInfo): Promise<ValidationResult> {
  if (!info.content) {
    return makeInvalid("CITATION.cff content is null or undefined");
  }

  let doc: any;
  try {
    doc = yaml.load(normalizeText(info.content));
  } catch (err: any) {
    return makeInvalid(`Invalid YAML in CITATION.cff: ${err.message}`);
  }

  if (!doc?.title || !Array.isArray(doc.authors) || doc.authors.length === 0) {
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
      return makeUnknown(`Validator returned error (${resp.status})`, {
        response: result,
        statusCode: resp.status,
      });
    }
    return result.message === "valid"
      ? makeValid(result.output ?? "Valid CITATION.cff")
      : makeInvalid(result.error ?? "Validation failed");
  } catch (err: any) {
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
): Promise<ValidationResult> {
  switch (fileType) {
    case "codemeta":
      return validateCodemeta(info);
    case "citation":
      return validateCitation(info);
    default:
      return Promise.resolve(makeInvalid(`Unsupported file type: ${fileType}`));
  }
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
 * Validates `codemeta.json` and `CITATION.cff` (when present) and persists
 * the results to the database. Creates the `CodeMetadata` record if it does
 * not yet exist.
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
  // 1. Ensure DB record exists
  const existing = await ensureMetadataRecord(repositoryId, subjects);

  // 2. Initialize validation from existing record (fallback if not re-running)
  let codemetaValidation: ValidationResult = {
    isValid: existing.codemeta_status === "valid",
    message: existing.codemeta_validation_message || "Not yet validated",
    status:
      (existing.codemeta_status as "valid" | "invalid" | "unknown") ||
      "unknown",
  };
  let citationValidation: ValidationResult = {
    isValid: existing.citation_status === "valid",
    message: existing.citation_validation_message || "Not yet validated",
    status:
      (existing.citation_status as "valid" | "invalid" | "unknown") ||
      "unknown",
  };

  // 3. Validate codemeta.json if it exists
  if (subjects.codemeta) {
    const file = await provider.getFileContent(owner, repo, "codemeta.json");
    if (file) {
      codemetaValidation = await validateCodemeta({
        content: file.content,
        downloadUrl: file.downloadUrl,
        sha: file.sha,
      });
    } else {
      codemetaValidation = makeInvalid("File not found");
    }
  }

  // 4. Validate CITATION.cff if it exists
  if (subjects.citation) {
    const file = await provider.getFileContent(owner, repo, "CITATION.cff");
    if (file) {
      citationValidation = await validateCitation({
        content: file.content,
        downloadUrl: file.downloadUrl,
        sha: file.sha,
      });
    } else {
      citationValidation = makeInvalid("File not found");
    }
  }

  // 5. Update DB record
  await prisma.codeMetadata.update({
    data: {
      citation_status: citationValidation.status,
      citation_validation_message: citationValidation.message,
      codemeta_status: codemetaValidation.status,
      codemeta_validation_message: codemetaValidation.message,
      contains_citation: subjects.citation,
      contains_codemeta: subjects.codemeta,
      contains_metadata: subjects.citation && subjects.codemeta,
    },
    where: { repository_id: repositoryId },
  });

  return {
    validCitation: citationValidation.isValid,
    validCodemeta: codemetaValidation.isValid,
  };
}

/**
 * CWL compliance service.
 */
import type { Prisma } from "@prisma/client";
import type { RepositoryProvider } from "../providers/interface";
import prisma from "~/server/utils/prisma";
import { createId } from "~/server/utils/cuid";

const VALIDATOR_URL = process.env.VALIDATOR_URL ?? "";

// == Types ========================================================

export interface CWLFileEntry {
  /** Download URL used for validation */
  download_url: string | null;
  /** GitHub HTML URL for the file */
  href: string;
  /** Unix timestamp (seconds) */
  last_modified: number;
  /** Unix timestamp (seconds) */
  last_validated: number;
  /** Repository relative path */
  path: string;
  validation_message: string;
  validation_status: "valid" | "invalid";
}

export interface CWLScanResult {
  contains_cwl_files: boolean;
  /** Newly discovered files */
  files: Array<{
    name: string;
    download_url: string | null;
    href: string;
    path: string;
  }>;
  removedFiles: Array<{ path: string }>;
}

export interface CWLValidationSummary {
  failedCount: number;
  files: CWLFileEntry[];
  validOverall: boolean;
}

// == Helpers ========================================================

/**
 * Replaces raw-content GitHub download URLs in a validator message with the
 * corresponding HTML browse URL (optionally with line anchors extracted).
 * @param inputString - The validator output message containing raw GitHub URLs.
 * @param oldUrl - The raw-content download URL to replace.
 * @param newUrl - The HTML browse URL to substitute in.
 * @returns A tuple of [modifiedString, firstLineNumber, secondLineNumber] where
 *   line numbers are extracted from any `:line:col` suffix on the matched URL,
 *   or `null` if no suffix was present.
 */
function replaceRawGithubUrl(
  inputString: string,
  oldUrl: string,
  newUrl: string,
): [string, string | null, string | null] {
  const escaped = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const urlRegex = new RegExp(`(${escaped})(:\\d+:\\d+)?`, "g");

  let firstLineNumber: string | null = null;
  let secondLineNumber: string | null = null;

  const modifiedString = inputString.replace(
    urlRegex,
    (_match, _p1, p2?: string) => {
      if (p2) {
        const parts = p2.split(":");
        if (!firstLineNumber) {
          firstLineNumber = parts[1] ?? null;
          secondLineNumber = parts[2] ?? null;
        }
      }
      return p2 ? `${newUrl}${p2}` : newUrl;
    },
  );

  return [modifiedString, firstLineNumber, secondLineNumber];
}

// == Recursive directory scanner =================================================

/**
 * Recursively walks a repository directory tree and collects all `.cwl` files.
 * @param provider - Repository provider used to list directory contents.
 * @param owner - GitHub owner (user or org) of the repository.
 * @param repo - Repository name.
 * @param path - Repository-relative directory path to scan (empty string for root).
 * @param collected - Accumulator array that CWL file entries are pushed into.
 */
async function searchDirectory(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
  path: string,
  collected: CWLScanResult["files"],
): Promise<void> {
  const entries = await provider.listDirectory(owner, repo, path); // [] on 404
  for (const item of entries) {
    if (item.type === "dir") {
      await searchDirectory(provider, owner, repo, item.path, collected);
    } else if (item.type === "file" && item.name.endsWith(".cwl")) {
      collected.push({
        name: item.name,
        download_url: item.downloadUrl,
        href: item.htmlUrl ?? "",
        path: item.path,
      });
    }
  }
}

// == Public API ========================================================

/**
 * Scans the repository for CWL files and identifies files removed since the
 * last scan (by comparing against the DB record).
 * Ported from bot/compliance-checks/cwl/index.js → getCWLFiles().
 * @param provider - Repository provider used to traverse the directory tree.
 * @param owner - GitHub owner (user or org) of the repository.
 * @param repo - Repository name.
 * @param repositoryId - Internal database ID of the repository.
 * @returns A scan result containing discovered CWL files, whether any exist,
 *   and the list of files that were in the DB but are no longer found.
 */
export async function getCWLFiles(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
  repositoryId: number,
): Promise<CWLScanResult> {
  const files: CWLScanResult["files"] = [];
  await searchDirectory(provider, owner, repo, "", files);

  const existingCWL = await prisma.cwlValidation.findUnique({
    where: { repository_id: repositoryId },
  });

  let removedFiles: Array<{ path: string }> = [];
  if (existingCWL?.contains_cwl_files) {
    const currentPaths = new Set(files.map((f) => f.path));
    removedFiles = (
      existingCWL.files as unknown as Array<{ path: string }>
    ).filter((dbFile: { path: string }) => !currentPaths.has(dbFile.path));
  }

  return {
    contains_cwl_files: files.length > 0,
    files,
    removedFiles,
  };
}

/**
 * Validates a single CWL file via the validator microservice.
 * @param downloadUrl - Raw-content download URL of the CWL file to validate.
 * @returns A tuple of `[isValid, validationMessage]` where `isValid` is `true`
 *   when the file passes validation and `validationMessage` is the validator output.
 */
export async function validateCWLFile(
  downloadUrl: string,
): Promise<[boolean, string]> {
  try {
    const response = await fetch(`${VALIDATOR_URL}/validate-cwl`, {
      body: JSON.stringify({ file_path: downloadUrl }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const errorData = (await response.json()) as {
        error?: string;
        output?: string;
      };
      if (response.status === 400) {
        return [false, errorData.output ?? "Validation error"];
      }
      return [false, "Error validating CWL file"];
    }

    const data = (await response.json()) as { output?: string };
    return [true, data.output ?? "Valid"];
  } catch {
    return [false, "Error validating CWL file"];
  }
}

/**
 * Validates all discovered CWL files and upserts the database record.
 * Handles removed-file cleanup, validation, file-map merge, and analytics increment.
 * @param repositoryId - Internal database ID of the repository.
 * @param cwlScan - Result from {@link getCWLFiles} describing newly found and removed files.
 * @returns Summary used by the dashboard renderer, including per-file results,
 *   total failed count, and an overall validity flag.
 */
export async function updateCWLDatabase(
  repositoryId: number,
  cwlScan: CWLScanResult,
): Promise<CWLValidationSummary> {
  const now = Math.floor(Date.now() / 1000);

  // 1. Remove deleted files from the DB
  if (cwlScan.removedFiles.length > 0) {
    const existingCWL = await prisma.cwlValidation.findUnique({
      where: { repository_id: repositoryId },
    });
    if (existingCWL) {
      const removedPaths = new Set(cwlScan.removedFiles.map((f) => f.path));
      const newFiles = (existingCWL.files as unknown as CWLFileEntry[]).filter(
        (f) => !removedPaths.has(f.path),
      );
      await prisma.cwlValidation.update({
        data: {
          contains_cwl_files: newFiles.length > 0,
          files: newFiles as unknown as Prisma.InputJsonValue,
        },
        where: { repository_id: repositoryId },
      });
    }
  }

  // 2. No CWL files found — clear the record
  if (cwlScan.files.length === 0) {
    await prisma.cwlValidation.upsert({
      create: {
        contains_cwl_files: false,
        files: [],
        identifier: createId(),
        overall_status: "",
        repository: { connect: { id: repositoryId } },
      },
      update: {
        contains_cwl_files: false,
        files: [],
        overall_status: "",
      },
      where: { repository_id: repositoryId },
    });
    return { failedCount: 0, files: [], validOverall: true };
  }

  // 3. Validate each discovered file
  const newlyValidated: CWLFileEntry[] = [];
  for (const file of cwlScan.files) {
    const downloadUrl = file.download_url ?? "";
    const [isValid, rawMessage] = await validateCWLFile(downloadUrl);

    let htmlUrl = file.href;
    let validationMessage = rawMessage;

    if (downloadUrl && htmlUrl) {
      const [modified, line1, line2] = replaceRawGithubUrl(
        rawMessage,
        downloadUrl,
        htmlUrl,
      );
      validationMessage = modified;
      if (line1) {
        htmlUrl += `#L${line1}`;
        if (line2) htmlUrl += `-L${line2}`;
      }
    }

    newlyValidated.push({
      download_url: file.download_url,
      href: htmlUrl,
      last_modified: now,
      last_validated: now,
      path: file.path,
      validation_message: validationMessage,
      validation_status: isValid ? "valid" : "invalid",
    });

    // Increment analytics counter
    await prisma.analytics.upsert({
      create: { id: repositoryId, cwl_validated_file_count: 1 },
      update: { cwl_validated_file_count: { increment: 1 } },
      where: { id: repositoryId },
    });
  }

  // 4. Merge existing DB entries with newly validated ones (new entries win)
  const existingCWL = await prisma.cwlValidation.findUnique({
    where: { repository_id: repositoryId },
  });

  const fileMap = new Map<string, CWLFileEntry>();
  if (existingCWL) {
    for (const f of existingCWL.files as unknown as CWLFileEntry[]) {
      fileMap.set(f.path, f);
    }
  }
  for (const f of newlyValidated) {
    fileMap.set(f.path, f);
  }

  const mergedFiles = Array.from(fileMap.values());
  let validOverall = true;
  let failedCount = 0;
  for (const f of mergedFiles) {
    if (f.validation_status === "invalid") {
      validOverall = false;
      failedCount += 1;
    }
  }

  // 5. Upsert the DB record
  const mergedFilesJson = mergedFiles as unknown as Prisma.InputJsonValue;
  await prisma.cwlValidation.upsert({
    create: {
      contains_cwl_files: mergedFiles.length > 0,
      files: mergedFilesJson,
      identifier: createId(),
      overall_status: validOverall ? "valid" : "invalid",
      repository: { connect: { id: repositoryId } },
    },
    update: {
      contains_cwl_files: mergedFiles.length > 0,
      files: mergedFilesJson,
      overall_status: validOverall ? "valid" : "invalid",
    },
    where: { repository_id: repositoryId },
  });

  return { failedCount, files: mergedFiles, validOverall };
}

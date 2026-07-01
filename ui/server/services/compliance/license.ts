/**
 * License compliance service.
 */
import prisma from "~/server/utils/prisma";
import { createId } from "~/server/utils/cuid";
import type { RepositoryProvider } from "../providers/interface";
import licensesJson from "~/assets/data/licenses.json";
import { logwatch } from "~/server/utils/logwatch";

export interface LicenseResult {
  status: boolean;
  path: string;
  content: string;
  spdx_id: string | null;
}

interface ExistingLicense {
  id: string;
  license_id: string | null;
  license_path: string;
  license_content: string;
  license_status: string;
  contains_license: boolean;
  pull_request_url: string;
  custom_license_title: string;
}

// == Helpers ================================================================

/**
 * Returns whether the given license ID is a recognized SPDX identifier.
 *
 * @param licenseId - The license ID to validate.
 * @returns `true` if the ID matches a known SPDX license; `false` for `null`, `"Custom"`, or `"NOASSERTION"`.
 */
function isValidSpdxLicense(licenseId: string | null | undefined): boolean {
  if (!licenseId || licenseId === "Custom" || licenseId === "NOASSERTION") {
    return false;
  }
  return (licensesJson as Array<{ licenseId: string }>).some(
    (l) => l.licenseId === licenseId,
  );
}

/**
 * Normalizes whitespace in license content for stable comparison.
 *
 * @param content - Raw license text, or `null`/`undefined`.
 * @returns The normalized string, or an empty string if the input is falsy.
 */
function normalizeContent(content: string | null | undefined): string {
  if (!content) return "";
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

// == Public API ===============================================================

const LICENSE_PATHS = [
  "LICENSE",
  "LICENSE.md",
  "LICENSE.txt",
  "COPYING",
  "COPYING.LESSER",
];

/**
 * Checks whether a LICENSE file exists in the repository and detects its SPDX ID.
 *
 * @param provider - The repository provider used to fetch file contents and detect licenses.
 * @param owner - The repository owner (user or organization name).
 * @param repo - The repository name.
 * @returns A `LicenseResult` indicating whether a license was found, its file path, content, and detected SPDX ID.
 */
export async function checkForLicense(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
): Promise<LicenseResult> {
  for (const filePath of LICENSE_PATHS) {
    const file = await provider.getFileContent(owner, repo, filePath);
    if (file) {
      // Try to get SPDX ID from GitHub's license detection
      const detected = await provider.detectLicense(owner, repo).catch(() => ({
        spdxId: null,
        name: null,
      }));

      return {
        status: true,
        path: filePath,
        content: file.content,
        spdx_id: detected.spdxId,
      };
    }
  }
  return {
    status: false,
    path: "No LICENSE file found",
    content: "",
    spdx_id: null,
  };
}

/**
 * Validates license metadata and resolves the final licenseId and content.
 *
 * @param license - The detected license result from the repository.
 * @param existingLicense - The existing license record from the database, or `null` if none exists.
 * @returns An object containing the resolved `licenseId`, `licenseContent`, and a flag `licenseContentEmpty` indicating whether the content is absent.
 */
export function validateLicense(
  license: LicenseResult,
  existingLicense: ExistingLicense | null,
  ctx?: { installationId?: number; owner?: string; repo?: string },
): {
  licenseId: string | null;
  licenseContent: string;
  licenseContentEmpty: boolean;
} {
  const logCtx = { action: "license.validate", ...ctx };

  try {
    let licenseId: string | null = license.spdx_id;
    let licenseContent = license.content;
    let licenseContentEmpty = license.content === "";

    if (licenseId === "no-license" || !licenseId) {
      logwatch.warn({
        ...logCtx,
        message: "License ID is missing or unrecognized — treating as no license",
        spdxId: license.spdx_id,
      });
      licenseId = null;
      licenseContent = "";
      licenseContentEmpty = true;
    }

    if (licenseId === "NOASSERTION") {
      if (licenseContentEmpty) {
        logwatch.warn({
          ...logCtx,
          message: "NOASSERTION license with empty content — treating as no license",
        });
        licenseId = null;
      } else {
        // License content is not empty but no SPDX id provided by GitHub
        licenseContentEmpty = false;
        const normalizedExisting = normalizeContent(
          existingLicense?.license_content,
        );
        const normalizedNew = normalizeContent(licenseContent);
        const contentChanged = normalizedExisting !== normalizedNew;
        const existingIsValidSpdx = isValidSpdxLicense(
          existingLicense?.license_id,
        );

        if (contentChanged) {
          logwatch.warn({
            ...logCtx,
            existingLicenseId: existingLicense?.license_id ?? null,
            message: "NOASSERTION license content changed — resolving as Custom",
          });
          licenseId = "Custom";
        } else if (existingIsValidSpdx) {
          licenseId = existingLicense!.license_id;
        } else if (existingLicense?.license_id) {
          logwatch.warn({
            ...logCtx,
            existingLicenseId: existingLicense.license_id,
            message: "NOASSERTION license with non-SPDX existing ID — reusing existing",
          });
          licenseId = existingLicense.license_id;
        } else {
          logwatch.warn({
            ...logCtx,
            message: "NOASSERTION license with no existing record — resolving as Custom",
          });
          licenseId = "Custom";
        }
      }
    }

    return { licenseId, licenseContent, licenseContentEmpty };
  } catch (err: any) {
    logwatch.error({
      ...logCtx,
      error: err.message,
      message: "Unexpected error in validateLicense",
      stack: err.stack,
    });
    throw err;
  }
}

/**
 * Upserts the license record in the database based on the detected license.
 *
 * @param repositoryId - The numeric ID of the repository in the database.
 * @param license - The detected license result from the repository.
 * @returns The created or updated `ExistingLicense` database record.
 */
export async function updateLicenseDatabase(
  repositoryId: number,
  license: LicenseResult,
  ctx?: { installationId?: number; owner?: string; repo?: string },
): Promise<ExistingLicense> {
  let licenseId: string | null = license.spdx_id;
  let licenseContent = license.content;
  let licenseContentEmpty = license.content === "";
  let licensePath = license.status ? license.path : "";

  const existingLicense = await prisma.licenseRequest.findUnique({
    where: { repository_id: repositoryId },
  });

  if (existingLicense) {
    if (license.status) {
      ({ licenseId, licenseContent, licenseContentEmpty } = validateLicense(
        license,
        existingLicense as unknown as ExistingLicense,
        ctx,
      ));
    } else if (existingLicense.pull_request_url) {
      // Preserve existing data when there's a pending PR
      licenseId = existingLicense.license_id;
      licenseContent = existingLicense.license_content;
      licenseContentEmpty = !licenseContent;
      licensePath = existingLicense.license_path;
    }

    return prisma.licenseRequest.update({
      data: {
        contains_license: license.status,
        license_status: licenseContentEmpty ? "invalid" : "valid",
        license_id: licenseId,
        license_path: licensePath,
        license_content: licenseContent,
        custom_license_title:
          licenseId === "Custom" ? existingLicense.custom_license_title : "",
      },
      where: { repository_id: repositoryId },
    }) as unknown as ExistingLicense;
  }

  // Create new record
  if (license.status) {
    ({ licenseId, licenseContent, licenseContentEmpty } = validateLicense(
      license,
      null,
      ctx,
    ));
  }

  return prisma.licenseRequest.create({
    data: {
      identifier: createId(),
      contains_license: license.status,
      license_status: licenseContentEmpty ? "invalid" : "valid",
      license_id: licenseId,
      license_path: licensePath,
      license_content: licenseContent,
      custom_license_title: "",
      repository: { connect: { id: repositoryId } },
    },
  }) as unknown as ExistingLicense;
}

/**
 * Dashboard renderer — pure string builder, no I/O.
 * Ported from bot/utils/renderer/index.js and the individual applyXTemplate() functions.
 *
 * Section order (mirrors the bot):
 *   1. README  (+ open PR notice)
 *   2. LICENSE  (+ open PR notice)
 *   3. Metadata (+ open PR notice)
 *   4. Language Specific Standards / CWL
 *   5. FAIR Software Release
 *   6. Additional Recommendations (contributing + code of conduct)  (+ open PR notice)
 *   7. Last-Modified footer
 */

import { load as yamlLoad } from "js-yaml";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import type { ReadmeResult } from "../compliance/readme";
import type { LicenseResult } from "../compliance/license";
import type {
  MetadataExistsResult,
  ValidationResult,
} from "../compliance/metadata";
import type {
  ContributingResult,
  CodeOfConductResult,
} from "../compliance/contributing";
import type { CWLValidationSummary } from "../compliance/cwl";

dayjs.extend(utc);
dayjs.extend(timezone);

const DOMAIN = process.env.CODEFAIR_APP_DOMAIN ?? "";

// ===== Types ===========================================================

export interface LicenseSectionData {
  customLicenseTitle: string;
  license: LicenseResult;
  licenseId: string | null;
  pullRequestUrl: string;
}

export interface MetadataSectionData {
  citationValidation: ValidationResult | null;
  /** true when a LICENSE file exists (metadata check is skipped otherwise) */
  codemetaValidation: ValidationResult | null;
  exists: MetadataExistsResult;
  licensePresent: boolean;
  pullRequestUrl: string;
}

export interface CWLSectionData {
  /** null when CWL check was not run */
  summary: CWLValidationSummary | null;
}

export interface ReadmeSectionData {
  pullRequestUrl: string;
  readme: ReadmeResult;
}

export interface ContributingCheckData {
  pullRequestUrl: string;
  result: ContributingResult;
}

export interface CofcCheckData {
  pullRequestUrl: string;
  result: CodeOfConductResult;
}

// ===== Archival types =========================================================

/** Classifier for an identifier found in metadata files. */
export type IdentifierType = "zenodo_doi" | "other_doi" | "non_doi";

/** A single identifier extracted from `codemeta.json` or `CITATION.cff`. */
export interface ArchivalIdentifier {
  /** Which metadata file this identifier was found in. */
  source: "codemeta.json" | "CITATION.cff";
  type: IdentifierType;
  /** The canonical DOI string (or bare identifier for non-DOI). */
  value: string;
  /** Present only when `type === "zenodo_doi"`. */
  zenodoId?: string;
}

/** All data needed to render the FAIR Software Release section. */
export interface ArchivalSectionData {
  /**
   * Identifiers extracted from `codemeta.json` / `CITATION.cff`.
   * Populated when no published DOI exists; empty for lightweight refresh paths.
   */
  identifiers: ArchivalIdentifier[];
  /** Whether a LICENSE file is present. The section is skipped when false. */
  licensePresent: boolean;
  /**
   * Deposition record from the database.
   * `null` means no `ZenodoDeposition` row exists yet - rendered as "no release yet".
   */
  zenodoDeposition: {
    githubTagName: string | null;
    lastPublishedDoi: string | null;
    zenodoId: number | null;
  } | null;
}

export interface DashboardSections {
  archival: ArchivalSectionData;
  cofc: CofcCheckData;
  contributing: ContributingCheckData;
  cwl: CWLSectionData;
  license: LicenseSectionData;
  metadata: MetadataSectionData;
  owner: string;
  readme: ReadmeSectionData;
  repo: string;
}

// ===== Archival pure helpers ==================================================

const ZENODO_DOI_PREFIX = "10.5281/zenodo.";
const DOI_REGEX = /10\.\d{4,9}(?:\.\d+)?\/[-A-Za-z0-9:/_.;()[\]\\]+/;

/**
 * Extracts a canonical DOI from a raw string.
 * Handles `https://doi.org/...`, `dx.doi.org/...`, and bare DOI formats.
 *
 * @param value - Raw string that may contain a DOI.
 * @returns The extracted DOI string, or `null` if none found.
 */
function extractDOIFromString(value: string): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();

  const urlMatch = trimmed.match(/^https?:\/\/(?:dx\.)?doi\.org\/(.+)/i);
  if (urlMatch?.[1]) {
    const doiMatch = urlMatch[1].trim().match(DOI_REGEX);
    return doiMatch ? doiMatch[0] : null;
  }

  const directMatch = trimmed.match(DOI_REGEX);
  return directMatch ? directMatch[0] : null;
}

/**
 * Classifies a raw identifier string as a Zenodo DOI, other DOI, or non-DOI.
 *
 * @param identifier - Raw identifier string to classify.
 * @returns A classified identifier object, or `null` for empty/invalid input.
 */
function classifyIdentifier(
  identifier: string,
): Omit<ArchivalIdentifier, "source"> | null {
  if (!identifier || typeof identifier !== "string") return null;
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const doi = extractDOIFromString(trimmed);

  if (doi) {
    if (doi.startsWith(ZENODO_DOI_PREFIX)) {
      return {
        type: "zenodo_doi",
        value: doi,
        zenodoId: doi.replace(ZENODO_DOI_PREFIX, ""),
      };
    }
    return { type: "other_doi", value: doi };
  }

  return { type: "non_doi", value: trimmed };
}

/**
 * Extracts identifiers from the content of a `codemeta.json` file.
 * Handles string, array, and object forms of the `identifier` field.
 *
 * @param content - Raw JSON string of `codemeta.json`.
 * @returns Array of classified identifiers found in the file.
 */
export function extractIdentifiersFromCodemeta(
  content: string,
): ArchivalIdentifier[] {
  const identifiers: ArchivalIdentifier[] = [];
  if (!content) return identifiers;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    return identifiers;
  }

  const raw = parsed?.identifier;
  if (!raw) return identifiers;

  const process = (item: unknown) => {
    const id =
      typeof item === "object" && item !== null
        ? ((item as Record<string, unknown>)["@id"] ??
          (item as Record<string, unknown>).id ??
          (item as Record<string, unknown>).value)
        : item;
    if (typeof id === "string") {
      const classified = classifyIdentifier(id);
      if (classified)
        identifiers.push({ source: "codemeta.json", ...classified });
    }
  };

  if (Array.isArray(raw)) {
    raw.forEach(process);
  } else {
    process(raw);
  }

  return identifiers;
}

/**
 * Extracts a DOI identifier from the content of a `CITATION.cff` file.
 * Reads the top-level `doi` field from the parsed YAML.
 *
 * @param content - Raw YAML string of `CITATION.cff`.
 * @returns Array containing the classified DOI identifier, or empty if none found.
 */
export function extractIdentifiersFromCitation(
  content: string,
): ArchivalIdentifier[] {
  const identifiers: ArchivalIdentifier[] = [];
  if (!content) return identifiers;

  let parsed: unknown;
  try {
    parsed = yamlLoad(content);
  } catch {
    return identifiers;
  }

  const rawDoi =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>).doi
      : undefined;

  if (typeof rawDoi === "string") {
    const classified = classifyIdentifier(rawDoi);
    if (classified) identifiers.push({ source: "CITATION.cff", ...classified });
  }

  return identifiers;
}

/**
 * Sorts identifiers by priority (Zenodo DOI > Other DOI > Non-DOI) and
 * returns the highest-priority one as `primary` with the rest in `others`.
 *
 * @param ids - Array of classified identifiers to prioritize.
 * @returns Object with `primary` (highest-priority) and `others` (remaining).
 */
export function prioritizeIdentifiers(ids: ArchivalIdentifier[]): {
  others: ArchivalIdentifier[];
  primary: ArchivalIdentifier | null;
} {
  if (!ids || ids.length === 0) return { others: [], primary: null };

  const priority: Record<IdentifierType, number> = {
    non_doi: 2,
    other_doi: 1,
    zenodo_doi: 0,
  };

  const sorted = [...ids].sort((a, b) => priority[a.type] - priority[b.type]);
  return { others: sorted.slice(1), primary: sorted[0] };
}

/**
 * Escapes a DOI string so it is safe to embed as a shields.io badge label.
 * Doubles hyphens (shields uses `-` as a separator) then URL-encodes the result.
 *
 * @param doi - The DOI string to escape.
 * @returns A shields.io URL-encoded label string.
 */
function createShieldsLabelFromDOI(doi: string): string {
  return encodeURIComponent(String(doi).replace(/-/g, "--"))
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

/**
 * Creates a shields.io Markdown badge linking to a Zenodo record.
 *
 * @param doi - The Zenodo DOI string (e.g. `10.5281/zenodo.1234567`).
 * @param zenodoId - The numeric Zenodo record ID.
 * @returns Markdown image link badge string.
 */
function createZenodoDOIBadge(doi: string, zenodoId: string): string {
  const label = createShieldsLabelFromDOI(doi);
  const zenodoEndpoint = process.env.ZENODO_ENDPOINT ?? "https://zenodo.org";
  return `[![DOI](https://img.shields.io/badge/DOI-${label}-blue)](${zenodoEndpoint}/records/${zenodoId})`;
}

/**
 * Creates a shields.io Markdown badge linking to a non-Zenodo DOI via `doi.org`.
 *
 * @param doi - The DOI string to link.
 * @returns Markdown image link badge string.
 */
function createOtherDOIBadge(doi: string): string {
  const label = createShieldsLabelFromDOI(doi);
  return `[![DOI](https://img.shields.io/badge/DOI-${label}-gray)](https://doi.org/${doi})`;
}

// ===== Archival section renderer ===============================

/**
 * Renders the FAIR Software Release (archival) section of the dashboard.
 *
 * The section currently rendererd by database state and file-extracted identifiers
 *
 * Code paths:
 * 1. No license - "not checked" warning badge.
 * 2. Published Zenodo DOI in deposition - success template with DOI + next-release button.
 * 3. No deposition / no published DOI — inspect `identifiers`:
 *    - 0 identifiers - first-release template (❌, red Create button).
 *    - 1 Zenodo DOI - checkmark template with DOI badge + automate button.
 *    - 1 Other DOI - ℹ️ template with DOI badge + note + Create button.
 *    - 1 Non-DOI - ℹ️ template with identifier + Create button.
 *    - Multiple, Zenodo - ℹ️ primary Zenodo badge + expandable section + release button.
 *    - Multiple, no Zenodo - ℹ️ primary badge + expandable section + Create button.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param data - Archival state: license presence, DB deposition, and metadata identifiers.
 * @returns Markdown string for the FAIR Software Release section.
 */
function renderArchival(
  owner: string,
  repo: string,
  data: ArchivalSectionData,
): string {
  const badgeURL = `${DOMAIN}/dashboard/${owner}/${repo}/release/zenodo`;
  const firstReleaseBadge = `[![Create Release on Zenodo](https://img.shields.io/badge/Create_Release_on_Zenodo-dc2626.svg)](${badgeURL})`;
  const releaseBadge = `[![Create Release on Zenodo](https://img.shields.io/badge/Create_Release_on_Zenodo-00bcd4.svg)](${badgeURL})`;
  const heading = `## FAIR Software Release`;

  // 1. No license
  if (!data.licensePresent) {
    return (
      `${heading}\n\n` +
      `To make your software FAIR, a license file is required.\n` +
      `> [!WARNING]\n> Codefair will run this check after a LICENSE file is detected in your repository.\n\n` +
      `![FAIR Release not checked](https://img.shields.io/badge/FAIR_Release_Not_Checked-fbbf24)\n\n`
    );
  }

  // 2. Published DOI exists
  const dep = data.zenodoDeposition;
  if (dep?.lastPublishedDoi) {
    const doi = dep.lastPublishedDoi;
    const zenodoId = dep.zenodoId;
    const doiBadge = zenodoId
      ? createZenodoDOIBadge(doi, String(zenodoId))
      : createOtherDOIBadge(doi);
    return (
      `${heading} ✔️\n\n` +
      `***${dep.githubTagName ?? ""}*** of your software was successfully released on GitHub and archived on Zenodo. ` +
      `You can view the Zenodo archive by clicking the button below:\n\n` +
      `${doiBadge}\n\n` +
      `Ready to create your next FAIR release? Click the button below:\n\n` +
      `${releaseBadge}\n\n`
    );
  }

  // 3. No published DOI - inspect identifiers
  const { others, primary } = prioritizeIdentifiers(data.identifiers);

  if (!primary) {
    // 3a. Zero identifiers - first release
    return (
      `${heading} ❌\n\n` +
      `To make your software FAIR, it is necessary to archive it in an archival repository like Zenodo every time you make a release. ` +
      `When you are ready to make your first release, click the "Create release" button below to easily create a FAIR release where your ` +
      `metadata files are updated (including with a DOI) before creating a GitHub release and archiving it on Zenodo.\n\n` +
      `${firstReleaseBadge}\n\n`
    );
  }

  if (data.identifiers.length === 1) {
    // 3b–3d. Single identifier
    switch (primary.type) {
      case "zenodo_doi": {
        const badge = createZenodoDOIBadge(primary.value, primary.zenodoId!);
        return (
          `${heading} ✔️\n\n` +
          `A Zenodo DOI was found in your metadata files. This indicates your software may already be archived on Zenodo.\n\n` +
          `${badge}\n\n` +
          `To automate your next archival with your GitHub Release, click the button below:\n\n` +
          `${releaseBadge}\n\n`
        );
      }
      case "other_doi": {
        const badge = createOtherDOIBadge(primary.value);
        return (
          `${heading} ℹ️\n\n` +
          `A DOI was found in your metadata files. However, Codefair currently only supports automated archival through Zenodo.\n\n` +
          `${badge}\n\n` +
          `> [!NOTE]\n> Clicking the button below will create an additional Zenodo archive alongside your existing DOI.\n\n` +
          `${firstReleaseBadge}\n\n`
        );
      }
      case "non_doi":
      default:
        return (
          `${heading} ℹ️\n\n` +
          `A non-DOI identifier was found in your metadata files. For FAIR compliance, we recommend obtaining a DOI through Zenodo.\n\n` +
          `Identifier: \`${primary.value}\`\n\n` +
          `${firstReleaseBadge}\n\n`
        );
    }
  }

  // 3e–3f. Multiple identifiers
  const hasZenodo = primary.type === "zenodo_doi";
  let section = "";

  if (hasZenodo) {
    const badge = createZenodoDOIBadge(primary.value, primary.zenodoId!);
    section =
      `${heading} ℹ️\n\n` +
      `This repository is already archived on Zenodo. To automate future GitHub releases to Zenodo, click the button below:\n\n` +
      `**Primary:** ${badge}\n\n` +
      `${releaseBadge}\n\n`;
  } else {
    const primaryBadge =
      primary.type === "other_doi"
        ? createOtherDOIBadge(primary.value)
        : `\`${primary.value}\``;
    section =
      `${heading} ℹ️\n\n` +
      `Multiple identifiers were found in your metadata files. No Zenodo DOI was detected. Currently Codefair supports automated archival through Zenodo.\n\n` +
      `**Primary:** ${primaryBadge}\n\n` +
      `> [!NOTE]\n> Clicking the button below will create an additional Zenodo archive. We recommend consolidating to one archival platform when possible.\n\n` +
      `${firstReleaseBadge}\n\n`;
  }

  if (others.length > 0) {
    section += `<details>\n<summary>Additional identifiers found (${others.length})</summary>\n\n`;
    for (const id of others) {
      if (id.type === "zenodo_doi") {
        section += `- ${createZenodoDOIBadge(id.value, id.zenodoId!)} (from ${id.source})\n`;
      } else if (id.type === "other_doi") {
        section += `- ${createOtherDOIBadge(id.value)} (from ${id.source})\n`;
      } else {
        section += `- \`${id.value}\` (from ${id.source})\n`;
      }
    }
    section += `\n</details>\n\n`;
  }

  if (hasZenodo && others.length > 0) {
    section += `> ℹ️ Multiple identifiers detected. Zenodo is shown as primary since it's supported for automation.\n\n`;
  }

  return section;
}

// ===== Last-Modified footer =====================================

/**
 * Appends a "Last updated" timestamp footer to the dashboard body.
 * The timestamp is formatted in America/Los_Angeles timezone.
 *
 * @param body - The rendered dashboard markdown string to append the footer to.
 * @returns The body string with the footer appended.
 */
function applyLastModified(body: string): string {
  const ts = dayjs().tz("America/Los_Angeles").format("MMM D YYYY, HH:mm:ss");
  return (
    body +
    `<sub><span style="color: grey;">Last updated ${ts} (timezone: America/Los_Angeles)</span></br>` +
    `<span>PLEASE NOTE: deleting this issue will require reinstalling the Codefair GitHub App, ` +
    `but closing the issue will allow you to restore the FAIR Compliance Dashboard by reopening the issue.</span></sub>`
  );
}

// ===== Section renderers ===========================================

/**
 * Renders the README section of the dashboard.
 * Shows a Create or Edit badge depending on whether a README was found.
 * Appends a View PR badge when a pull request is open.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param data - README compliance result and open PR URL.
 * @returns Markdown string for the README section.
 */
function renderReadme(
  owner: string,
  repo: string,
  data: ReadmeSectionData,
): string {
  const { pullRequestUrl, readme } = data;
  const badgeURL = `${DOMAIN}/dashboard/${owner}/${repo}/edit/readme`;
  const verb = readme.status ? "Edit" : "Create";
  const color = readme.status ? "0ea5e9" : "dc2626";
  const badge = `[![${verb} README](https://img.shields.io/badge/${verb}_README-${color}.svg)](${badgeURL})`;
  const header = readme.status ? "## README ✔️" : "## README ❌";
  const desc = readme.status
    ? `A \`${readme.path}\` file was found at within your repository.`
    : `A README file was not found within your .github, docs or root of your repository. The README file is a markdown file that contains information about your project. It is usually the first thing that users see when they visit your project on GitHub. Try to make it as informative and helpful as possible. Click on the badge below to create a file with Codefair's editor.`;
  let section = `${header}\n\n${desc}\n\n${badge}\n\n`;
  if (pullRequestUrl) {
    section +=
      `\n\nA pull request for the README is open:\n\n` +
      `[![README](https://img.shields.io/badge/View_PR-6366f1.svg)](${pullRequestUrl})\n\n`;
  }
  return section;
}

/**
 * Renders the LICENSE section of the dashboard.
 * Handles four states: valid SPDX license, unverified custom license,
 * confirmed custom license, and missing license.
 * Appends a View PR badge when a pull request is open.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param data - License compliance result, license ID, custom title, and open PR URL.
 * @returns Markdown string for the LICENSE section.
 */
function renderLicense(
  owner: string,
  repo: string,
  data: LicenseSectionData,
): string {
  const { customLicenseTitle, license, licenseId, pullRequestUrl } = data;
  const badgeURL = `${DOMAIN}/dashboard/${owner}/${repo}/edit/license`;
  const badge = `[![License](https://img.shields.io/badge/${license.status ? "Edit_License-0ea5e9" : "Add_License-dc2626"}.svg)](${badgeURL})`;

  // Fall back to a generic filename when the stored path is empty (e.g. an
  // existing LicenseRequest row that predates path tracking / backfill).
  const licenseFile = license.path.trim() || "LICENSE";

  let section = "";
  if (license.status && licenseId && licenseId !== "Custom") {
    section = `## LICENSE ✔️\n\nA \`${licenseFile}\` file is found in the repository.\n\n**Detected license:** \`${licenseId}\`\n\n${badge}\n\n`;
  } else if (license.status && licenseId === "Custom" && !customLicenseTitle) {
    section =
      `## LICENSE ❗\n\nYour \`${licenseFile}\` file needs verification. This can happen when:\n` +
      `- Your license content was modified and we need you to confirm the license type\n` +
      `- You're using a license that GitHub doesn't recognize but may still be a valid SPDX license\n` +
      `- You're using a truly custom license\n\n` +
      `> [!NOTE]\n> If you plan to archive on Zenodo, you'll need to select a license from the SPDX license list. Custom licenses are not currently supported by Zenodo's API.\n\n` +
      `Click the "Edit license" button below to **confirm your license type** (select from the dropdown and choose "Keep existing content") or provide a custom license title.\n\n${badge}\n\n`;
  } else if (license.status && licenseId === "Custom" && customLicenseTitle) {
    section = `## LICENSE ✔️\n\nA custom \`${licenseFile}\` file titled as **${customLicenseTitle}**, has been found in this repository. If you would like to update the title or change license, click the "Edit license" button below.\n\n${badge}\n\n`;
  } else {
    section =
      `## LICENSE ❌\n\nTo make your software reusable, a \`LICENSE\` file is expected at the root level of your repository.\n` +
      `If you would like Codefair to add a license file, click the "Add license" button below to go to our interface for selecting and adding a license. ` +
      `You can also add a license file yourself, and Codefair will update the dashboard when it detects it on the main branch.\n\n${badge}\n\n`;
  }

  if (pullRequestUrl) {
    section +=
      `\n\nA pull request for the LICENSE is open:\n\n` +
      `[![License](https://img.shields.io/badge/View_PR-6366f1.svg)](${pullRequestUrl})\n\n`;
  }

  return section;
}

/**
 * Maps a ValidationResult to a display emoji and label.
 * Returns a warning state for null (not checked) or unknown service errors.
 *
 * @param v - The validation result to map, or null if the check was not run.
 * @returns An object with `emoji` and `text` fields for use in a markdown table.
 */
function getValidationDisplay(v: ValidationResult | null): {
  emoji: string;
  text: string;
} {
  if (!v) return { emoji: "⚠️", text: "Not checked" };
  if (v.status === "valid") return { emoji: "✅", text: "Valid" };
  if (v.status === "unknown")
    return { emoji: "⚠️", text: "Unknown (Service error, try again)" };
  return { emoji: "❌", text: "Invalid" };
}

/**
 * Renders the Metadata section of the dashboard.
 * Skipped (warning shown) when no LICENSE file is present.
 * Shows an Add badge when files are missing, or an Edit + View Validations badge pair
 * with a validation table when both CITATION.cff and codemeta.json exist.
 * Appends a View PR badge when a pull request is open.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param data - Metadata existence flags, validation results, license presence, and open PR URL.
 * @returns Markdown string for the Metadata section.
 */
function renderMetadata(
  owner: string,
  repo: string,
  data: MetadataSectionData,
): string {
  const {
    citationValidation,
    codemetaValidation,
    exists,
    licensePresent,
    pullRequestUrl,
  } = data;
  const url = `${DOMAIN}/dashboard/${owner}/${repo}/edit/code-metadata`;
  const validationsUrl = `${DOMAIN}/dashboard/${owner}/${repo}/view/metadata-validation`;

  if (!licensePresent) {
    const badge = `![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`;
    return (
      `## Metadata\n\n` +
      `To make your software FAIR a \`CITATION.cff\` and \`codemeta.json\` metadata files are expected at the root level of your repository.\n` +
      `> [!WARNING]\n> Codefair will run this check after a LICENSE file is detected in your repository.\n\n${badge}\n\n`
    );
  }

  if (!exists.codemeta || !exists.citation) {
    const badge = `[![Metadata](https://img.shields.io/badge/Add_Metadata-dc2626.svg)](${url})`;
    return (
      `## Metadata ❌\n\n` +
      `To make your software FAIR, a \`CITATION.cff\` and \`codemeta.json\` are expected at the root level of your repository. ` +
      `These files are not found in the repository. If you would like Codefair to add these files, click the "Add metadata" button below to go to our interface for providing metadata and generating these files.\n\n${badge}\n\n`
    );
  }

  // Both files exist - show validation table
  const allValid = codemetaValidation?.isValid && citationValidation?.isValid;
  const hasUnknown =
    codemetaValidation?.status === "unknown" ||
    citationValidation?.status === "unknown";

  const editBadge = `[![Metadata](https://img.shields.io/badge/Edit_Metadata-0ea5e9.svg)](${url})`;
  const validationsBadge = `[![View Validations](https://img.shields.io/badge/View_Validations-f59e0b.svg)](${validationsUrl})`;

  let headingIcon = "✔️";
  let bodyIntro = "";
  if (allValid) {
    headingIcon = "✔️";
    bodyIntro = `A \`CITATION.cff\` and \`codemeta.json\` file are found in the repository. They may need to be updated over time as new people are contributing to the software, etc.`;
  } else if (hasUnknown) {
    headingIcon = "⚠️";
    bodyIntro = `A \`CITATION.cff\` and \`codemeta.json\` file are found in the repository, but there was an **issue validating them** (our validation service may be down). Click **View Validations** for more details.`;
  } else {
    headingIcon = "⚠️";
    bodyIntro = `A \`CITATION.cff\` and \`codemeta.json\` file are found in the repository, but there are **validation issues**. Click **View Validations** to review and resolve them.`;
  }

  const sanitize = (msg: string | undefined | null) =>
    (msg ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

  const citDisplay = getValidationDisplay(citationValidation);
  const codDisplay = getValidationDisplay(codemetaValidation);

  const table =
    `\n\n| File            | Status      | Message |\n|-----------------|-------------|----------|\n` +
    `| \`CITATION.cff\`  | ${citDisplay.emoji} ${citDisplay.text} | ${sanitize(citationValidation?.message)} |\n` +
    `| \`codemeta.json\` | ${codDisplay.emoji} ${codDisplay.text} | ${sanitize(codemetaValidation?.message)} |\n`;

  let section = `## Metadata ${headingIcon}\n\n${bodyIntro}${table}\n${editBadge} ${validationsBadge}\n\n`;

  if (pullRequestUrl) {
    section +=
      `\n\nA pull request for metadata is open:\n\n` +
      `[![Metadata](https://img.shields.io/badge/View_PR-6366f1.svg)](${pullRequestUrl})`;
  }

  return section;
}

/**
 * Renders the Language Specific Standards / CWL section of the dashboard.
 * Returns an empty string when no CWL files were detected in the repository.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param data - CWL validation summary, or null if the check was not run.
 * @returns Markdown string for the CWL section, or an empty string if no CWL files exist.
 */
function renderCWL(owner: string, repo: string, data: CWLSectionData): string {
  if (!data.summary || data.summary.files.length === 0) {
    return "";
  }

  const { failedCount, files, validOverall } = data.summary;
  const url = `${DOMAIN}/dashboard/${owner}/${repo}/view/cwl-validation`;
  const cwlBadge = `[![CWL](https://img.shields.io/badge/View_CWL_Report-0ea5e9.svg)](${url})`;

  const tableContent = files
    .map((f) => {
      const status =
        f.validation_status === "valid"
          ? "✔️ No issues found"
          : `[❌ See report](${url}?file=${encodeURIComponent(f.path)})`;
      return `| ${f.path} | ${status} |\n`;
    })
    .join("");

  const intro = validOverall
    ? `all ***${files.length}*** CWL file(s) in your repository are valid.`
    : `***${failedCount}/${files.length}*** CWL file(s) in your repository are not valid.`;

  return (
    `## Language Specific Standards\n\n` +
    `To make your software FAIR is it important to follow language specific standards and best practices. Codefair will check below that your code complies with applicable standards,\n\n` +
    `### CWL Validations ${validOverall ? "✔️" : "❗"}\n\n` +
    `Codefair has detected that you are following the Common Workflow Language (CWL) standard to describe your command line tool. ` +
    `Codefair ran the [cwltool validator](https://cwltool.readthedocs.io/en/latest/) and ${intro}\n\n` +
    `<details>\n<summary>Summary of the validation report</summary>\n\n` +
    `| File | Status |\n| :---- | :---- |\n${tableContent}</details>\n\n` +
    `To view the full report of each CWL file or to rerun the validation, click the "View CWL Report" button below.\n\n` +
    `${cwlBadge}\n\n`
  );
}

/**
 * Renders the Additional Recommendations section (CONTRIBUTING.md and CODE_OF_CONDUCT.md).
 * Each sub-item shows a Create or Edit badge and, when a pull request is open, a View PR badge.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param contributing - CONTRIBUTING.md compliance result and open PR URL.
 * @param cofc - CODE_OF_CONDUCT.md compliance result and open PR URL.
 * @returns Markdown string for the Additional Recommendations section.
 */
function renderAdditionalChecks(
  owner: string,
  repo: string,
  contributing: ContributingCheckData,
  cofc: CofcCheckData,
): string {
  const contribUrl = `${DOMAIN}/dashboard/${owner}/${repo}/edit/contributing`;
  const cofcUrl = `${DOMAIN}/dashboard/${owner}/${repo}/edit/code-of-conduct`;

  const items = [
    {
      badge: `${contributing.result.status ? "Edit" : "Create"}_CONTRIBUTING-${contributing.result.status ? "0ea5e9" : "dc2626"}`,
      label: "CONTRIBUTING.md",
      pullRequestUrl: contributing.pullRequestUrl,
      reason:
        "This file helps communicate contribution processes and gives contributors clear guidelines placed at the repo root (or in docs/ or .github/), saving time and reducing rework. It surfaces automatically on pull requests, issues, and the repository's Contribute page to guide contributors at every step.",
      status: contributing.result.status,
      url: contribUrl,
    },
    {
      badge: `${cofc.result.status ? "Edit" : "Create"}_CODE_OF_CONDUCT-${cofc.result.status ? "0ea5e9" : "dc2626"}`,
      label: "CODE_OF_CONDUCT.md",
      pullRequestUrl: cofc.pullRequestUrl,
      reason:
        "Defines clear standards for respectful engagement and shows a welcoming, inclusive community by outlining expectations and procedures for handling abuse. When placed at the repo root (or in docs/ or .github/), CODE_OF_CONDUCT.md surfaces in the repository's community profile and contributor pages to guide behavior at every step.",
      status: cofc.result.status,
      url: cofcUrl,
    },
  ];

  const itemsMarkdown = items
    .map(({ badge, label, pullRequestUrl, reason, status, url }) => {
      let md = `### ${label} ${status ? "✔️" : "❗"}\n\n${reason}\n\n[![${label}](https://img.shields.io/badge/${badge}.svg)](${url})\n`;
      if (pullRequestUrl) {
        md +=
          `\n\nA pull request for ${label} is open:\n\n` +
          `[![${label}](https://img.shields.io/badge/View_PR-6366f1.svg)](${pullRequestUrl})\n`;
      }
      return md;
    })
    .join("\n");

  return (
    `## Additional Recommendations\n\n` +
    `Although these files are not part of the core FAIR compliance checks, ` +
    `Codefair recommends including them to improve project governance, community engagement, and contributor experience:\n\n` +
    `${itemsMarkdown}\n`
  );
}

// ===== Main entry point =========================================

/**
 * Renders the full dashboard issue body from the compliance checks.
 *
 * @param sections - All section data (compliance results, DB metadata, and archival state).
 * @returns The full GitHub issue body markdown string.
 */
export function renderDashboard(sections: DashboardSections): string {
  const {
    archival,
    cofc,
    contributing,
    cwl,
    license,
    metadata,
    owner,
    readme,
    repo,
  } = sections;

  const header =
    `# FAIR Compliance Dashboard\n\n` +
    `This issue is your repository's dashboard for all things FAIR. Keep it open as making ` +
    `and keeping software FAIR is a continuous process that evolves along with the software. ` +
    `You can read the [documentation](https://docs.codefair.io/docs/dashboard.html) to learn more.\n\n`;

  let body = header;
  body += renderReadme(owner, repo, readme);
  body += renderLicense(owner, repo, license);
  body += renderMetadata(owner, repo, metadata);
  body += renderCWL(owner, repo, cwl);
  body += `\n\n${renderArchival(owner, repo, archival)}\n\n`;
  body += `\n\n${renderAdditionalChecks(owner, repo, contributing, cofc)}\n\n`;
  body = applyLastModified(body);

  return body;
}

/**
 * Renders the issue body for a repository that has no content yet.
 *
 * @returns The GitHub issue body markdown string for an empty repository.
 */
export function renderEmptyRepoDashboard(): string {
  const body =
    `# FAIR Compliance Dashboard\n\n` +
    `This issue is your repository's dashboard for all things FAIR. Keep it open ` +
    `as making and keeping software FAIR is a continuous process that evolves along ` +
    `with the software. You can read the [documentation](https://docs.codefair.io/docs/dashboard.html) to learn more.\n\n` +
    `> [!WARNING]\n> Currently your repository is empty and will not be checked until content is detected within your repository.\n\n` +
    `## LICENSE\n\n` +
    `To make your software reusable a license file is expected at the root level of your repository. ` +
    `Codefair will check for a license file after you add content to your repository.\n\n` +
    `![License](https://img.shields.io/badge/License_Not_Checked-fbbf24)\n\n` +
    `## Metadata\n\n` +
    `To make your software FAIR a CITATION.cff and codemeta.json metadata files are expected at the root level of your repository. ` +
    `Codefair will check for these files after a license file is detected.\n\n` +
    `![Metadata](https://img.shields.io/badge/Metadata_Not_Checked-fbbf24)`;
  return applyLastModified(body);
}

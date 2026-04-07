/**
 * Compliance orchestrator.
 * Runs all compliance checks in parallel (CWL is conditional) and returns
 * a unified `ComplianceSubjects` object for the dashboard and db.
 */
import type { RepositoryProvider } from "../providers/interface";
import { checkForReadme } from "./readme";
import type { ReadmeResult } from "./readme";
import {
  checkForContributingFile,
  checkForCodeofConduct,
} from "./contributing";
import type { ContributingResult, CodeOfConductResult } from "./contributing";
import { checkForLicense } from "./license";
import type { LicenseResult } from "./license";
import { checkMetadataFilesExists } from "./metadata";
import type { MetadataExistsResult } from "./metadata";
import { getCWLFiles } from "./cwl";
import type { CWLScanResult } from "./cwl";

// == Types ========================================================

export type CheckName =
  | "readme"
  | "license"
  | "metadata"
  | "cwl"
  | "contributing"
  | "cofc";

export interface RunComplianceOptions {
  /**
   * When true, all checks including CWL are run.
   * When false (default), CWL is skipped unless listed in `checks`.
   */
  checks?: CheckName[];
  /**
   * Limit the run to specific checks only.
   * When omitted, all checks are run (respecting `fullCodefairRun` for CWL).
   */
  fullCodefairRun?: boolean;
}

export interface ComplianceSubjects {
  cofc: CodeOfConductResult;
  contributing: ContributingResult;
  cwl: CWLScanResult | null;
  license: LicenseResult;
  metadata: MetadataExistsResult;
  readme: ReadmeResult;
}

// == Helpers ========================================================

/**
 * Determines whether a given compliance check should run based on the options.
 *
 * @param name - The name of the compliance check to evaluate.
 * @param opts - The run options, which may restrict which checks are executed.
 * @returns `true` if the check should run, `false` if it should be skipped.
 */
function shouldRun(name: CheckName, opts: RunComplianceOptions): boolean {
  if (opts.checks && opts.checks.length > 0) {
    return opts.checks.includes(name);
  }
  return true;
}

// == Orchestrator ========================================================

/**
 * Runs compliance checks for a repository.
 * Non-CWL checks are parallelised. CWL is run only when requested.
 *
 * @param provider - The repository provider used to fetch file contents.
 * @param owner - The GitHub owner (user or organisation) of the repository.
 * @param repo - The repository name.
 * @param repositoryId - The numeric database ID of the repository.
 * @param opts - Options controlling which checks to run and whether to include CWL.
 * @returns A `ComplianceSubjects` object containing results for all requested checks.
 */
export async function runComplianceChecks(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
  repositoryId: number,
  opts: RunComplianceOptions = {},
): Promise<ComplianceSubjects> {
  const runCwl =
    opts.fullCodefairRun === true ||
    (opts.checks ? opts.checks.includes("cwl") : true);

  // Default stubs (used when a check is skipped)
  const defaultReadme: ReadmeResult = { content: "", path: "", status: false };
  const defaultLicense: LicenseResult = {
    content: "",
    path: "",
    spdx_id: null,
    status: false,
  };
  const defaultMetadata: MetadataExistsResult = {
    citation: false,
    codemeta: false,
  };
  const defaultContributing: ContributingResult = {
    content: "",
    path: "",
    status: false,
  };
  const defaultCofc: CodeOfConductResult = {
    content: "",
    path: "",
    status: false,
  };

  const [readme, license, metadata, contributing, cofc] = await Promise.all([
    shouldRun("readme", opts)
      ? checkForReadme(provider, owner, repo)
      : Promise.resolve(defaultReadme),
    shouldRun("license", opts)
      ? checkForLicense(provider, owner, repo)
      : Promise.resolve(defaultLicense),
    shouldRun("metadata", opts)
      ? checkMetadataFilesExists(provider, owner, repo)
      : Promise.resolve(defaultMetadata),
    shouldRun("contributing", opts)
      ? checkForContributingFile(provider, owner, repo)
      : Promise.resolve(defaultContributing),
    shouldRun("cofc", opts)
      ? checkForCodeofConduct(provider, owner, repo)
      : Promise.resolve(defaultCofc),
  ]);

  let cwl: CWLScanResult | null = null;
  if (runCwl) {
    cwl = await getCWLFiles(provider, owner, repo, repositoryId);
  }

  return { cofc, contributing, cwl, license, metadata, readme };
}

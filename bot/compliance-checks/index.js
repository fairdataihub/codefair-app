import { checkForLicense } from "./license/index.js";
import { checkForCitation } from "./citation/index.js";
import { checkForCodeMeta } from "./codemeta/index.js";
import { getCWLFiles } from "./cwl/index.js";
import { checkForReadme } from "./readme/index.js";

/**
 * * Check for compliance of a repository with Codefair standards.
 * @param {Object} context
 * @param {String} owner
 * @param {Object} repository
 * @param {Boolean} fullCodefairRun
 *
 * @returns {Object} An object containing the results of the compliance checks.
 * @property {Boolean} citation - Boolean citation check result.
 * @property {Boolean} codemeta - Boolean codemeta check result.
 * @property {Object} cwl - Object containing information about CWL files.
 * @property {Boolean} cwl.contains_cwl_files - Boolean indicating if CWL files are present.
 * @property {Array} cwl.files - Array of CWL files found in the repository.
 * @property {Array} cwl.removed_files - Array of CWL files that were removed.
 * @property {Boolean} license - Boolean license check result.
 */
export async function runComplianceChecks(
  context,
  owner,
  repository,
  fullCodefairRun = true
) {
  let cwlObject = {
    contains_cwl_files: false,
    files: [],
    removed_files: [],
  };
  const readme = await checkForReadme(context, owner, repository.name);
  const license = await checkForLicense(context, owner, repository.name);
  const citation = await checkForCitation(context, owner, repository.name);
  const codemeta = await checkForCodeMeta(context, owner, repository.name);
  if (fullCodefairRun) {
    cwlObject = await getCWLFiles(context, owner, repository);
  }

  return {
    citation,
    codemeta,
    cwl: cwlObject,
    license,
    readme,
  };
}

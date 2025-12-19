import { checkForLicense } from "./license/index.js";
import { getCWLFiles } from "./cwl/index.js";
import { checkForReadme } from "./readme/index.js";
import { checkMetadataFilesExists } from "./metadata/index.js";
import {
  checkForCodeofConduct,
  checkForContributingFile,
} from "./additional-checks/index.js";
import logwatch from "../utils/logwatch.js";

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
  const { citation, codemeta } = await checkMetadataFilesExists(
    context,
    owner,
    repository
  );

  const contributing = await checkForContributingFile(
    context,
    owner,
    repository.name
  );
  logwatch.info(`Contributing check: ${contributing.status}`);
  const cofc = await checkForCodeofConduct(context, owner, repository.name);
  logwatch.info(`Code of Conduct check: ${cofc.status}`);

  if (fullCodefairRun) {
    cwlObject = await getCWLFiles(context, owner, repository);
  }

  const subjects = {
    citation,
    codemeta,
    cwl: cwlObject,
    license,
    readme,
    contributing,
    cofc,
  };

  logwatch.info(
    { message: `Compliance checks for ${owner}/${repository.name}`, subjects },
    true
  );

  return {
    citation,
    codemeta,
    cwl: cwlObject,
    license,
    readme,
    contributing,
    cofc,
  };
}

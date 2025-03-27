import { checkForLicense } from "../../license/index.js";
import { checkForCitation } from "../../citation/index.js";
import { checkForCodeMeta } from "../../codemeta/index.js";
import { getCWLFiles } from "../../cwl/index.js";

export async function checkForCompliance(
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
  };
}

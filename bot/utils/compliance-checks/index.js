import { checkForLicense } from '../../license/index.js'
import { checkForCitation } from '../../citation/index.js'
import { checkForCodeMeta } from '../../codemeta/index.js'
import { getCWLFiles } from '../../cwl/index.js'

export async function checkForCompliance(
  context,
  owner,
  repositoryName,
  fullCodefairRun = true
) {
  let cwlObject = {
    contains_cwl_files: false,
    files: [],
    removed_files: [],
  }
  const license = await checkForLicense(context, owner, repositoryName)
  const citation = await checkForCitation(context, owner, repositoryName)
  const codemeta = await checkForCodeMeta(context, owner, repositoryName)
  if (fullCodefairRun) {
    cwlObject = await getCWLFiles(context, owner, repositoryName)
  }

  return {
    citation,
    codemeta,
    cwl: cwlObject,
    license,
  }
}

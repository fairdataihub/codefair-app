export async function checkForCWLFile(context, owner, repo) {
  console.log("Checking for CWL file");
  try {
    const repoContent = await context.octokit.repos.getContent({
      owner,
      repo,
    });

    let cwlFileExists = false;
    // console.log("repoCONTENT");
    // console.log(repoContent);``
    // console.log("repoCONTENT");

    for (const file of repoContent.data) {
      const fileSplit = file.name.split(".");
      // console.log("fileSplit");
      // console.log(fileSplit);
      if (fileSplit.includes("cwl")) {
        console.log("CWL file found");
        cwlFileExists = true;
        break;
      }
    }

    return cwlFileExists;
  } catch (error) {
    console.log("Error getting the repository content");
    console.log(error);
    if (error.status === 404) {
      // Repository is empty
      return false;
    }
  }
}

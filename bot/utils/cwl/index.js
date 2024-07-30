export async function checkForCWLFile(context, owner, repo) {
  const cwlFiles = [];
  console.log("Checking for CWL files in the repository");

  async function searchDirectory(path) {
    try {
      const repoContent = await context.octokit.repos.getContent({
        owner,
        path,
        repo,
      });

      for (const file of repoContent.data) {
        // const fileSplit = file.name.split(".");
        // fileSplit.includes("cwl")
        if (file.type === "file" && file.name.endsWith(".cwl")) {
          cwlFiles.push(file);
        }
        if (file.type === "dir") {
          await searchDirectory(file.path);
        }
      }
    } catch (error) {
      console.log("Error getting the repository content");
      console.log(error);
      if (error.status === 404) {
        // Repository is empty
        return cwlFiles;
      }
    }
  }

  try {
    await searchDirectory("");
    return cwlFiles;
  } catch (error) {
    console.log("Error checking for CWL file");
    console.log(error);
  }
}

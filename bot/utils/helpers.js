export const ISSUE_TITLE = "FAIR Compliance Dashboard";

export const PR_TITLES = {
  license: "feat: \u2728 LICENSE file added",
  metadataAdd: "feat: \u2728 Add code metadata files",
  metadataUpdate: "feat: \u2728 Update code metadata files",
};

/**
 * Creates an empty commit info object
 * Used when repository is empty or commit details are not yet available
 */
export function createEmptyCommitInfo() {
  return {
    latest_commit_sha: "",
    latest_commit_message: "",
    latest_commit_url: "",
    latest_commit_date: "",
  };
}

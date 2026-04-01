// Supporting types

export interface CommitDetails {
  date: string;
  message: string;
  sha: string;
  url: string;
}

export interface RepoInfo {
  name: string;
  defaultBranch: string;
  description: string | null;
  htmlUrl: string;
  owner: string;
  private: boolean;
}

/** File content with the raw bytes already decoded to a UTF-8 string. */
export interface FileContent {
  content: string;
  /** Decoded UTF-8 string */
  downloadUrl: string | null;
  htmlUrl: string | null;
  path: string;
  sha: string;
}

export interface DirectoryEntry {
  name: string;
  downloadUrl: string | null;
  htmlUrl: string | null;
  path: string;
  sha: string;
  type: "file" | "dir" | "symlink";
}

export interface ContributorInfo {
  name: string | null;
  company: string | null;
  email: string | null;
  login: string;
  type: "User" | "Bot" | "Organization";
}

export interface DetectedLicense {
  /** SPDX identifier but null when GitHub cannot detect a common one. */
  name: string | null;
  spdxId: string | null;
}

export interface CommitFileOptions {
  branch: string;
  content: string;
  /** Base64-encoded file content */
  message: string;
  path: string;
  /** Required when updating an existing file */
  sha?: string;
}

export interface CreatePROptions {
  title: string;
  base: string;
  /** Source branch */
  body: string;
  /** Deault branch (usually the main branch) */
  head: string;
}

export interface PullRequestRef {
  htmlUrl: string;
  number: number;
  state: "open" | "closed" | "merged";
}

export interface IssueRef {
  title: string;
  body: string | null;
  htmlUrl: string;
  number: number;
  state: "open" | "closed";
  userLogin: string | null;
}

export interface ListIssuesOptions {
  creator?: string;
  labels?: string[];
  state?: "open" | "closed" | "all";
}

// Provider interface

/**
 * Platform-agnostic repository provider.
 *
 * All compliance services receive a `RepositoryProvider` instead of a
 * platform-specific SDK (e.g. Octokit). A `GitHubRepositoryProvider`
 * implements this interface today; a future `GitLabRepositoryProvider` will
 * implement the same contract.
 */
export interface RepositoryProvider {
  // Read

  getRepoInfo(owner: string, repo: string): Promise<RepoInfo>;

  getLatestCommit(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<CommitDetails>;

  /**
   * Returns the file content at `path`, or `null` when the file does not
   * exist (404). All other errors are sent as is.
   * Pass `ref` to read from a specific branch / commit SHA.
   */
  getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<FileContent | null>;

  /**
   * Lists the entries of a directory. Returns an empty array when the path
   * does not exist (404). All other errors are sent as is.
   */
  listDirectory(
    owner: string,
    repo: string,
    path: string,
  ): Promise<DirectoryEntry[]>;

  listContributors(owner: string, repo: string): Promise<ContributorInfo[]>;

  listLanguages(owner: string, repo: string): Promise<string[]>;

  detectLicense(owner: string, repo: string): Promise<DetectedLicense>;

  // Write

  getBranchSha(owner: string, repo: string, branch: string): Promise<string>;

  createBranch(
    owner: string,
    repo: string,
    name: string,
    fromSha: string,
  ): Promise<void>;

  commitFile(
    owner: string,
    repo: string,
    options: CommitFileOptions,
  ): Promise<void>;

  createPullRequest(
    owner: string,
    repo: string,
    options: CreatePROptions,
  ): Promise<PullRequestRef>;

  getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestRef>;

  deleteBranch(owner: string, repo: string, name: string): Promise<void>;

  // Issues

  listIssues(
    owner: string,
    repo: string,
    options: ListIssuesOptions,
  ): Promise<IssueRef[]>;

  createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
  ): Promise<IssueRef>;

  updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ): Promise<void>;

  // Identity
  /** Returns the bot login string, e.g. `"codefair-io[bot]"`. */
  getBotLogin(): string;
}

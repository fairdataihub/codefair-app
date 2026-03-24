import { getInstallationOctokit } from "../github-app/client";
import type {
  CommitFileOptions,
  ContributorInfo,
  CreatePROptions,
  DetectedLicense,
  DirectoryEntry,
  FileContent,
  IssueRef,
  ListIssuesOptions,
  PullRequestRef,
  RepoInfo,
  RepositoryProvider,
} from "./interface";

type InstallationOctokit = Awaited<ReturnType<typeof getInstallationOctokit>>;

const GH_API_VERSION = "2022-11-28";
const headers = { "X-GitHub-Api-Version": GH_API_VERSION };

export class GitHubRepositoryProvider implements RepositoryProvider {
  private octokit: InstallationOctokit;

  /**
   * @param octokit - An authenticated Octokit instance scoped to a GitHub App installation.
   */
  constructor(octokit: InstallationOctokit) {
    this.octokit = octokit;
  }

  /** Factory - resolves the installation Octokit then wraps it to a GitHubRepositoryProvider */
  static async create(
    installationId: number,
  ): Promise<GitHubRepositoryProvider> {
    const octokit = await getInstallationOctokit(installationId);
    return new GitHubRepositoryProvider(octokit);
  }

  /**
   * Returns the GitHub login name used by this app's bot account.
   * @returns The bot login in the form `<app-name>[bot]`.
   */
  getBotLogin(): string {
    return `${process.env.GH_APP_NAME}[bot]`;
  }

  // Read ==================================================================================

  /**
   * Fetches metadata for a repository.
   * @param owner - The repository owner (user or organization login).
   * @param repo - The repository name.
   * @returns Basic repository information.
   */
  async getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    const { data } = await this.octokit.request("GET /repos/{owner}/{repo}", {
      headers,
      owner,
      repo,
    });
    return {
      name: data.name,
      defaultBranch: data.default_branch,
      description: data.description ?? null,
      htmlUrl: data.html_url,
      owner: data.owner.login,
      private: data.private,
    };
  }

  /**
   * Retrieves the decoded content of a single file from the repository.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param path - Path to the file within the repository.
   * @param ref - Optional git ref (branch, tag, or commit SHA) to read from.
   * @returns The file content, or `null` if the path does not exist or is not a file.
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<FileContent | null> {
    try {
      const { data } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/contents/{path}",
        { headers, owner, path, ...(ref ? { ref } : {}), repo },
      );
      if (Array.isArray(data) || data.type !== "file") return null;
      return {
        content: Buffer.from(data.content, "base64").toString("utf-8"),
        downloadUrl: data.download_url ?? null,
        htmlUrl: data.html_url ?? null,
        path: data.path,
        sha: data.sha,
      };
    } catch (err: any) {
      if (err.status === 404) return null;
      throw err;
    }
  }

  /**
   * Lists the entries of a directory in the repository.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param path - Path to the directory within the repository.
   * @returns An array of directory entries, or an empty array if the path does not exist.
   */
  async listDirectory(
    owner: string,
    repo: string,
    path: string,
  ): Promise<DirectoryEntry[]> {
    try {
      const { data } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/contents/{path}",
        { headers, owner, path, repo },
      );
      if (!Array.isArray(data)) return [];
      return data.map((item) => ({
        name: item.name,
        downloadUrl: item.download_url ?? null,
        htmlUrl: item.html_url ?? null,
        path: item.path,
        sha: item.sha,
        type: item.type as "file" | "dir" | "symlink",
      }));
    } catch (err: any) {
      if (err.status === 404) return [];
      throw err;
    }
  }

  /**
   * Lists the contributors of a repository.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @returns An array of contributor information. Returns an empty array on error.
   */
  async listContributors(
    owner: string,
    repo: string,
  ): Promise<ContributorInfo[]> {
    try {
      const { data } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/contributors",
        { headers, owner, repo },
      );
      return data.map((c) => ({
        name: null,
        company: null,
        email: null,
        login: c.login ?? "",
        type: (c.type ?? "User") as "User" | "Bot" | "Organization",
      }));
    } catch {
      return [];
    }
  }

  /**
   * Returns the programming languages detected in the repository.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @returns An array of language names, or an empty array on error.
   */
  async listLanguages(owner: string, repo: string): Promise<string[]> {
    try {
      const { data } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/languages",
        { headers, owner, repo },
      );
      return Object.keys(data);
    } catch {
      return [];
    }
  }

  /**
   * Detects the license of a repository using the GitHub license API.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @returns The detected license name and SPDX identifier, with `null` fields if none is found.
   */
  async detectLicense(owner: string, repo: string): Promise<DetectedLicense> {
    try {
      const { data } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/license",
        { headers, owner, repo },
      );
      return {
        name: data.license?.name ?? null,
        spdxId: data.license?.spdx_id ?? null,
      };
    } catch (err: any) {
      if (err.status === 404) return { name: null, spdxId: null };
      throw err;
    }
  }

  // Write ==================================================================================

  /**
   * Resolves the HEAD commit SHA of a branch.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param branch - The branch name.
   * @returns The full SHA of the branch tip commit.
   */
  async getBranchSha(
    owner: string,
    repo: string,
    branch: string,
  ): Promise<string> {
    const { data } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/git/ref/{ref}",
      { headers, owner, ref: `heads/${branch}`, repo },
    );
    return data.object.sha;
  }

  /**
   * Creates a new branch pointing to the given commit SHA.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param name - The name of the new branch.
   * @param fromSha - The commit SHA the new branch should point to.
   */
  async createBranch(
    owner: string,
    repo: string,
    name: string,
    fromSha: string,
  ): Promise<void> {
    await this.octokit.request("POST /repos/{owner}/{repo}/git/refs", {
      headers,
      owner,
      ref: `refs/heads/${name}`,
      repo,
      sha: fromSha,
    });
  }

  /**
   * Creates or updates a single file in the repository with a commit.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param options - Commit options including path, content, message, branch, and optional existing file SHA.
   */
  async commitFile(
    owner: string,
    repo: string,
    options: CommitFileOptions,
  ): Promise<void> {
    await this.octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
      branch: options.branch,
      content: options.content,
      headers,
      message: options.message,
      owner,
      path: options.path,
      repo,
      ...(options.sha ? { sha: options.sha } : {}),
    });
  }

  /**
   * Opens a new pull request.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param options - Pull request options including title, body, head branch, and base branch.
   * @returns A reference to the newly created pull request.
   */
  async createPullRequest(
    owner: string,
    repo: string,
    options: CreatePROptions,
  ): Promise<PullRequestRef> {
    const { data } = await this.octokit.request(
      "POST /repos/{owner}/{repo}/pulls",
      {
        title: options.title,
        base: options.base,
        body: options.body,
        head: options.head,
        headers,
        owner,
        repo,
      },
    );
    return {
      htmlUrl: data.html_url,
      number: data.number,
      state: data.merged ? "merged" : (data.state as "open" | "closed"),
    };
  }

  /**
   * Fetches a pull request by its number.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param pullNumber - The pull request number.
   * @returns A reference to the pull request including its current state.
   */
  async getPullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
  ): Promise<PullRequestRef> {
    const { data } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      { headers, owner, pull_number: pullNumber, repo },
    );
    return {
      htmlUrl: data.html_url,
      number: data.number,
      state: data.merged ? "merged" : (data.state as "open" | "closed"),
    };
  }

  /**
   * Deletes a branch from the repository. Silently ignores 422 errors (branch already deleted).
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param name - The name of the branch to delete.
   */
  async deleteBranch(owner: string, repo: string, name: string): Promise<void> {
    try {
      await this.octokit.request(
        "DELETE /repos/{owner}/{repo}/git/refs/{ref}",
        { headers, owner, ref: `heads/${name}`, repo },
      );
    } catch (err: any) {
      if (err.status === 422) return; // already deleted
      throw err;
    }
  }

  // Issues ==================================================================================

  /**
   * Lists issues for a repository, optionally filtered by creator, labels, or state.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param options - Filter options such as creator login, label names, and issue state.
   * @returns An array of matching issue references.
   */
  async listIssues(
    owner: string,
    repo: string,
    options: ListIssuesOptions,
  ): Promise<IssueRef[]> {
    const { data } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/issues",
      {
        creator: options.creator,
        headers,
        labels: options.labels?.join(","),
        owner,
        repo,
        state: options.state ?? "open",
      },
    );
    return data.map((issue) => ({
      title: issue.title,
      body: issue.body ?? null,
      htmlUrl: issue.html_url,
      number: issue.number,
      state: issue.state as "open" | "closed",
      userLogin: issue.user?.login ?? null,
    }));
  }

  /**
   * Creates a new issue in the repository.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param title - The issue title.
   * @param body - The issue body (markdown supported).
   * @returns A reference to the newly created issue.
   */
  async createIssue(
    owner: string,
    repo: string,
    title: string,
    body: string,
  ): Promise<IssueRef> {
    const { data } = await this.octokit.request(
      "POST /repos/{owner}/{repo}/issues",
      { title, body, headers, owner, repo },
    );
    return {
      title: data.title,
      body: data.body ?? null,
      htmlUrl: data.html_url,
      number: data.number,
      state: data.state as "open" | "closed",
      userLogin: data.user?.login ?? null,
    };
  }

  /**
   * Updates the body of an existing issue.
   * @param owner - The repository owner.
   * @param repo - The repository name.
   * @param issueNumber - The issue number to update.
   * @param body - The new body content for the issue (markdown supported).
   */
  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ): Promise<void> {
    await this.octokit.request(
      "PATCH /repos/{owner}/{repo}/issues/{issue_number}",
      { body, headers, issue_number: issueNumber, owner, repo },
    );
  }
}

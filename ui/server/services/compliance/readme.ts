import type { RepositoryProvider } from "../providers/interface";

export interface ReadmeResult {
  content: string;
  path: string;
  status: boolean;
}

const README_PATHS = [
  "README.md",
  "README.txt",
  "README",
  "docs/README.md",
  "docs/README.txt",
  "docs/README",
  ".github/README.md",
  ".github/README.txt",
  ".github/README",
];

/**
 * Checks whether a README file exists in the repository.
 * @param provider - The repository provider used to fetch file contents.
 * @param owner - The GitHub owner (user or organisation) of the repository.
 * @param repo - The repository name.
 * @returns A `ReadmeResult` with the file content, path, and a boolean status
 *   indicating whether a README was found.
 */
export async function checkForReadme(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
): Promise<ReadmeResult> {
  for (const filePath of README_PATHS) {
    const file = await provider.getFileContent(owner, repo, filePath);
    if (file) {
      return { content: file.content, path: file.path, status: true };
    }
  }
  return { content: "", path: "No README file found", status: false };
}

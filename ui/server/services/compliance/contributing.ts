import type { RepositoryProvider } from "../providers/interface";

export interface ContributingResult {
  content: string;
  path: string;
  status: boolean;
}

export interface CodeOfConductResult {
  content: string;
  path: string;
  status: boolean;
}

const CONTRIBUTING_PATHS = [
  "CONTRIBUTING.md",
  "CONTRIBUTING.txt",
  "CONTRIBUTING",
  "docs/CONTRIBUTING.md",
  "docs/CONTRIBUTING.txt",
  "docs/CONTRIBUTING",
  ".github/CONTRIBUTING.md",
  ".github/CONTRIBUTING.txt",
  ".github/CONTRIBUTING",
];

const CODE_OF_CONDUCT_PATHS = [
  "CODE_OF_CONDUCT.md",
  "CODE_OF_CONDUCT.txt",
  "CODE_OF_CONDUCT",
  "docs/CODE_OF_CONDUCT.md",
  "docs/CODE_OF_CONDUCT.txt",
  "docs/CODE_OF_CONDUCT",
  ".github/CODE_OF_CONDUCT.md",
  ".github/CODE_OF_CONDUCT.txt",
  ".github/CODE_OF_CONDUCT",
];

/**
 * Checks whether a CONTRIBUTING file exists in the repository.
 */
export async function checkForContributingFile(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
): Promise<ContributingResult> {
  for (const filePath of CONTRIBUTING_PATHS) {
    const file = await provider.getFileContent(owner, repo, filePath);
    if (file) {
      return { content: file.content, path: file.path, status: true };
    }
  }
  return {
    content: "",
    path: "No Contributing file found",
    status: false,
  };
}

/**
 * Checks whether a CODE_OF_CONDUCT file exists in the repository.
 */
export async function checkForCodeofConduct(
  provider: RepositoryProvider,
  owner: string,
  repo: string,
): Promise<CodeOfConductResult> {
  for (const filePath of CODE_OF_CONDUCT_PATHS) {
    const file = await provider.getFileContent(owner, repo, filePath);
    if (file) {
      return { content: file.content, path: file.path, status: true };
    }
  }
  return {
    content: "",
    path: "No Code of Conduct file found",
    status: false,
  };
}

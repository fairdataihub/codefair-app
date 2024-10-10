interface GitHubRelease {
  id: number;
  name: string;
  tagName: string;
  targetCommitish: string;
  assetsUrl: string;
  htmlUrl: string;
  draft: boolean;
  prerelease: boolean;
}

interface GitHubReleases extends Array<GitHubRelease> {}

interface GitHubRelease {
  id: number;
  name: string;
  tagName: string;
  targetCommitish: string;
  assetsUrl: string;
  htmlUrl: string;
  draft: boolean;
  prerelease: boolean;
  updatedAt: string;
}

interface GitHubTag {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  zipballUrl: string;
  tarballUrl: string;
  node_id: string;
  released: boolean;
}

interface GitHubTags extends Array<GitHubTag> {}

interface GitHubReleases extends Array<GitHubRelease> {}

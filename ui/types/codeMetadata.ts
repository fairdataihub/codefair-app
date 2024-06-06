interface CodeMetadataRequest {
  name: string;
  description: string;
  creationDate?: string | null;
  firstReleaseDate?: string | null;
  license: string | null;
  uniqueIdentifier?: string;
  applicationCategory?: string | null;
  keywords: string[];
  fundingCode?: string;
  fundingOrganzation?: string;
  codeRepository?: string;
  continuousIntegration?: string;
  issueTracker?: string;
  relatedLinks?: string[];
  programmingLanguages: string[];
  runtimePlatform?: string | null;
  operatingSystem?: string | null;
  otherSoftwareRequirements?: string[];
  currentVersion?: string;
  currentVersionReleaseDate?: string | null;
  currentVersionDownloadURL?: string;
  currentVersionReleaseNotes?: string;
  referencePublication?: string;
  reviewAspect?: string;
  reviewBody?: string;
  developmentStatus?: string | null;
  isPartOf?: string;
  authors: {
    givenName: string;
    familyName?: string;
    email?: string;
    uri: string;
    affiliation?: string;
  }[];
  contributors: {
    givenName: string;
    familyName?: string;
    email?: string;
    uri: string;
    affiliation?: string;
    roles: {
      role: string | null;
      startDate?: string;
      endDate?: string;
    }[];
  }[];
}

interface CodeMetadataRequestGetResponse {
  identifier: string;
  owner: string;
  repo: string;
  metadata: CodeMetadataRequest;
  createdAt: number;
  updatedAt: number;
}

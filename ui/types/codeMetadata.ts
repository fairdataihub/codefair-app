interface CodeMetadataRequest {
  name: string;
  description: string;
  creationDate: string;
  firstReleaseDate: string;
  license: string;
  uniqueIdentifier?: string;
  applicationCategory?: string;
  keywords: string[];
  fundingCode?: string;
  fundingOrganzation?: string;
  codeRepository?: string;
  continuousIntegration?: string;
  issueTracker?: string;
  relatedLinks?: string[];
  programmingLanguages: string[];
  runtimePlatform?: string;
  operatingSystem?: string;
  otherSoftwareRequirements?: string[];
  currentVersion?: string;
  currentVersionReleaseDate?: string;
  currentVersionDownloadURL?: string;
  currentVersionReleaseNotes?: string;
  referencePublication?: string;
  reviewAspect?: string;
  reviewBody?: string;
  developmentStatus?: string;
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
      role: string;
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

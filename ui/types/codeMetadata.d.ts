interface CodeMetadataRequest {
  name: string;
  applicationCategory?: string | null;
  authors: {
    affiliation?: string;
    email?: string;
    familyName?: string;
    givenName: string;
    roles: {
      endDate?: number | null;
      role: string | null;
      startDate?: number | null;
    }[];
    uri?: string;
  }[];
  codeRepository?: string;
  continuousIntegration?: string;
  contributors: {
    affiliation?: string;
    email?: string;
    familyName?: string;
    givenName: string;
    roles: {
      endDate?: number | null;
      role: string | null;
      startDate?: number | null;
    }[];
    uri?: string;
  }[];
  creationDate?: number | null;
  currentVersion?: string;
  currentVersionDownloadURL?: string;
  currentVersionReleaseDate?: number | null;
  currentVersionReleaseNotes?: string;
  description: string;
  developmentStatus?: string | null;
  firstReleaseDate?: number | null;
  fundingCode?: string;
  fundingOrganization?: string;
  isPartOf?: string;
  isSourceCodeOf?: string;
  issueTracker?: string;
  keywords: string[];
  license: string | null;
  operatingSystem?: string[];
  otherSoftwareRequirements?: string[];
  programmingLanguages: string[];
  referencePublication?: string;
  relatedLinks?: string[];
  reviewAspect?: string;
  reviewBody?: string;
  runtimePlatform?: string[];
  uniqueIdentifier?: string;
}

interface CodeMetadataRequestGetResponse {
  createdAt: number;
  identifier: string;
  metadata: CodeMetadataRequest;
  owner: string;
  repo: string;
  updatedAt: number;
}

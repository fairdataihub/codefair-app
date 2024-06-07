interface CodeMetadataRequest {
  name: string;
  applicationCategory?: string | null;
  authors: {
    affiliation?: string;
    email?: string;
    familyName?: string;
    givenName: string;
    roles: {
      endDate?: string | null | number;
      role: string | null;
      startDate?: string | null | number;
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
      endDate?: string | null | number;
      role: string | null;
      startDate?: string | null | number;
    }[];
    uri?: string;
  }[];
  creationDate?: string | null | number;
  currentVersion?: string;
  currentVersionDownloadURL?: string;
  currentVersionReleaseDate?: string | null | number;
  currentVersionReleaseNotes?: string;
  description: string;
  developmentStatus?: string | null;
  firstReleaseDate?: string | null | number;
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

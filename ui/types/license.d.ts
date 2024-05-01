interface LicenseRequest {
  licenseId?: string | null;
  licenseContent?: string;
}

interface LicenseRequestGetResponse extends LicenseRequest {
  identifier: string;
  owner: string;
  repo: string;
  timestamp: number;
}

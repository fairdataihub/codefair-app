interface LicenseRequest {
  licenseId?: string | null;
  licenseContent?: string;
}

interface LicenseRequestGetResponse extends LicenseRequest {
  identifier: string;
  timestamp: number;
}

interface LicenseRequest {
  licenseId?: string | null;
  licenseContent?: string;
  customLicenseTitle?: string;
}

interface LicenseRequestGetResponse extends LicenseRequest {
  timestamp: number;
}

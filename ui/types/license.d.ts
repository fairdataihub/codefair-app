interface LicenseRequest {
  licenseId?: string | null;
  licenseContent?: string;
  customLicenseTitle?: string;
  customLicenseLanguage?: string | null;
}

interface LicenseRequestGetResponse extends LicenseRequest {
  timestamp: number;
}

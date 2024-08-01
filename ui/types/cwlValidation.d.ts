interface CWLValidationResult {
  path: string;
  href: string;
  validation_status: string;
  validation_message: string;
  last_validated: number;
  last_modified: number;
}

interface CWLValidationResults extends Array<CWLValidationResult> {}

interface CWLValidationGetResponse {
  createdAt: number;
  identifier: string;
  files: CWLValidationResults;
  owner: string;
  repo: string;
  updatedAt: number;
}

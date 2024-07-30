interface CWLValidationResult {
  path: string;
  validation_status: string;
  validation_errors: string[];
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

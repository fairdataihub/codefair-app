interface CwlRequest {
  cwlContent?: string;
}

interface CwlRequestGetResponse extends CwlRequest {
  identifier: string;
  owner: string;
  repo: string;
  timestamp: number;
  validation_message?: string;
}

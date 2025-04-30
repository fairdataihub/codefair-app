interface ReadmeRequest {
  readmeContent?: string;
}

interface ReadmeRequestGetResponse extends ReadmeRequest {
  timestamp: number;
}

interface ContributingRequest {
  contribContent?: string;
}

interface ContributingRequestGetResponse extends CodeofConductRequest {
  timestamp: number;
}

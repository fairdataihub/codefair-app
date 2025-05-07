interface CodeofConductRequest {
  codeContent?: string;
}

interface CodeofConductRequestGetResponse extends CodeofConductRequest {
  timestamp: number;
}

// Shared by the publish SSE endpoint (server) and the progress modal (app).

type ZenodoUploadFileStatus =
  | "pending"
  | "downloading"
  | "uploading"
  | "committing"
  | "retrying"
  | "completed"
  | "error";

interface ZenodoUploadFileProgress {
  name: string;
  attempt?: number; // Current Zenodo upload attempt, starting at 1
  size?: number; // Bytes, once known
  status: ZenodoUploadFileStatus;
  uploadedBytes?: number; // Bytes sent to Zenodo in the current attempt
}

interface ZenodoUploadProgress {
  files: ZenodoUploadFileProgress[];
  maxAttempts: number;
}

// Streamed over SSE: the full list once, then only the file that changed, so
// releases with many assets don't resend the whole list on every event.
type ZenodoUploadUpdate =
  | { files: ZenodoUploadFileProgress[]; maxAttempts: number; type: "list" }
  | { file: ZenodoUploadFileProgress; index: number; type: "file" };

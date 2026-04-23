/**
 * Provider-agnostic types for archival workflows.
 *
 * The `ArchivalProvider` interface is the extension point for future
 * archival repositories (Figshare).
 */

// ===== Progress streaming =============================================

export type ProgressStatus = "in_progress" | "completed" | "error";

export type ProgressStep =
  | "deposition"
  | "metadata"
  | "upload_metadata"
  | "update_repo"
  | "upload_files"
  | "publish"
  | "error"
  | "complete";

export interface PublicationProgressEvent {
  data?: Record<string, unknown>;
  message: string;
  status: ProgressStatus;
  step: ProgressStep;
}

export type ProgressCallback = (
  event: PublicationProgressEvent,
) => void | Promise<void>;

// ===== Token validation ===============================================

export interface ExistingDeposition {
  id: number;
  title: string;
  conceptrecid: string;
  state: string;
  submitted: boolean;
}

export interface ArchivalTokenValidation {
  existingDepositions: ExistingDeposition[];
  message: string;
  valid: boolean;
}

// ===== Publication options ============================================

export interface ArchivalPublicationOptions {
  depositionId?: number; // Optional Zenodo deposition ID; required when `mode === "existing"`
  installationId: number; // GitHub App installation ID
  metadata: {
    accessRight: string;
    version: string;
  };
  mode: "new" | "existing";
  owner: string; // Repository owner login
  release: string; // GitHub release ID (numeric string)
  repo: string; // Repository name
  repositoryId: number; // Prisma `Installation.id` for the repository
  tag: string; // Git tag name
  userAccessToken: string; // GitHub user OAuth token used to fetch release assets
  userId: string; // Codefair user ID
}

export interface PublicationResult {
  data?: { doi: string; htmlUrl: string };
  error?: string;
  success: boolean;
}

// ===== Provider interface =============================================

/**
 * Minimal contract that an archival provider must satisfy.
 */
export interface ArchivalProvider {
  /**
   * Validates the stored token for `userId`.
   * If valid, refreshes the session; if invalid, deletes the token.
   * Returns the list of existing depositions on success.
   */
  validateToken(userId: string): Promise<ArchivalTokenValidation>;

  /**
   * Returns the OAuth authorization URL the user must visit to connect
   * their account. `state` is an opaque string the provider should echo
   * back in the callback.
   */
  getLoginUrl(state: string): string;

  /**
   * Runs the full publication workflow.
   * Progress is reported incrementally via `onProgress`.
   */
  beginPublication(
    opts: ArchivalPublicationOptions,
    onProgress?: ProgressCallback,
  ): Promise<PublicationResult>;
}

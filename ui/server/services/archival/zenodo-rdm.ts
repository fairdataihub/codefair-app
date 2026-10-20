export const RDM_ACCEPT = "application/vnd.inveniordm.v1+json";

export interface RdmRecord {
  id?: number | string;
  conceptdoi?: string;
  conceptrecid?: number | string;
  doi?: string;
  errors?: Array<{ field?: string; messages?: string[] }>;
  is_published?: boolean;
  links?: {
    latest_html?: string;
    publish?: string;
    record_html?: string;
    reserve_doi?: string;
    self_html?: string;
  };
  metadata?: {
    title?: string;
    doi?: string;
    version?: string;
  };
  parent?: {
    id?: number | string;
    pids?: { doi?: { identifier?: string } };
  };
  pids?: { doi?: { identifier?: string } };
  state?: string;
  status?: string;
  submitted?: boolean;
  versions?: { index?: number; is_latest?: boolean };
}

export interface RdmUserRecord {
  id: number;
  title: string;
  conceptDoi?: string;
  isPublished: boolean;
  version?: string;
  versionIndex?: number;
}

export type WorkingDraftOrigin =
  | "new_deposition"
  | "new_version"
  | "reused_draft";

export interface WorkingDraft {
  origin: WorkingDraftOrigin;
  record: RdmRecord;
}

export interface RdmPublishResult {
  conceptDoi?: string;
  conceptRecordId?: number;
  doi?: string;
  recordId: number;
  recordUrl: string;
}

export const UPLOAD_MAX_ATTEMPTS = 3;

export type UploadPhaseEvent =
  | { attempt: number; phase: "uploading" | "committing" }
  | { attempt: number; error: string; phase: "retrying" };

export interface UploadSource {
  /** Opens a fresh stream of the file; called again for each retry. */
  open: (signal?: AbortSignal) => Promise<ReadableStream<Uint8Array>>;
  size: number;
}

export interface UploadOptions {
  /** Bytes streamed to Zenodo so far in the current attempt. */
  onBytes?: (sent: number) => void;
  onPhase?: (event: UploadPhaseEvent) => void | Promise<void>;
  signal?: AbortSignal;
}

type FetchLike = typeof fetch;

export type ZenodoToken = string | (() => Promise<string>);

function recordId(record: RdmRecord): number | undefined {
  const id = Number(record.id);
  return Number.isFinite(id) ? id : undefined;
}

export function extractRecordDoi(
  record?: RdmRecord | null,
): string | undefined {
  return (
    record?.pids?.doi?.identifier ??
    record?.doi ??
    record?.metadata?.doi
  )?.trim();
}

export function extractConceptDoi(
  record?: RdmRecord | null,
): string | undefined {
  return (record?.parent?.pids?.doi?.identifier ?? record?.conceptdoi)?.trim();
}

export function isPublishedRecord(record?: RdmRecord | null): boolean {
  return Boolean(record?.is_published ?? record?.submitted ?? false);
}

export function sanitizeZenodoFileKey(name: string): string {
  const cleaned = name
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length ? cleaned.slice(0, 255) : "release-file";
}

// InvenioRDM saves invalid drafts and only rejects them at publish, listing the
// problems in `errors`. "Missing uploaded files" is expected until the files
// step, so only non-file problems count here.
export function draftMetadataErrors(record: RdmRecord): string[] {
  return (record.errors ?? [])
    .filter((error) => !error.field?.startsWith("files"))
    .map((error) =>
      `${error.field ?? "record"}: ${(error.messages ?? []).join(" ")}`.trim(),
    );
}

/** A failed HTTP response, keeping its status for retry and auth decisions. */
export class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

async function httpError(operation: string, response: Response) {
  const body = await response.text().catch(() => "");
  return new HttpError(
    `${operation}: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`,
    response.status,
  );
}

// Node's fetch reports network failures as a bare "fetch failed" and keeps
// the useful part (ECONNRESET, a timeout, ...) on `cause`.
function describeError(error: unknown) {
  const { cause, message } = error as Error & {
    cause?: { code?: string; message?: string };
  };
  const detail = cause?.code ?? cause?.message;
  return detail ? `${message} (${detail})` : message;
}

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

// HTTP failures are retried only for transient statuses. Anything without a
// status (a dropped connection, a timeout, a broken stream) is assumed transient.
function isRetryable(error: unknown) {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? RETRYABLE_STATUSES.has(status) : true;
}

function uploadFailure(filename: string, error: unknown) {
  return error instanceof HttpError
    ? error.message
    : `File upload transfer failed for ${filename}: ${describeError(error)}`;
}

export class ZenodoRdmClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly token: ZenodoToken;
  private readonly wait: (milliseconds: number) => Promise<void>;

  /**
   * @param token - An access token, or a function returning the current one.
   *   Long publications pass a function so requests made after the token is
   *   refreshed use the new token rather than the revoked one.
   */
  constructor(
    baseUrl: string,
    token: ZenodoToken,
    fetchImpl: FetchLike = fetch,
    wait: (milliseconds: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
    this.token = token;
    this.wait = wait;
  }

  private async headers(extra?: Record<string, string>) {
    const token =
      typeof this.token === "function" ? await this.token() : this.token;
    return {
      Accept: RDM_ACCEPT,
      Authorization: `Bearer ${token}`,
      ...extra,
    };
  }

  private async get(path: string) {
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: await this.headers(),
    });
  }

  async listUserRecords(size = 25): Promise<RdmUserRecord[]> {
    const query = new URLSearchParams({
      allversions: "false",
      page: "1",
      size: String(size),
      sort: "newest",
    });
    const response = await this.fetchImpl(
      `${this.baseUrl}/user/records?${query.toString()}`,
      { headers: await this.headers() },
    );
    if (!response.ok) throw await httpError("listUserRecords", response);

    const body = (await response.json()) as {
      hits?: { hits?: RdmRecord[] };
    };
    const records: RdmUserRecord[] = [];
    for (const hit of body.hits?.hits ?? []) {
      const id = recordId(hit);
      if (id === undefined) continue;
      const conceptDoi = extractConceptDoi(hit);
      const version = hit.metadata?.version?.trim();
      const versionIndex = hit.versions?.index;
      records.push({
        id,
        title: hit.metadata?.title ?? "Untitled record",
        isPublished: isPublishedRecord(hit),
        ...(conceptDoi && { conceptDoi }),
        ...(version && { version }),
        ...(Number.isInteger(versionIndex) && { versionIndex }),
      });
    }
    return records;
  }

  async resolveState(
    id: number,
  ): Promise<
    | { kind: "published"; record: RdmRecord }
    | { kind: "draft"; record: RdmRecord }
    | { kind: "missing" }
  > {
    const published = await this.get(`/records/${id}`);
    if (published.ok) {
      return {
        kind: "published",
        record: (await published.json()) as RdmRecord,
      };
    }
    if (published.status !== 404) {
      throw await httpError(`resolve record ${id}`, published);
    }

    const draft = await this.get(`/records/${id}/draft`);
    if (draft.ok)
      return { kind: "draft", record: (await draft.json()) as RdmRecord };
    if (draft.status === 404) return { kind: "missing" };
    throw await httpError(`resolve draft ${id}`, draft);
  }

  async createDraft(seed: object): Promise<RdmRecord> {
    const response = await this.fetchImpl(`${this.baseUrl}/records`, {
      body: JSON.stringify(seed),
      headers: await this.headers({ "Content-Type": "application/json" }),
      method: "POST",
    });
    if (!response.ok) throw await httpError("create draft", response);
    return (await response.json()) as RdmRecord;
  }

  async createVersion(id: number): Promise<RdmRecord> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/records/${id}/versions`,
      {
        headers: await this.headers({ "Content-Type": "application/json" }),
        method: "POST",
      },
    );
    if (!response.ok) throw await httpError(`create version ${id}`, response);
    return (await response.json()) as RdmRecord;
  }

  async acquireWorkingDraft(
    mode: "new" | "existing",
    selectedId: number | undefined,
    seed: object,
  ): Promise<WorkingDraft> {
    if (mode === "new") {
      return { origin: "new_deposition", record: await this.createDraft(seed) };
    }
    if (!selectedId)
      throw new Error("An existing Zenodo record ID is required");

    const state = await this.resolveState(selectedId);
    if (state.kind === "draft") {
      return { origin: "reused_draft", record: state.record };
    }
    if (state.kind === "missing") {
      throw new Error(
        `Zenodo record ${selectedId} was not found, or is not yours`,
      );
    }

    let latestId = recordId(state.record) ?? selectedId;
    const latest = await this.get(`/records/${selectedId}/versions/latest`);
    if (latest.ok) {
      latestId = recordId((await latest.json()) as RdmRecord) ?? latestId;
    }
    return {
      origin: "new_version",
      record: await this.createVersion(latestId),
    };
  }

  async purgeDraftFiles(id: number): Promise<void> {
    const listing = await this.get(`/records/${id}/draft/files`);
    if (!listing.ok)
      throw await httpError(`list files for draft ${id}`, listing);
    const body = (await listing.json()) as {
      entries?: Array<{ key?: string }>;
    };
    for (const entry of body.entries ?? []) {
      if (!entry.key) continue;
      const response = await this.fetchImpl(
        `${this.baseUrl}/records/${id}/draft/files/${encodeURIComponent(entry.key)}`,
        { headers: await this.headers(), method: "DELETE" },
      );
      if (!response.ok && response.status !== 404) {
        throw await httpError(`delete draft file ${entry.key}`, response);
      }
    }
  }

  async reserveDoi(id: number, draft?: RdmRecord): Promise<string> {
    const known = extractRecordDoi(draft);
    if (known) return known;

    const response = await this.fetchImpl(
      draft?.links?.reserve_doi ??
        `${this.baseUrl}/records/${id}/draft/pids/doi`,
      {
        headers: await this.headers({ "Content-Type": "application/json" }),
        method: "POST",
      },
    );
    const raw = await response.text().catch(() => "");
    let reserved: RdmRecord | null = null;
    try {
      reserved = JSON.parse(raw) as RdmRecord;
    } catch {
      // The refresh below can still recover a DOI from a non-JSON response.
    }
    const doi = extractRecordDoi(reserved);
    if (response.ok && doi) return doi;

    const refreshed = await this.get(`/records/${id}/draft`);
    if (refreshed.ok) {
      const refreshedDoi = extractRecordDoi(
        (await refreshed.json()) as RdmRecord,
      );
      if (refreshedDoi) return refreshedDoi;
    }
    if (response.ok) {
      throw new Error(
        `Zenodo reserved a DOI for record ${id} but returned no DOI`,
      );
    }
    throw new HttpError(
      `Failed to reserve a DOI for record ${id}: ${response.status} ${response.statusText}${raw ? ` - ${raw}` : ""}`,
      response.status,
    );
  }

  async updateMetadata(id: number, payload: object): Promise<RdmRecord> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/records/${id}/draft`,
      {
        body: JSON.stringify(payload),
        headers: await this.headers({ "Content-Type": "application/json" }),
        method: "PUT",
      },
    );
    if (!response.ok)
      throw await httpError(`update metadata for ${id}`, response);
    const record = (await response.json()) as RdmRecord;
    const errors = draftMetadataErrors(record);
    if (errors.length) {
      throw new Error(
        `Zenodo rejected the record metadata: ${errors.join("; ")}`,
      );
    }
    return record;
  }

  private async deleteDraftFile(id: number, filename: string) {
    const response = await this.fetchImpl(
      `${this.baseUrl}/records/${id}/draft/files/${encodeURIComponent(filename)}`,
      { headers: await this.headers(), method: "DELETE" },
    );
    if (!response.ok && response.status !== 404) {
      throw await httpError(`delete draft file ${filename}`, response);
    }
  }

  async uploadFile(
    id: number,
    rawFilename: string,
    source: UploadSource,
    { onBytes, onPhase, signal }: UploadOptions = {},
  ): Promise<void> {
    const filename = sanitizeZenodoFileKey(rawFilename);
    let lastError: unknown;
    for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
      signal?.throwIfAborted();
      try {
        if (attempt > 1) await this.deleteDraftFile(id, filename);
        await onPhase?.({ attempt, phase: "uploading" });
        const links = await this.initializeDraftFile(id, filename);

        // Streamed rather than buffered so large files don't sit in memory.
        let sent = 0;
        const body = (await source.open(signal)).pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
              sent += chunk.byteLength;
              onBytes?.(sent);
              controller.enqueue(chunk);
            },
          }),
        );
        const uploaded = await this.fetchImpl(links.content, {
          body,
          duplex: "half",
          headers: await this.headers({
            "Content-Length": String(source.size),
            "Content-Type": "application/octet-stream",
          }),
          method: "PUT",
          signal,
        } as RequestInit);
        if (!uploaded.ok) {
          throw await httpError(`upload draft file ${filename}`, uploaded);
        }
        const uploadedBody = (await uploaded.json().catch(() => null)) as {
          links?: { commit?: string };
        } | null;

        await onPhase?.({ attempt, phase: "committing" });
        const committed = await this.fetchImpl(
          uploadedBody?.links?.commit ?? links.commit,
          { headers: await this.headers(), method: "POST" },
        );
        if (!committed.ok) {
          throw await httpError(`commit draft file ${filename}`, committed);
        }
        return;
      } catch (error) {
        if (signal?.aborted) throw error;
        lastError = error;
      }
      if (attempt === UPLOAD_MAX_ATTEMPTS || !isRetryable(lastError)) break;
      await onPhase?.({
        attempt: attempt + 1,
        error: uploadFailure(filename, lastError),
        phase: "retrying",
      });
      await this.wait(attempt * 1000);
    }
    if (lastError instanceof HttpError) throw lastError;
    throw new Error(uploadFailure(filename, lastError), { cause: lastError });
  }

  private async initializeDraftFile(id: number, filename: string) {
    const response = await this.fetchImpl(
      `${this.baseUrl}/records/${id}/draft/files`,
      {
        body: JSON.stringify([{ key: filename }]),
        headers: await this.headers({ "Content-Type": "application/json" }),
        method: "POST",
      },
    );
    if (!response.ok) {
      throw await httpError(`initialize draft file ${filename}`, response);
    }
    const initialized = (await response.json()) as {
      entries?: Array<{
        key?: string;
        links?: { commit?: string; content?: string };
      }>;
    };
    const entry = initialized.entries?.find((item) => item.key === filename);
    if (!entry?.links?.content || !entry.links.commit) {
      throw new Error(
        `Zenodo did not return content and commit links for ${filename}`,
      );
    }
    return { commit: entry.links.commit, content: entry.links.content };
  }

  async publish(id: number): Promise<RdmPublishResult> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/records/${id}/draft/actions/publish`,
      {
        headers: await this.headers({ "Content-Type": "application/json" }),
        method: "POST",
      },
    );
    if (!response.ok) throw await httpError(`publish record ${id}`, response);
    const record = (await response.json()) as RdmRecord;
    const publishedId = recordId(record);
    if (publishedId === undefined)
      throw new Error(
        `Zenodo published record ${id} but returned no usable ID`,
      );
    const conceptId = Number(record.parent?.id ?? record.conceptrecid);
    return {
      recordId: publishedId,
      recordUrl:
        record.links?.self_html ??
        record.links?.record_html ??
        record.links?.latest_html ??
        "",
      ...(extractRecordDoi(record) && { doi: extractRecordDoi(record) }),
      ...(extractConceptDoi(record) && {
        conceptDoi: extractConceptDoi(record),
      }),
      ...(Number.isFinite(conceptId) && { conceptRecordId: conceptId }),
    };
  }

  async discardDraft(id: number): Promise<void> {
    const state = await this.resolveState(id);
    if (state.kind === "missing") return;
    if (state.kind === "published") {
      throw new Error(
        `Zenodo record ${id} is already published and cannot be discarded`,
      );
    }
    const response = await this.fetchImpl(
      `${this.baseUrl}/records/${id}/draft`,
      {
        headers: await this.headers(),
        method: "DELETE",
      },
    );
    if (!response.ok && response.status !== 404) {
      throw await httpError(`discard draft ${id}`, response);
    }
  }
}

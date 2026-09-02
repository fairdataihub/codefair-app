export const RDM_ACCEPT = "application/vnd.inveniordm.v1+json";

export interface RdmRecord {
  id?: number | string;
  conceptdoi?: string;
  conceptrecid?: number | string;
  doi?: string;
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

type FetchLike = typeof fetch;

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

async function responseError(operation: string, response: Response) {
  const body = await response.text().catch(() => "");
  return `${operation}: ${response.status} ${response.statusText}${body ? ` - ${body}` : ""}`;
}

function shouldRetry(message: string) {
  return /\b(500|502|503|504)\b|please try again|transfer failed/i.test(
    message,
  );
}

export class ZenodoRdmClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly token: string;
  private readonly wait: (milliseconds: number) => Promise<void>;

  constructor(
    baseUrl: string,
    token: string,
    fetchImpl: FetchLike = fetch,
    wait: (milliseconds: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
    this.token = token;
    this.wait = wait;
  }

  private headers(extra?: Record<string, string>) {
    return {
      Accept: RDM_ACCEPT,
      Authorization: `Bearer ${this.token}`,
      ...extra,
    };
  }

  private get(path: string) {
    return this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: this.headers(),
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
      { headers: this.headers() },
    );
    if (!response.ok)
      throw new Error(await responseError("listUserRecords", response));

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
      throw new Error(await responseError(`resolve record ${id}`, published));
    }

    const draft = await this.get(`/records/${id}/draft`);
    if (draft.ok)
      return { kind: "draft", record: (await draft.json()) as RdmRecord };
    if (draft.status === 404) return { kind: "missing" };
    throw new Error(await responseError(`resolve draft ${id}`, draft));
  }

  async createDraft(seed: object): Promise<RdmRecord> {
    const response = await this.fetchImpl(`${this.baseUrl}/records`, {
      body: JSON.stringify(seed),
      headers: this.headers({ "Content-Type": "application/json" }),
      method: "POST",
    });
    if (!response.ok)
      throw new Error(await responseError("create draft", response));
    return (await response.json()) as RdmRecord;
  }

  async createVersion(id: number): Promise<RdmRecord> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/records/${id}/versions`,
      {
        headers: this.headers({ "Content-Type": "application/json" }),
        method: "POST",
      },
    );
    if (!response.ok)
      throw new Error(await responseError(`create version ${id}`, response));
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
      throw new Error(
        await responseError(`list files for draft ${id}`, listing),
      );
    const body = (await listing.json()) as {
      entries?: Array<{ key?: string }>;
    };
    for (const entry of body.entries ?? []) {
      if (!entry.key) continue;
      const response = await this.fetchImpl(
        `${this.baseUrl}/records/${id}/draft/files/${encodeURIComponent(entry.key)}`,
        { headers: this.headers(), method: "DELETE" },
      );
      if (!response.ok && response.status !== 404) {
        throw new Error(
          await responseError(`delete draft file ${entry.key}`, response),
        );
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
        headers: this.headers({ "Content-Type": "application/json" }),
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
    throw new Error(
      response.ok
        ? `Zenodo reserved a DOI for record ${id} but returned no DOI`
        : `Failed to reserve a DOI for record ${id}: ${response.status} ${response.statusText}${raw ? ` - ${raw}` : ""}`,
    );
  }

  async updateMetadata(id: number, payload: object): Promise<RdmRecord> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/records/${id}/draft`,
      {
        body: JSON.stringify(payload),
        headers: this.headers({ "Content-Type": "application/json" }),
        method: "PUT",
      },
    );
    if (!response.ok)
      throw new Error(
        await responseError(`update metadata for ${id}`, response),
      );
    return (await response.json()) as RdmRecord;
  }

  private async deleteDraftFile(id: number, filename: string) {
    const response = await this.fetchImpl(
      `${this.baseUrl}/records/${id}/draft/files/${encodeURIComponent(filename)}`,
      { headers: this.headers(), method: "DELETE" },
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(
        await responseError(`delete draft file ${filename}`, response),
      );
    }
  }

  async uploadFile(
    id: number,
    rawFilename: string,
    content: ArrayBuffer,
  ): Promise<void> {
    const filename = sanitizeZenodoFileKey(rawFilename);
    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        if (attempt > 1) await this.deleteDraftFile(id, filename);
        const initialize = await this.fetchImpl(
          `${this.baseUrl}/records/${id}/draft/files`,
          {
            body: JSON.stringify([{ key: filename }]),
            headers: this.headers({ "Content-Type": "application/json" }),
            method: "POST",
          },
        );
        if (!initialize.ok) {
          lastError = await responseError(
            `initialize draft file ${filename}`,
            initialize,
          );
        } else {
          const initialized = (await initialize.json()) as {
            entries?: Array<{
              key?: string;
              links?: { commit?: string; content?: string };
            }>;
          };
          const entry = initialized.entries?.find(
            (item) => item.key === filename,
          );
          if (!entry?.links?.content || !entry.links.commit) {
            lastError = `Zenodo did not return content and commit links for ${filename}`;
          } else {
            const uploaded = await this.fetchImpl(entry.links.content, {
              body: content,
              headers: this.headers({
                "Content-Length": String(content.byteLength),
                "Content-Type": "application/octet-stream",
              }),
              method: "PUT",
            });
            if (!uploaded.ok) {
              lastError = await responseError(
                `upload draft file ${filename}`,
                uploaded,
              );
            } else {
              const uploadedBody = (await uploaded
                .json()
                .catch(() => null)) as {
                links?: { commit?: string };
              } | null;
              const committed = await this.fetchImpl(
                uploadedBody?.links?.commit ?? entry.links.commit,
                { headers: this.headers(), method: "POST" },
              );
              if (committed.ok) return;
              lastError = await responseError(
                `commit draft file ${filename}`,
                committed,
              );
            }
          }
        }
      } catch (error) {
        lastError = `File upload transfer failed for ${filename}: ${
          (error as Error).message
        }`;
      }
      if (attempt === 3 || !shouldRetry(lastError)) break;
      await this.wait(attempt * 1000);
    }
    throw new Error(lastError || `Failed to upload ${filename}`);
  }

  async publish(id: number): Promise<RdmPublishResult> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/records/${id}/draft/actions/publish`,
      {
        headers: this.headers({ "Content-Type": "application/json" }),
        method: "POST",
      },
    );
    if (!response.ok)
      throw new Error(await responseError(`publish record ${id}`, response));
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
        headers: this.headers(),
        method: "DELETE",
      },
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(await responseError(`discard draft ${id}`, response));
    }
  }
}

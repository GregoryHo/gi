export interface SaveFetchedContentInput {
  url: string;
  finalUrl: string;
  title: string;
  contentType: string;
  content: string;
}

export interface StoredFetchedContent extends SaveFetchedContentInput {
  responseId: string;
}

export interface GetFetchedContentChunkInput {
  responseId: string;
  offset?: number;
  limit?: number;
}

export interface FetchedContentChunk extends StoredFetchedContent {
  content: string;
  offset: number;
  limit: number;
  charCount: number;
  fullCharCount: number;
  nextOffset: number | null;
  truncated: boolean;
}

export interface FetchedContentStore {
  save(input: SaveFetchedContentInput): StoredFetchedContent;
  getChunk(input: GetFetchedContentChunkInput): FetchedContentChunk;
}

const DEFAULT_LIMIT = 12_000;
const MAX_LIMIT = 20_000;

export function createFetchedContentStore(): FetchedContentStore {
  let nextResponseNumber = 1;
  const entries = new Map<string, StoredFetchedContent>();

  return {
    save(input) {
      const responseId = `fc_${nextResponseNumber++}`;
      const stored = { responseId, ...input };
      entries.set(responseId, stored);
      return stored;
    },

    getChunk(input) {
      const stored = entries.get(input.responseId);
      if (!stored) throw new Error(`Unknown fetch_content responseId: ${input.responseId}`);

      const offset = normalizeOffset(input.offset);
      const limit = normalizeLimit(input.limit);
      const content = stored.content.slice(offset, offset + limit);
      const fullCharCount = stored.content.length;
      const nextOffset = offset + content.length < fullCharCount ? offset + content.length : null;

      return {
        ...stored,
        content,
        offset,
        limit,
        charCount: content.length,
        fullCharCount,
        nextOffset,
        truncated: nextOffset !== null,
      };
    },
  };
}

function normalizeOffset(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(Math.floor(value), MAX_LIMIT));
}

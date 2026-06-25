import type { SearchSource } from "./results.ts";

export interface StoredSearchSource extends SearchSource {
  id: string;
}

export interface StoredSearchResponse {
  responseId: string;
  query: string;
  sources: StoredSearchSource[];
}

export interface SaveSearchInput {
  query: string;
  sources: SearchSource[];
}

export interface ResolveSearchResultInput {
  responseId: string;
  resultId?: string;
  index?: number;
}

export interface SearchResultStore {
  save(input: SaveSearchInput): StoredSearchResponse;
  resolve(input: ResolveSearchResultInput): StoredSearchSource;
}

export function createSearchResultStore(): SearchResultStore {
  let nextResponseNumber = 1;
  const responses = new Map<string, StoredSearchResponse>();

  return {
    save(input) {
      const responseId = `ws_${nextResponseNumber++}`;
      const sources = input.sources.map((source, index) => ({
        ...source,
        id: `r${index + 1}`,
      }));
      const stored = { responseId, query: input.query, sources };
      responses.set(responseId, stored);
      return stored;
    },

    resolve(input) {
      const stored = responses.get(input.responseId);
      if (!stored) throw new Error(`Unknown web_search responseId: ${input.responseId}`);

      if (input.resultId) {
        const source = stored.sources.find((candidate) => candidate.id === input.resultId);
        if (!source) throw new Error(`Unknown web_search resultId: ${input.resultId}`);
        return source;
      }

      if (typeof input.index === "number" && Number.isFinite(input.index)) {
        const source = stored.sources[Math.floor(input.index) - 1];
        if (!source) throw new Error(`Unknown web_search result index: ${input.index}`);
        return source;
      }

      throw new Error("fetch_content with responseId requires resultId or index.");
    },
  };
}

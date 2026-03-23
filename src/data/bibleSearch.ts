import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { BibleSearchResult } from './bibleText';
import { searchIndexedBibleText } from './bibleSearchIndex';
import { createSearchMatcher, normalizeSearchText } from '../utils/searchText';

export type BibleSearchSource = 'supabase' | 'local';
const SEARCH_CACHE_LIMIT = 24;

type BibleSearchResponse = {
  results: BibleSearchResult[];
  source: BibleSearchSource;
};

type SearchBibleVersesRow = {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  rank?: number;
};

const searchCache = new Map<string, BibleSearchResponse>();
const pendingSearches = new Map<string, Promise<BibleSearchResponse>>();

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === 'AbortError'
    : typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as { name?: string }).name === 'AbortError';

const getCacheKey = (query: string, limit: number) => `${query.trim().toLowerCase()}::${limit}`;

const splitCacheKey = (key: string) => {
  const separatorIndex = key.lastIndexOf('::');
  if (separatorIndex < 0) {
    return { query: key, limit: Number.NaN };
  }

  return {
    query: key.slice(0, separatorIndex),
    limit: Number(key.slice(separatorIndex + 2)),
  };
};

const readCachedResult = (key: string) => {
  const cached = searchCache.get(key);
  if (!cached) return null;

  searchCache.delete(key);
  searchCache.set(key, cached);
  return cached;
};

const writeCachedResult = (key: string, value: BibleSearchResponse) => {
  if (searchCache.has(key)) {
    searchCache.delete(key);
  }

  searchCache.set(key, value);
  if (searchCache.size <= SEARCH_CACHE_LIMIT) return;

  const oldestKey = searchCache.keys().next().value;
  if (oldestKey) {
    searchCache.delete(oldestKey);
  }
};

const mapSupabaseRows = (rows: SearchBibleVersesRow[]): BibleSearchResult[] =>
  rows.map((row) => ({
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
    score: row.rank ?? 0,
  }));

export const getInstantBibleSearchPreview = (
  query: string,
  limit: number = 80
): BibleSearchResponse | null => {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 3) return null;

  const exactKey = getCacheKey(query, limit);
  const exact = readCachedResult(exactKey);
  if (exact) {
    return exact;
  }

  let bestPrefixMatch: { query: string; response: BibleSearchResponse } | null = null;
  for (const [cacheKey, response] of searchCache.entries()) {
    const parsed = splitCacheKey(cacheKey);
    if (parsed.limit !== limit || !parsed.query) continue;
    if (!normalizedQuery.startsWith(parsed.query) || parsed.query === normalizedQuery) continue;

    if (!bestPrefixMatch || parsed.query.length > bestPrefixMatch.query.length) {
      bestPrefixMatch = { query: parsed.query, response };
    }
  }

  if (!bestPrefixMatch) return null;

  const matcher = createSearchMatcher(normalizedQuery);
  const rescored = bestPrefixMatch.response.results
    .map((result) => ({
      ...result,
      score: matcher.scoreText(
        `${result.book} ${result.chapter}:${result.verse}`,
        result.text
      ),
    }))
    .filter((result) => (result.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);

  if (rescored.length === 0) return null;

  return {
    results: rescored,
    source: bestPrefixMatch.response.source,
  };
};

export const searchBibleText = async (
  query: string,
  limit: number = 80,
  signal?: AbortSignal
): Promise<BibleSearchResponse> => {
  const key = getCacheKey(query, limit);
  const cached = readCachedResult(key);
  if (cached) {
    return cached;
  }

  const pending = pendingSearches.get(key);
  if (pending) {
    return pending;
  }

  const request = (async (): Promise<BibleSearchResponse> => {
    if (!isSupabaseConfigured) {
      const response = {
        results: await searchIndexedBibleText(query, limit, signal),
        source: 'local' as const,
      };
      writeCachedResult(key, response);
      return response;
    }

    try {
      const queryBuilder = supabase
        .rpc('search_bible_verses', {
          query_text: query,
          translation_filter: 'BSB',
          match_count: limit,
        })
        .abortSignal(signal ?? new AbortController().signal);

      const { data, error } = await queryBuilder;

      if (error) throw error;

      const response = {
        results: mapSupabaseRows(Array.isArray(data) ? data : []),
        source: 'supabase' as const,
      };
      writeCachedResult(key, response);
      return response;
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      console.warn('Falling back to local Bible search:', error);
      const response = {
        results: await searchIndexedBibleText(query, limit, signal),
        source: 'local' as const,
      };
      writeCachedResult(key, response);
      return response;
    } finally {
      pendingSearches.delete(key);
    }
  })();

  pendingSearches.set(key, request);
  return request;
};

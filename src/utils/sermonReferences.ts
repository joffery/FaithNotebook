import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { createSearchMatcher } from './searchText';
import { parseVerseReference } from './verseParser';

type VerseInsightLike = {
  verse?: string;
  insight?: string;
};

export type SermonReferenceIndex = {
  books: Set<string>;
  chapters: Set<string>;
  versesByChapter: Map<string, Set<number>>;
  searchableInsights: SermonSearchSuggestion[];
};

export type SermonSearchSuggestion = {
  book: string;
  chapter: number;
  verse: number;
  referenceLabel: string;
  insight: string;
  sermonTitle: string;
  supportingCount: number;
  score?: number;
  searchContext?: string[];
};

const emptyIndex = (): SermonReferenceIndex => ({
  books: new Set<string>(),
  chapters: new Set<string>(),
  versesByChapter: new Map<string, Set<number>>(),
  searchableInsights: [],
});

let referenceIndexCache: SermonReferenceIndex | null = null;
let referenceIndexPromise: Promise<SermonReferenceIndex> | null = null;

export const parseSermonVerseInsights = (value: unknown): VerseInsightLike[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const hasUsableInsight = (insight: VerseInsightLike) =>
  typeof insight?.verse === 'string' &&
  insight.verse.trim().length > 0 &&
  typeof insight?.insight === 'string' &&
  insight.insight.trim().length > 0;

export const parseSermonVerseRefs = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
};

const parseStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }

  return [];
};

const addVerseRefToIndex = (index: SermonReferenceIndex, ref: string) => {
  const parsedVerses = parseVerseReference(ref);
  if (parsedVerses.length === 0) return;

  const { book, chapter } = parsedVerses[0];
  const chapterKey = `${book} ${chapter}`;

  index.books.add(book);
  index.chapters.add(chapterKey);

  if (!index.versesByChapter.has(chapterKey)) {
    index.versesByChapter.set(chapterKey, new Set<number>());
  }

  const verseSet = index.versesByChapter.get(chapterKey)!;
  parsedVerses.forEach(({ verse }) => verseSet.add(verse));
};

export async function getSermonReferenceIndex(): Promise<SermonReferenceIndex> {
  if (referenceIndexCache) return referenceIndexCache;
  if (referenceIndexPromise) return referenceIndexPromise;
  if (!isSupabaseConfigured) return emptyIndex();

  referenceIndexPromise = (async () => {
    const index = emptyIndex();
    const { data, error } = await supabase
      .from('sermons')
      .select('title, summary, tags, verses, verse_insights');

    if (error) {
      console.error('Error loading sermon reference index:', error);
      referenceIndexCache = index;
      return index;
    }

    const dedupedSuggestions = new Map<string, SermonSearchSuggestion & { scoreSeed: number }>();

    for (const row of data || []) {
      const sermonTitle = typeof (row as any).title === 'string' ? (row as any).title.trim() : '';
      const sermonSummary = typeof (row as any).summary === 'string' ? (row as any).summary.trim() : '';
      const sermonTags = parseStringList((row as any).tags);
      const insights = parseSermonVerseInsights((row as any).verse_insights).filter(hasUsableInsight);

      insights.forEach((insight) => {
        const ref = insight.verse!.trim();
        addVerseRefToIndex(index, ref);

        const parsedVerses = parseVerseReference(ref);
        if (parsedVerses.length === 0) return;

        const first = parsedVerses[0];
        const key = `${ref.toLowerCase()}::${insight.insight!.trim().toLowerCase()}`;
        const scoreSeed = [
          sermonTitle.length > 0 ? 1 : 0,
          sermonSummary.length > 0 ? 1 : 0,
          sermonTags.length,
        ].reduce((sum, value) => sum + value, 0);
        const existing = dedupedSuggestions.get(key);

        if (existing) {
          existing.supportingCount += 1;
          existing.scoreSeed = Math.max(existing.scoreSeed, scoreSeed);
          existing.searchContext = Array.from(new Set([
            ...(existing.searchContext || []),
            sermonSummary,
            ...sermonTags,
          ].filter(Boolean)));
          return;
        }

        dedupedSuggestions.set(key, {
          book: first.book,
          chapter: first.chapter,
          verse: first.verse,
          referenceLabel: ref,
          insight: insight.insight!.trim(),
          sermonTitle,
          supportingCount: 1,
          scoreSeed,
          searchContext: uniqueStrings([sermonSummary, ...sermonTags]),
        });
      });
    }

    index.searchableInsights = Array.from(dedupedSuggestions.values())
      .sort((a, b) => b.scoreSeed - a.scoreSeed || b.supportingCount - a.supportingCount)
      .map(({ scoreSeed: _scoreSeed, ...suggestion }) => suggestion);
    referenceIndexCache = index;
    return index;
  })();

  return referenceIndexPromise;
}

export const hasBookSermons = (index: SermonReferenceIndex | null, book: string) =>
  !!index?.books.has(book);

export const hasChapterSermons = (index: SermonReferenceIndex | null, book: string, chapter: number) =>
  !!index?.chapters.has(`${book} ${chapter}`);

export const getVerseNumbersForChapter = (index: SermonReferenceIndex | null, book: string, chapter: number) =>
  index?.versesByChapter.get(`${book} ${chapter}`) || new Set<number>();

export const searchSermonVerseSuggestions = (
  index: SermonReferenceIndex | null,
  query: string,
  limit: number = 8
): SermonSearchSuggestion[] => {
  if (!index) return [];

  const matcher = createSearchMatcher(query);
  if (!matcher.hasQuery) return [];

  const suggestionsByReference = new Map<string, SermonSearchSuggestion & { score: number; order: number }>();

  index.searchableInsights.forEach((suggestion, order) => {
    const score = matcher.scoreText(
      suggestion.referenceLabel,
      suggestion.insight,
      suggestion.sermonTitle,
      ...(suggestion.searchContext || [])
    );
    if (score <= 0) return;

    const key = suggestion.referenceLabel.toLowerCase();
    const existing = suggestionsByReference.get(key);
    if (!existing) {
      suggestionsByReference.set(key, {
        ...suggestion,
        score,
        order,
      });
      return;
    }

    existing.supportingCount += suggestion.supportingCount;
    if (score > existing.score) {
      suggestionsByReference.set(key, {
        ...suggestion,
        supportingCount: existing.supportingCount,
        score,
        order,
      });
    }
  });

  return Array.from(suggestionsByReference.values())
    .sort((a, b) => b.score - a.score || b.supportingCount - a.supportingCount || a.order - b.order)
    .slice(0, limit)
    .map(({ order: _order, ...suggestion }) => suggestion);
};

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter((value) => value && value.trim().length > 0)));

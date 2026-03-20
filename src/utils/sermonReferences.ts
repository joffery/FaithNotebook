import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { parseVerseReference } from './verseParser';

type VerseInsightLike = {
  verse?: string;
  insight?: string;
};

export type SermonReferenceIndex = {
  books: Set<string>;
  chapters: Set<string>;
  versesByChapter: Map<string, Set<number>>;
};

const emptyIndex = (): SermonReferenceIndex => ({
  books: new Set<string>(),
  chapters: new Set<string>(),
  versesByChapter: new Map<string, Set<number>>(),
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
      .select('verses, verse_insights');

    if (error) {
      console.error('Error loading sermon reference index:', error);
      referenceIndexCache = index;
      return index;
    }

    for (const row of data || []) {
      const refs = parseSermonVerseInsights((row as any).verse_insights)
        .filter(hasUsableInsight)
        .map((insight) => insight.verse)
        .filter((ref): ref is string => typeof ref === 'string' && ref.trim().length > 0);

      refs.forEach((ref) => addVerseRefToIndex(index, ref));
    }

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

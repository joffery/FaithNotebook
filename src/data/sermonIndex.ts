import sermons from './sermons_processed.json';
import { bibleBooks } from './bibleBooks';
import { parseVerseReference } from '../utils/verseParser';

type SermonLocation = {
  book: string;
  chapter: number;
  verse: number;
};

const chapterKey = (book: string, chapter: number) => `${book}::${chapter}`;

const chaptersByBook = new Map<string, Set<number>>();
const versesByChapter = new Map<string, Set<number>>();

(sermons as any[]).forEach((sermon: any) => {
  (sermon.verse_insights || []).forEach((insight: any) => {
    const parsed = parseVerseReference(insight.verse || '');
    parsed.forEach((v) => {
      if (!chaptersByBook.has(v.book)) {
        chaptersByBook.set(v.book, new Set<number>());
      }
      chaptersByBook.get(v.book)!.add(v.chapter);

      const key = chapterKey(v.book, v.chapter);
      if (!versesByChapter.has(key)) {
        versesByChapter.set(key, new Set<number>());
      }
      versesByChapter.get(key)!.add(v.verse);
    });
  });
});

export function hasSermonInBook(book: string): boolean {
  return (chaptersByBook.get(book)?.size || 0) > 0;
}

export function hasSermonInChapter(book: string, chapter: number): boolean {
  return (chaptersByBook.get(book)?.has(chapter)) || false;
}

export function getFirstSermonChapterForBook(book: string): number | null {
  const chapters = chaptersByBook.get(book);
  if (!chapters || chapters.size === 0) return null;
  return Math.min(...Array.from(chapters));
}

export function getInsightVersesForChapter(book: string, chapter: number): Set<number> {
  return new Set(versesByChapter.get(chapterKey(book, chapter)) || []);
}

export function getFirstSermonLocation(): SermonLocation | null {
  for (const bookMeta of bibleBooks) {
    const firstChapter = getFirstSermonChapterForBook(bookMeta.name);
    if (firstChapter !== null) {
      const verses = Array.from(getInsightVersesForChapter(bookMeta.name, firstChapter));
      const firstVerse = verses.length > 0 ? Math.min(...verses) : 1;
      return { book: bookMeta.name, chapter: firstChapter, verse: firstVerse };
    }
  }

  return null;
}

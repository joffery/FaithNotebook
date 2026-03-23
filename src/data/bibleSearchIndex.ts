import { bibleBooks } from './bibleBooks';
import {
  BibleChapter,
  BibleSearchResult,
  fetchBibleChapterFromApi,
  getAvailableBibleChapters,
} from './bibleText';
import { createSearchMatcher } from '../utils/searchText';

const DB_NAME = 'faith-notebook-bible-search';
const DB_VERSION = 1;
const CHAPTER_STORE = 'chapters';
const TOTAL_CHAPTERS = bibleBooks.reduce((sum, book) => sum + book.chapters, 0);

type IndexedChapterRecord = {
  key: string;
  chapter: BibleChapter;
  updatedAt: number;
};

export type BibleSearchIndexStatus = {
  indexedChapters: number;
  totalChapters: number;
  isComplete: boolean;
  isSyncing: boolean;
};

let dbPromise: Promise<IDBDatabase> | null = null;
let syncPromise: Promise<void> | null = null;
let syncInProgress = false;
let memoryIndexedChapters = new Map<string, BibleChapter>();
let cachedAllIndexedChapters: BibleChapter[] | null = null;
const statusListeners = new Set<(status: BibleSearchIndexStatus) => void>();

const chapterKey = (book: string, chapter: number) => `${book}-${chapter}`;

const promisifyRequest = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const openDatabase = async (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHAPTER_STORE)) {
        db.createObjectStore(CHAPTER_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const readAllIndexedRecords = async (): Promise<IndexedChapterRecord[]> => {
  if (typeof window === 'undefined' || !window.indexedDB) return [];

  const db = await openDatabase();
  const tx = db.transaction(CHAPTER_STORE, 'readonly');
  const store = tx.objectStore(CHAPTER_STORE);
  const records = await promisifyRequest(store.getAll() as IDBRequest<IndexedChapterRecord[]>);
  return Array.isArray(records) ? records : [];
};

const putIndexedChapter = async (chapter: BibleChapter) => {
  if (typeof window === 'undefined' || !window.indexedDB) return;

  const db = await openDatabase();
  const tx = db.transaction(CHAPTER_STORE, 'readwrite');
  const store = tx.objectStore(CHAPTER_STORE);
  const key = chapterKey(chapter.book, chapter.chapter);
  const record: IndexedChapterRecord = {
    key,
    chapter,
    updatedAt: Date.now(),
  };

  await promisifyRequest(store.put(record));
  memoryIndexedChapters.set(key, chapter);
  cachedAllIndexedChapters = null;
};

const getIndexedChapterCount = async () => {
  if (typeof window === 'undefined' || !window.indexedDB) return 0;

  const db = await openDatabase();
  const tx = db.transaction(CHAPTER_STORE, 'readonly');
  const store = tx.objectStore(CHAPTER_STORE);
  return await promisifyRequest(store.count());
};

const getIndexedChapterKeys = async (): Promise<Set<string>> => {
  const records = await readAllIndexedRecords();
  const keys = new Set<string>();

  records.forEach((record) => {
    if (!record?.chapter) return;
    keys.add(record.key);
    memoryIndexedChapters.set(record.key, record.chapter);
  });

  return keys;
};

const notifyStatusListeners = async () => {
  const status = await getBibleSearchIndexStatus();
  statusListeners.forEach((listener) => listener(status));
};

export const subscribeBibleSearchIndexStatus = (
  listener: (status: BibleSearchIndexStatus) => void
) => {
  statusListeners.add(listener);
  void notifyStatusListeners();

  return () => {
    statusListeners.delete(listener);
  };
};

export const getBibleSearchIndexStatus = async (): Promise<BibleSearchIndexStatus> => {
  const indexedChapters = await getIndexedChapterCount();
  return {
    indexedChapters,
    totalChapters: TOTAL_CHAPTERS,
    isComplete: indexedChapters >= TOTAL_CHAPTERS,
    isSyncing: syncInProgress,
  };
};

const getAllIndexedBibleChapters = async (): Promise<BibleChapter[]> => {
  if (cachedAllIndexedChapters) return cachedAllIndexedChapters;

  const records = await readAllIndexedRecords();
  records.forEach((record) => {
    if (record?.chapter) {
      memoryIndexedChapters.set(record.key, record.chapter);
    }
  });

  cachedAllIndexedChapters = Array.from(memoryIndexedChapters.values());
  return cachedAllIndexedChapters;
};

const getAllSearchableBibleChapters = async (): Promise<BibleChapter[]> => {
  const chapterMap = new Map<string, BibleChapter>();

  getAvailableBibleChapters().forEach((chapter) => {
    chapterMap.set(chapterKey(chapter.book, chapter.chapter), chapter);
  });

  const indexed = await getAllIndexedBibleChapters();
  indexed.forEach((chapter) => {
    chapterMap.set(chapterKey(chapter.book, chapter.chapter), chapter);
  });

  return Array.from(chapterMap.values());
};

export const startBibleSearchIndexSync = async (): Promise<void> => {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    syncInProgress = true;
    await notifyStatusListeners();

    try {
      const existingKeys = await getIndexedChapterKeys();
      let completedSinceLastNotify = 0;

      for (const book of bibleBooks) {
        for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
          const key = chapterKey(book.name, chapter);
          if (existingKeys.has(key)) continue;

          const chapterData = await fetchBibleChapterFromApi(book.name, chapter);
          if (chapterData) {
            await putIndexedChapter(chapterData);
          }

          completedSinceLastNotify += 1;
          if (completedSinceLastNotify >= 10) {
            completedSinceLastNotify = 0;
            await notifyStatusListeners();
          }
        }
      }
    } finally {
      syncInProgress = false;
      syncPromise = null;
      await notifyStatusListeners();
    }
  })();

  return syncPromise;
};

export const searchIndexedBibleText = async (
  query: string,
  limit: number = 80,
  signal?: AbortSignal
): Promise<BibleSearchResult[]> => {
  const matcher = createSearchMatcher(query);
  if (!matcher.hasQuery) return [];

  const results: Array<BibleSearchResult & { score: number; order: number }> = [];
  let order = 0;
  const chapters = await getAllSearchableBibleChapters();

  for (const chapterData of chapters) {
    if (signal?.aborted) {
      throw new DOMException('Bible search aborted', 'AbortError');
    }

    for (const verse of chapterData.verses) {
      const reference = `${chapterData.book} ${chapterData.chapter}:${verse.verse}`;
      const score = matcher.scoreText(reference, verse.text);
      if (score <= 0) continue;

      results.push({
        book: chapterData.book,
        chapter: chapterData.chapter,
        verse: verse.verse,
        text: verse.text,
        score,
        order: order += 1,
      });
    }
  }

  return results
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ order: _order, ...result }) => result);
};

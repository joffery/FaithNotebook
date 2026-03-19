import { useState, useEffect } from 'react';
import { getBibleChapter, ensureBibleChapter, BibleChapter } from '../data/bibleText';
import { VersePanel } from './VersePanel';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Module-level cache: "Book Chapter" → Set of verse numbers with sermon data
const sermonVerseCache = new Map<string, Set<number>>();

function parseVerseNums(ref: string, book: string, chapter: number): number[] {
  // ref like "John 3:16" or "John 3:16-18"
  const prefix = `${book} ${chapter}:`;
  if (!ref.startsWith(prefix)) return [];
  const after = ref.slice(prefix.length).split('-');
  const start = parseInt(after[0]);
  if (isNaN(start)) return [];
  if (after.length > 1) {
    const end = parseInt(after[1]);
    if (!isNaN(end)) return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }
  return [start];
}

type BibleReaderProps = {
  book: string;
  chapter: number;
};

export function BibleReader({ book, chapter }: BibleReaderProps) {
  const [chapterData, setChapterData] = useState<BibleChapter | null>(null);
  const [loadingChapter, setLoadingChapter] = useState<boolean>(false);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [versesWithSermons, setVersesWithSermons] = useState<Set<number>>(new Set());

  useEffect(() => {
    let mounted = true;
    setSelectedVerse(null);

    async function loadChapter() {
      setLoadingChapter(true);
      if (mounted) setChapterData(null);

      let data = getBibleChapter(book, chapter);
      if (!data) {
        const fetched = await ensureBibleChapter(book, chapter, false);
        data = fetched || data;
      }
      if (mounted) setChapterData(data);
      if (mounted) setLoadingChapter(false);
    }

    async function loadVerseDots() {
      if (!isSupabaseConfigured) return;
      const cacheKey = `${book} ${chapter}`;
      if (sermonVerseCache.has(cacheKey)) {
        if (mounted) setVersesWithSermons(sermonVerseCache.get(cacheKey)!);
        return;
      }
      const { data } = await supabase
        .from('sermons')
        .select('verses')
        .filter('verses::text', 'ilike', `%${book} ${chapter}:%`);
      const nums = new Set<number>();
      for (const row of (data || [])) {
        for (const ref of (row.verses || [])) {
          for (const n of parseVerseNums(ref, book, chapter)) nums.add(n);
        }
      }
      sermonVerseCache.set(cacheKey, nums);
      if (mounted) setVersesWithSermons(nums);
    }

    loadChapter();
    loadVerseDots();
    return () => { mounted = false; };
  }, [book, chapter]);

  if (!chapterData) {
    return (
      <div className="flex items-center justify-center h-64">
        {loadingChapter ? (
          <p className="text-[#2c1810]/60 font-serif">Loading chapter...</p>
        ) : (
          <p className="text-[#2c1810]/60 font-serif">
            Verse text not available for this chapter.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-serif text-[#2c1810] mb-8 text-center">
          {book} {chapter}
        </h2>

        <div className="space-y-4">
          {chapterData.verses.map((v) => (
            <div
              key={v.verse}
              onClick={() => setSelectedVerse(v.verse)}
              className="group cursor-pointer hover:bg-white/40 rounded-lg p-4 transition-all duration-200"
            >
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <span className="inline-flex items-center justify-center w-8 h-8 text-sm font-semibold text-[#c49a5c] group-hover:text-[#2c1810] transition-colors">
                    {v.verse}
                  </span>
                  {versesWithSermons.has(v.verse) && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#c49a5c] rounded-full shadow-sm" />
                  )}
                </div>
                <p className="text-lg leading-relaxed text-[#2c1810] font-serif flex-1">
                  {v.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedVerse !== null && (
        <VersePanel
          book={book}
          chapter={chapter}
          verse={selectedVerse}
          onClose={() => setSelectedVerse(null)}
        />
      )}
    </>
  );
}

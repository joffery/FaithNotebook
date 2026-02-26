import { useState, useEffect } from 'react';
import { getBibleChapter, ensureBibleChapter, BibleChapter } from '../data/bibleText';
import { VersePanel } from './VersePanel';
import { getInsightVersesForChapter, hasSermonInChapter } from '../data/sermonIndex';

type BibleReaderProps = {
  book: string;
  chapter: number;
};

export function BibleReader({ book, chapter }: BibleReaderProps) {
  const [chapterData, setChapterData] = useState<BibleChapter | null>(null);
  const [loadingChapter, setLoadingChapter] = useState<boolean>(false);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [versesWithInsights, setVersesWithInsights] = useState<Set<number>>(new Set());

  useEffect(() => {
    let mounted = true;
    setSelectedVerse(null);
    setVersesWithInsights(getInsightVersesForChapter(book, chapter));

    async function loadChapter() {
      setLoadingChapter(true);
      if (mounted) setChapterData(null);
      const sermonChapter = hasSermonInChapter(book, chapter);

      // try cache first, then fetch if missing
      let data = getBibleChapter(book, chapter);
      if (!data || sermonChapter) {
        const fetched = await ensureBibleChapter(book, chapter, sermonChapter);
        data = fetched || data;
      }
      if (mounted) setChapterData(data);

      if (mounted) setLoadingChapter(false);
    }

    loadChapter();
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
                  {versesWithInsights.has(v.verse) && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#c49a5c] rounded-full shadow-sm"></span>
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

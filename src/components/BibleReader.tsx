import { useState, useEffect } from 'react';
import { getBibleChapter, BibleChapter } from '../data/bibleText';
import { VersePanel } from './VersePanel';
import sermons from '../data/sermons_processed.json';
import { parseVerseReference } from '../utils/verseParser';

type BibleReaderProps = {
  book: string;
  chapter: number;
};

export function BibleReader({ book, chapter }: BibleReaderProps) {
  const [chapterData, setChapterData] = useState<BibleChapter | null>(null);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [versesWithInsights, setVersesWithInsights] = useState<Set<number>>(new Set());

  useEffect(() => {
    const data = getBibleChapter(book, chapter);
    setChapterData(data);

    const insightVerses = new Set<number>();
    sermons.forEach((sermon: any) => {
      sermon.verse_insights.forEach((vi: any) => {
        const parsedVerses = parseVerseReference(vi.verse);
        parsedVerses.forEach(parsed => {
          if (parsed.book === book && parsed.chapter === chapter) {
            insightVerses.add(parsed.verse);
          }
        });
      });
    });
    setVersesWithInsights(insightVerses);
  }, [book, chapter]);

  if (!chapterData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#2c1810]/60 font-serif">
          Chapter not available yet. Please select Matthew 6 to see sample content.
        </p>
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

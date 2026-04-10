import { useState, useEffect } from 'react';
import { getBibleChapter, ensureBibleChapter, getBibleTranslationLabel, BibleChapter } from '../data/bibleText';
import { VersePanel } from './VersePanel';
import { getSermonReferenceIndex, getVerseNumbersForChapter } from '../utils/sermonReferences';

const VERSE_HISTORY_KEY = 'faithNotebookVerse';

type BibleReaderProps = {
  book: string;
  chapter: number;
  selectedVerseFromApp?: number | null;
  onSelectedVerseHandled?: () => void;
};

export function BibleReader({ book, chapter, selectedVerseFromApp = null, onSelectedVerseHandled }: BibleReaderProps) {
  const [chapterData, setChapterData] = useState<BibleChapter | null>(null);
  const [loadingChapter, setLoadingChapter] = useState<boolean>(false);
  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [versesWithSermons, setVersesWithSermons] = useState<Set<number>>(new Set());
  const translationLabel = getBibleTranslationLabel();

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
      const index = await getSermonReferenceIndex();
      if (mounted) setVersesWithSermons(new Set(getVerseNumbersForChapter(index, book, chapter)));
    }

    loadChapter();
    loadVerseDots();
    return () => { mounted = false; };
  }, [book, chapter]);

  useEffect(() => {
    if (selectedVerseFromApp === null) return;
    setSelectedVerse(selectedVerseFromApp);
    onSelectedVerseHandled?.();
  }, [selectedVerseFromApp, onSelectedVerseHandled]);

  useEffect(() => {
    if (typeof window === 'undefined' || selectedVerse === null) return;

    const historyValue = `${book}:${chapter}:${selectedVerse}`;
    if (window.history.state?.[VERSE_HISTORY_KEY] === historyValue) return;

    window.history.pushState(
      {
        ...(window.history.state || {}),
        [VERSE_HISTORY_KEY]: historyValue,
      },
      ''
    );
  }, [book, chapter, selectedVerse]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      if (selectedVerse !== null) {
        setSelectedVerse(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedVerse]);

  const closeSelectedVerse = () => {
    if (
      typeof window !== 'undefined' &&
      selectedVerse !== null &&
      window.history.state?.[VERSE_HISTORY_KEY]
    ) {
      window.history.back();
      return;
    }

    setSelectedVerse(null);
  };

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
        <h2 className="text-3xl font-serif text-[#2c1810] mb-2 text-center">
          {book} {chapter}
        </h2>
        <p className="text-center text-xs uppercase tracking-[0.18em] text-[#2c1810]/45 mb-8">
          {translationLabel}
        </p>

        <div className="space-y-1 sm:space-y-2">
          {chapterData.verses.map((v) => (
            <div
              key={v.verse}
              onClick={() => setSelectedVerse(v.verse)}
              className="group cursor-pointer rounded-md px-2 py-2 sm:px-3 sm:py-2.5 hover:bg-white/35 transition-colors"
            >
              <p className="text-[1.38rem] sm:text-[1.48rem] leading-[1.95] text-[#2c1810] font-serif">
                <span className="relative inline-flex items-center mr-2 align-baseline">
                  <span className="text-sm font-semibold text-[#c49a5c] group-hover:text-[#2c1810] transition-colors">
                    {v.verse}
                  </span>
                  {versesWithSermons.has(v.verse) && (
                    <span className="absolute -top-1 -right-2 h-2 w-2 rounded-full bg-[#c49a5c] shadow-sm" />
                  )}
                </span>
                <span>{v.text}</span>
              </p>
            </div>
          ))}
        </div>
      </div>

      {selectedVerse !== null && (
        <VersePanel
          book={book}
          chapter={chapter}
          verse={selectedVerse}
          onClose={closeSelectedVerse}
        />
      )}
    </>
  );
}

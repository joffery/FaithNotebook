import { useEffect, useMemo, useState } from 'react';
import { Search, X, ArrowRight, BookOpen } from 'lucide-react';
import { bibleBooks } from '../data/bibleBooks';
import { searchAvailableBibleText } from '../data/bibleText';
import { parseVerseReference } from '../utils/verseParser';
import { getSermonReferenceIndex, getVerseNumbersForChapter, hasChapterSermons, SermonReferenceIndex } from '../utils/sermonReferences';

type BibleSearchModalProps = {
  onClose: () => void;
  onSelectResult: (book: string, chapter: number, verse?: number) => void;
};

type ReferenceMatch = {
  book: string;
  chapter: number;
  verse?: number;
  label: string;
};

const trimPreview = (text: string, max = 160) => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
};

const parseReferenceMatch = (query: string): ReferenceMatch | null => {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const verseMatches = parseVerseReference(trimmed);
  if (verseMatches.length > 0) {
    const first = verseMatches[0];
    return {
      book: first.book,
      chapter: first.chapter,
      verse: first.verse,
      label: `${first.book} ${first.chapter}:${first.verse}`,
    };
  }

  const chapterMatch = trimmed.match(/^(.+?)\s+(\d+)$/);
  if (!chapterMatch) return null;

  const bookName = chapterMatch[1].trim();
  const chapter = Number(chapterMatch[2]);
  const book = bibleBooks.find((item) => item.name.toLowerCase() === bookName.toLowerCase());
  if (!book || !Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters) return null;

  return {
    book: book.name,
    chapter,
    label: `${book.name} ${chapter}`,
  };
};

export function BibleSearchModal({ onClose, onSelectResult }: BibleSearchModalProps) {
  const [query, setQuery] = useState('');
  const [sermonReferenceIndex, setSermonReferenceIndex] = useState<SermonReferenceIndex | null>(null);

  useEffect(() => {
    let mounted = true;

    getSermonReferenceIndex().then((index) => {
      if (mounted) setSermonReferenceIndex(index);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const referenceMatch = useMemo(() => parseReferenceMatch(query), [query]);
  const textResults = useMemo(() => {
    if (query.trim().length < 3) return [];
    return searchAvailableBibleText(query, 24);
  }, [query]);
  const referenceHasSermons = referenceMatch
    ? typeof referenceMatch.verse === 'number'
      ? getVerseNumbersForChapter(sermonReferenceIndex, referenceMatch.book, referenceMatch.chapter).has(referenceMatch.verse)
      : hasChapterSermons(sermonReferenceIndex, referenceMatch.book, referenceMatch.chapter)
    : false;

  return (
    <div className="fixed inset-0 z-[75] bg-black/45 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#faf8f4] shadow-2xl border border-[#c49a5c]/20 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#c49a5c]/20">
          <div>
            <h2 className="text-xl font-serif text-[#2c1810]">Bible Search</h2>
            <p className="text-sm text-[#2c1810]/60 mt-1">
              Jump to a reference like `Acts 2:38`, or search available verse text.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#2c1810]/55 hover:bg-[#c49a5c]/10 hover:text-[#2c1810] transition-colors"
            aria-label="Close Bible search"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 border-b border-[#c49a5c]/20">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c1810]/35" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Bible or jump to a reference"
              className="w-full rounded-xl border border-[#c49a5c]/20 bg-white pl-10 pr-4 py-3 text-[#2c1810] placeholder-[#2c1810]/35 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {referenceMatch && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2c1810]/45">
                Jump To Reference
              </p>
              <button
                type="button"
                onClick={() => onSelectResult(referenceMatch.book, referenceMatch.chapter, referenceMatch.verse)}
                className="w-full rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-4 text-left hover:bg-[#c49a5c]/8 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[#2c1810]">{referenceMatch.label}</p>
                    <p className="mt-1 text-sm text-[#2c1810]/60">
                      {referenceMatch.verse
                        ? 'Open this Scripture with related sermons and notes'
                        : 'Open this chapter directly'}
                    </p>
                    {referenceHasSermons && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#c49a5c]/12 px-2.5 py-1 text-[11px] font-medium text-[#8c6430]">
                        Related sermons available
                      </span>
                    )}
                  </div>
                  <ArrowRight size={18} className="text-[#2c1810]/35 flex-shrink-0" />
                </div>
              </button>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2c1810]/45">
              Available Text Matches
            </p>

            {query.trim().length < 3 ? (
              <div className="rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-6 text-center">
                <p className="text-[#2c1810] font-medium">Start with a reference or a few words</p>
                <p className="mt-2 text-sm text-[#2c1810]/60">
                  Text search works on the Scripture content already available in the app and local cache.
                </p>
              </div>
            ) : textResults.length === 0 ? (
              <div className="rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-6 text-center">
                <p className="text-[#2c1810] font-medium">No text matches found</p>
                <p className="mt-2 text-sm text-[#2c1810]/60">
                  Try a direct reference like `Matthew 28:19` or different keywords.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {textResults.map((result) => (
                  (() => {
                    const verseHasSermons = getVerseNumbersForChapter(
                      sermonReferenceIndex,
                      result.book,
                      result.chapter
                    ).has(result.verse);

                    return (
                      <button
                        key={`${result.book}-${result.chapter}-${result.verse}-${result.text.slice(0, 20)}`}
                        type="button"
                        onClick={() => onSelectResult(result.book, result.chapter, result.verse)}
                        className="w-full rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-4 text-left hover:bg-[#c49a5c]/8 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[#2c1810]">
                              <BookOpen size={16} className="text-[#c49a5c] flex-shrink-0" />
                              <span className="font-medium">{result.book} {result.chapter}:{result.verse}</span>
                            </div>
                            {verseHasSermons && (
                              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#c49a5c]/12 px-2.5 py-1 text-[11px] font-medium text-[#8c6430]">
                                Related sermons available
                              </span>
                            )}
                            <p className="mt-2 text-sm leading-relaxed text-[#2c1810]/78">
                              {trimPreview(result.text)}
                            </p>
                          </div>
                          <ArrowRight size={18} className="text-[#2c1810]/35 flex-shrink-0" />
                        </div>
                      </button>
                    );
                  })()
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

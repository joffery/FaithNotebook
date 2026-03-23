import { useEffect, useMemo, useState } from 'react';
import { Search, X, ArrowRight, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { bibleBooks } from '../data/bibleBooks';
import { BibleSearchResult, ensureBibleChapter, getBibleChapter, searchAvailableBibleText } from '../data/bibleText';
import { normalizeBibleBookName, parseVerseReference } from '../utils/verseParser';
import {
  getSermonReferenceIndex,
  getVerseNumbersForChapter,
  hasChapterSermons,
  searchSermonVerseSuggestions,
  SermonReferenceIndex,
  SermonSearchSuggestion,
} from '../utils/sermonReferences';
import { VersePanel } from './VersePanel';

type BibleSearchModalProps = {
  onClose: () => void;
  onNavigateResult: (book: string, chapter: number) => void;
};

type ReferenceMatch = {
  book: string;
  chapter: number;
  verse?: number;
  label: string;
};

type UnifiedBibleSearchResult = {
  book: string;
  chapter: number;
  verse: number;
  referenceLabel: string;
  score: number;
  text: string;
  hasRelatedSermons: boolean;
};

const PAGE_SIZE = 8;

const trimPreview = (text: string, max = 180) => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
};

const getVerseKey = (book: string, chapter: number, verse: number) => `${book}-${chapter}-${verse}`;

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

  const bookName = normalizeBibleBookName(chapterMatch[1].trim());
  const chapter = Number(chapterMatch[2]);
  const book = bibleBooks.find((item) => item.name.toLowerCase() === bookName.toLowerCase());
  if (!book || !Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters) return null;

  return {
    book: book.name,
    chapter,
    label: `${book.name} ${chapter}`,
  };
};

const mergeSearchResults = (
  textResults: BibleSearchResult[],
  sermonSuggestions: SermonSearchSuggestion[],
  sermonReferenceIndex: SermonReferenceIndex | null,
  fetchedVerseTexts: Record<string, string>,
): UnifiedBibleSearchResult[] => {
  const merged = new Map<string, UnifiedBibleSearchResult>();

  const upsert = (
    book: string,
    chapter: number,
    verse: number,
    score: number,
    text: string,
    hasRelatedSermons: boolean
  ) => {
    const key = getVerseKey(book, chapter, verse);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        book,
        chapter,
        verse,
        referenceLabel: `${book} ${chapter}:${verse}`,
        score,
        text,
        hasRelatedSermons,
      });
      return;
    }

    existing.score = Math.max(existing.score, score) + Math.min(existing.score, score) * 0.2;
    existing.text = existing.text || text;
    existing.hasRelatedSermons = existing.hasRelatedSermons || hasRelatedSermons;
  };

  textResults.forEach((result) => {
    const key = getVerseKey(result.book, result.chapter, result.verse);
    upsert(
      result.book,
      result.chapter,
      result.verse,
      result.score || 0,
      result.text || fetchedVerseTexts[key] || '',
      getVerseNumbersForChapter(sermonReferenceIndex, result.book, result.chapter).has(result.verse)
    );
  });

  sermonSuggestions.forEach((suggestion) => {
    const key = getVerseKey(suggestion.book, suggestion.chapter, suggestion.verse);
    upsert(
      suggestion.book,
      suggestion.chapter,
      suggestion.verse,
      suggestion.score || 0,
      fetchedVerseTexts[key] || '',
      true
    );
  });

  return Array.from(merged.values()).sort((a, b) => b.score - a.score || a.book.localeCompare(b.book) || a.chapter - b.chapter || a.verse - b.verse);
};

export function BibleSearchModal({ onClose, onNavigateResult }: BibleSearchModalProps) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sermonReferenceIndex, setSermonReferenceIndex] = useState<SermonReferenceIndex | null>(null);
  const [previewVerse, setPreviewVerse] = useState<{ book: string; chapter: number; verse: number } | null>(null);
  const [fetchedVerseTexts, setFetchedVerseTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;

    getSermonReferenceIndex().then((index) => {
      if (mounted) setSermonReferenceIndex(index);
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const referenceMatch = useMemo(() => parseReferenceMatch(query), [query]);
  const textResults = useMemo(() => {
    if (query.trim().length < 3) return [];
    return searchAvailableBibleText(query, 80);
  }, [query]);
  const sermonSuggestions = useMemo(() => {
    if (query.trim().length < 3) return [];
    return searchSermonVerseSuggestions(sermonReferenceIndex, query, 80);
  }, [query, sermonReferenceIndex]);
  const searchResults = useMemo(
    () => mergeSearchResults(textResults, sermonSuggestions, sermonReferenceIndex, fetchedVerseTexts),
    [fetchedVerseTexts, sermonReferenceIndex, sermonSuggestions, textResults]
  );

  const totalPages = Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedResults = searchResults.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const referenceHasSermons = referenceMatch
    ? typeof referenceMatch.verse === 'number'
      ? getVerseNumbersForChapter(sermonReferenceIndex, referenceMatch.book, referenceMatch.chapter).has(referenceMatch.verse)
      : hasChapterSermons(sermonReferenceIndex, referenceMatch.book, referenceMatch.chapter)
    : false;

  useEffect(() => {
    let mounted = true;

    const loadMissingVerseTexts = async () => {
      const missing = paginatedResults.filter((result) => !result.text);
      if (missing.length === 0) return;

      const nextEntries = await Promise.all(
        missing.map(async (result) => {
          const key = getVerseKey(result.book, result.chapter, result.verse);
          const cachedChapter = getBibleChapter(result.book, result.chapter);
          const chapterData = cachedChapter || await ensureBibleChapter(result.book, result.chapter, false);
          const verseText = chapterData?.verses.find((item) => item.verse === result.verse)?.text || '';
          return [key, verseText] as const;
        })
      );

      if (!mounted) return;

      setFetchedVerseTexts((prev) => ({
        ...prev,
        ...Object.fromEntries(nextEntries.filter((entry) => entry[1])),
      }));
    };

    void loadMissingVerseTexts();

    return () => {
      mounted = false;
    };
  }, [paginatedResults]);

  const openVerseResult = (book: string, chapter: number, verse: number) => {
    onNavigateResult(book, chapter);
    setPreviewVerse({ book, chapter, verse });
  };

  return (
    <div className="fixed inset-0 z-[75] bg-black/45 flex items-center justify-center p-4 overscroll-contain">
      <div className="w-full max-w-2xl rounded-2xl bg-[#faf8f4] shadow-2xl border border-[#c49a5c]/20 max-h-[90vh] overflow-hidden flex flex-col overscroll-contain">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#c49a5c]/20">
          <div>
            <h2 className="text-xl font-serif text-[#2c1810]">Bible Search</h2>
            <p className="text-sm text-[#2c1810]/60 mt-1">
              Search Scripture by reference or keyword. Results are ranked by relevance.
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

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-6">
          {referenceMatch && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2c1810]/45">
                Jump To Reference
              </p>
              <button
                type="button"
                onClick={() => {
                  if (typeof referenceMatch.verse === 'number') {
                    openVerseResult(referenceMatch.book, referenceMatch.chapter, referenceMatch.verse);
                    return;
                  }

                  onNavigateResult(referenceMatch.book, referenceMatch.chapter);
                  onClose();
                }}
                className="w-full rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-4 text-left hover:bg-[#c49a5c]/8 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[#2c1810]">{referenceMatch.label}</p>
                    <p className="mt-1 text-sm text-[#2c1810]/60">
                      {referenceMatch.verse ? 'Open this Scripture' : 'Open this chapter directly'}
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2c1810]/45">
                Search Results
              </p>
              {query.trim().length >= 3 && searchResults.length > 0 && (
                <p className="text-xs text-[#2c1810]/50">
                  {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
                </p>
              )}
            </div>

            {query.trim().length < 3 ? (
              <div className="rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-6 text-center">
                <p className="text-[#2c1810] font-medium">Start with a reference or a few words</p>
                <p className="mt-2 text-sm text-[#2c1810]/60">
                  Try something like `Acts 2:38`, `humble`, or `baptize`.
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-6 text-center">
                <p className="text-[#2c1810] font-medium">No Scripture matches found</p>
                <p className="mt-2 text-sm text-[#2c1810]/60">
                  Try a more specific keyword or a direct reference.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {paginatedResults.map((result) => (
                    <button
                      key={getVerseKey(result.book, result.chapter, result.verse)}
                      type="button"
                      onClick={() => openVerseResult(result.book, result.chapter, result.verse)}
                      className="w-full rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-4 text-left hover:bg-[#c49a5c]/8 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[#2c1810]">
                            <BookOpen size={16} className="text-[#c49a5c] flex-shrink-0" />
                            <span className="font-medium">{result.referenceLabel}</span>
                          </div>
                          {result.hasRelatedSermons && (
                            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#c49a5c]/12 px-2.5 py-1 text-[11px] font-medium text-[#8c6430]">
                              Related sermons available
                            </span>
                          )}
                          <p className="mt-2 text-sm leading-relaxed text-[#2c1810]/78">
                            {result.text ? trimPreview(result.text) : 'Loading Scripture text...'}
                          </p>
                        </div>
                        <ArrowRight size={18} className="text-[#2c1810]/35 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex items-center gap-1 text-sm text-[#2c1810] disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                      Previous
                    </button>
                    <p className="text-sm text-[#2c1810]/60">
                      Page {currentPage} of {totalPages}
                    </p>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={currentPage === totalPages}
                      className="inline-flex items-center gap-1 text-sm text-[#2c1810] disabled:opacity-40"
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {previewVerse && (
        <VersePanel
          book={previewVerse.book}
          chapter={previewVerse.chapter}
          verse={previewVerse.verse}
          onClose={() => setPreviewVerse(null)}
        />
      )}
    </div>
  );
}

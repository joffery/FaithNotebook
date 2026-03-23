import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ArrowRight, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { bibleBooks } from '../data/bibleBooks';
import { BibleChapter, BibleSearchResult, ensureBibleChapter, getBibleChapter } from '../data/bibleText';
import { BibleSearchSource, getInstantBibleSearchPreview, searchBibleText } from '../data/bibleSearch';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  BibleSearchIndexStatus,
  getBibleSearchIndexStatus,
  startBibleSearchIndexSync,
  subscribeBibleSearchIndexStatus,
} from '../data/bibleSearchIndex';
import { createSearchMatcher } from '../utils/searchText';
import { normalizeBibleBookName, parseVerseReference } from '../utils/verseParser';
import {
  getSermonReferenceIndex,
  getVerseNumbersForChapter,
  hasChapterSermons,
  SermonReferenceIndex,
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

type PassagePreview = {
  rangeLabel: string;
  verses: Array<{
    verse: number;
    text: string;
    isPrimaryMatch: boolean;
  }>;
};

const PAGE_SIZE = 8;
const SEARCH_DEBOUNCE_MS = 250;

const trimPreview = (text: string, max = 180) => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
};

const getVerseKey = (book: string, chapter: number, verse: number) => `${book}-${chapter}-${verse}`;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getHighlightTerms = (query: string) => {
  const matcher = createSearchMatcher(query);
  if (!matcher.hasQuery) return [];

  return Array.from(
    new Set(
      matcher.tokens.flatMap((token) => [token.raw, ...token.variants])
    )
  )
    .filter((term) => /[a-z]/i.test(term) && term.length >= 3)
    .sort((a, b) => b.length - a.length);
};

const renderHighlightedText = (text: string, query: string): ReactNode => {
  const terms = getHighlightTerms(query);
  if (!text || terms.length === 0) return text;

  const pattern = new RegExp(`(${terms.map(escapeRegex).join('|')})`, 'gi');
  const parts = text.split(pattern);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    const isMatch = terms.some((term) => part.toLowerCase() === term.toLowerCase());
    if (!isMatch) return <span key={`${part}-${index}`}>{part}</span>;

    return (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-[#f1d39c]/70 px-0.5 text-[#2c1810]"
      >
        {part}
      </mark>
    );
  });
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

const buildPassagePreview = (
  chapterData: BibleChapter | null | undefined,
  result: UnifiedBibleSearchResult
): PassagePreview => {
  if (!chapterData) {
    return {
      rangeLabel: result.referenceLabel,
      verses: [
        {
          verse: result.verse,
          text: result.text,
          isPrimaryMatch: true,
        },
      ],
    };
  }

  const verseIndex = chapterData.verses.findIndex((item) => item.verse === result.verse);
  if (verseIndex < 0) {
    return {
      rangeLabel: result.referenceLabel,
      verses: [
        {
          verse: result.verse,
          text: result.text,
          isPrimaryMatch: true,
        },
      ],
    };
  }

  const startIndex = Math.max(0, verseIndex - 1);
  const endIndex = Math.min(chapterData.verses.length - 1, verseIndex + 1);
  const previewVerses = chapterData.verses.slice(startIndex, endIndex + 1);
  const startVerse = previewVerses[0]?.verse ?? result.verse;
  const endVerse = previewVerses[previewVerses.length - 1]?.verse ?? result.verse;

  return {
    rangeLabel:
      startVerse === endVerse
        ? `${result.book} ${result.chapter}:${startVerse}`
        : `${result.book} ${result.chapter}:${startVerse}-${endVerse}`,
    verses: previewVerses.map((item) => ({
      verse: item.verse,
      text: item.text,
      isPrimaryMatch: item.verse === result.verse,
    })),
  };
};

export function BibleSearchModal({ onClose, onNavigateResult }: BibleSearchModalProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sermonReferenceIndex, setSermonReferenceIndex] = useState<SermonReferenceIndex | null>(null);
  const [previewVerse, setPreviewVerse] = useState<{ book: string; chapter: number; verse: number } | null>(null);
  const [passagePreviews, setPassagePreviews] = useState<Record<string, PassagePreview>>({});
  const [textResults, setTextResults] = useState<BibleSearchResult[]>([]);
  const [isSearchingText, setIsSearchingText] = useState(false);
  const [searchSource, setSearchSource] = useState<BibleSearchSource>(
    isSupabaseConfigured ? 'supabase' : 'local'
  );
  const [indexStatus, setIndexStatus] = useState<BibleSearchIndexStatus>({
    indexedChapters: 0,
    totalChapters: 1189,
    isComplete: false,
    isSyncing: false,
  });
  const searchAbortControllerRef = useRef<AbortController | null>(null);

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
    let mounted = true;

    void getBibleSearchIndexStatus().then((status) => {
      if (mounted) setIndexStatus(status);
    });

    const unsubscribe = subscribeBibleSearchIndexStatus((status) => {
      if (mounted) setIndexStatus(status);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const referenceMatch = useMemo(() => parseReferenceMatch(query), [query]);
  const searchResults = useMemo(
    () =>
      [...textResults]
        .map((result) => ({
          book: result.book,
          chapter: result.chapter,
          verse: result.verse,
          referenceLabel: `${result.book} ${result.chapter}:${result.verse}`,
          score: result.score || 0,
          text: result.text || '',
          hasRelatedSermons: getVerseNumbersForChapter(
            sermonReferenceIndex,
            result.book,
            result.chapter
          ).has(result.verse),
        }))
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.book.localeCompare(b.book) ||
            a.chapter - b.chapter ||
            a.verse - b.verse
        ),
    [sermonReferenceIndex, textResults]
  );
  const highlightQuery = debouncedQuery.trim().length >= 3 ? debouncedQuery : query;

  const totalPages = Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedResults = searchResults.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const referenceHasSermons = referenceMatch
    ? typeof referenceMatch.verse === 'number'
      ? getVerseNumbersForChapter(sermonReferenceIndex, referenceMatch.book, referenceMatch.chapter).has(referenceMatch.verse)
      : hasChapterSermons(sermonReferenceIndex, referenceMatch.book, referenceMatch.chapter)
    : false;

  useEffect(() => {
    if (debouncedQuery.trim().length < 3) {
      setTextResults([]);
      setIsSearchingText(false);
      setSearchSource(isSupabaseConfigured ? 'supabase' : 'local');
      return;
    }

    let mounted = true;
    searchAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    searchAbortControllerRef.current = abortController;
    const preview = getInstantBibleSearchPreview(debouncedQuery, 120);
    if (preview) {
      setTextResults(preview.results);
      setSearchSource(preview.source);
    }
    setIsSearchingText(true);

    void searchBibleText(debouncedQuery, 120, abortController.signal)
      .then(({ results, source }) => {
        if (!mounted) return;
        setTextResults(results);
        setSearchSource(source);
      })
      .catch((error) => {
        if (!mounted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Bible search failed:', error);
        setTextResults([]);
      })
      .finally(() => {
        if (mounted && searchAbortControllerRef.current === abortController) {
          setIsSearchingText(false);
        }
      });

    return () => {
      mounted = false;
      abortController.abort();
      if (searchAbortControllerRef.current === abortController) {
        searchAbortControllerRef.current = null;
      }
    };
  }, [debouncedQuery, indexStatus.indexedChapters]);

  useEffect(() => {
    if (debouncedQuery.trim().length < 3 || searchSource !== 'local' || indexStatus.isComplete || indexStatus.isSyncing) return;
    void startBibleSearchIndexSync();
  }, [debouncedQuery, indexStatus.isComplete, indexStatus.isSyncing, searchSource]);

  useEffect(() => {
    let mounted = true;

    const loadMissingVerseTexts = async () => {
      const missing = paginatedResults.filter(
        (result) => !passagePreviews[getVerseKey(result.book, result.chapter, result.verse)]
      );
      if (missing.length === 0) return;

      const nextEntries = await Promise.all(
        missing.map(async (result) => {
          const key = getVerseKey(result.book, result.chapter, result.verse);
          const cachedChapter = getBibleChapter(result.book, result.chapter);
          const chapterData = cachedChapter || await ensureBibleChapter(result.book, result.chapter, false);
          return [key, buildPassagePreview(chapterData, result)] as const;
        })
      );

      if (!mounted) return;

      setPassagePreviews((prev) => ({
        ...prev,
        ...Object.fromEntries(nextEntries),
      }));
    };

    void loadMissingVerseTexts();

    return () => {
      mounted = false;
    };
  }, [paginatedResults, passagePreviews]);

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

            {query.trim().length >= 3 && (
              <div className="rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-3">
                <p className="text-sm text-[#2c1810]/70">
                  {searchSource === 'supabase'
                    ? 'Searching the full Bible from the Supabase verse index.'
                    : indexStatus.isComplete
                      ? 'Full Bible search is ready locally.'
                      : indexStatus.isSyncing
                        ? `Building local Bible search index... ${indexStatus.indexedChapters}/${indexStatus.totalChapters} chapters ready.`
                        : `Preparing local Bible search... ${indexStatus.indexedChapters}/${indexStatus.totalChapters} chapters ready so far.`}
                </p>
              </div>
            )}

            {query.trim().length < 3 ? (
              <div className="rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-6 text-center">
                <p className="text-[#2c1810] font-medium">Start with a reference or a few words</p>
                <p className="mt-2 text-sm text-[#2c1810]/60">
                  Try something like `Acts 2:38`, `humble`, or `baptize`.
                </p>
              </div>
            ) : isSearchingText && searchResults.length === 0 ? (
              <div className="rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-6 text-center">
                <p className="text-[#2c1810] font-medium">Searching Scripture...</p>
                <p className="mt-2 text-sm text-[#2c1810]/60">
                  Pulling together the most relevant verses for your query.
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
                    (() => {
                      const key = getVerseKey(result.book, result.chapter, result.verse);
                      const passagePreview = passagePreviews[key];

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => openVerseResult(result.book, result.chapter, result.verse)}
                          className="w-full rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-4 text-left hover:bg-[#c49a5c]/8 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-[#2c1810]">
                                <BookOpen size={16} className="text-[#c49a5c] flex-shrink-0" />
                                <span className="font-medium">
                                  {passagePreview?.rangeLabel || result.referenceLabel}
                                </span>
                              </div>
                              {result.hasRelatedSermons && (
                                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#c49a5c]/12 px-2.5 py-1 text-[11px] font-medium text-[#8c6430]">
                                  Related sermons available
                                </span>
                              )}
                              <div className="mt-3 space-y-2">
                                {(passagePreview?.verses || []).length > 0 ? (
                                  passagePreview?.verses.map((verse) => (
                                    <p
                                      key={`${key}-${verse.verse}`}
                                      className={`rounded-xl px-3 py-2 text-sm leading-relaxed ${
                                        verse.isPrimaryMatch
                                          ? 'bg-[#c49a5c]/10 text-[#2c1810]'
                                          : 'text-[#2c1810]/72'
                                      }`}
                                    >
                                      <span className="mr-2 font-semibold text-[#8c6430]">
                                        {verse.verse}
                                      </span>
                                      {renderHighlightedText(
                                        trimPreview(verse.text, verse.isPrimaryMatch ? 220 : 140),
                                        highlightQuery
                                      )}
                                    </p>
                                  ))
                                ) : (
                                  <p className="text-sm leading-relaxed text-[#2c1810]/78">
                                    {result.text
                                      ? renderHighlightedText(trimPreview(result.text), highlightQuery)
                                      : 'Loading Scripture context...'}
                                  </p>
                                )}
                              </div>
                            </div>
                            <ArrowRight size={18} className="text-[#2c1810]/35 flex-shrink-0" />
                          </div>
                        </button>
                      );
                    })()
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
          scriptureDisplayMode="chapter"
          onClose={() => setPreviewVerse(null)}
        />
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureBibleChapter } from '../data/bibleText';
import { parseVerseReference } from '../utils/verseParser';
import { parseSermonVerseRefs } from '../utils/sermonReferences';
import { formatSermonDate, formatSermonMonth, getPrimarySermonDate, sortSermonsNewestFirst } from '../utils/sermonSorting';

type SermonsPanelProps = {
  onClose: () => void;
};

type VerseInsight = {
  verse: string;
  insight: string;
};

type Sermon = {
  id: string;
  title: string;
  speaker: string;
  church: string;
  region: string;
  youtube_url: string;
  youtube_published_at?: string | null;
  processed_at: string;
  summary?: string;
  transcript_preview?: string;
  verses?: unknown;
  verse_insights?: VerseInsight[];
  tags?: string[];
};

const parseVerseInsights = (value: unknown): VerseInsight[] => {
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

const parseTags = (value: unknown): string[] => {
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

const REGIONS = [
  { label: 'All', value: '' },
  { label: 'Tampa Bay', value: 'tampa_bay' },
  { label: 'Orlando', value: 'orlando' },
  { label: 'Miami', value: 'miami' },
  { label: 'Gainesville', value: 'gainesville' },
];

const PAGE_SIZE = 20;

const verseTextPromiseCache = new Map<string, Promise<string | null>>();

const buildVisiblePages = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);

  if (current <= 3) return [1, 2, 3, 4, total];
  if (current >= total - 2) return [1, total - 3, total - 2, total - 1, total];
  return [1, current - 1, current, current + 1, total];
};


export function SermonsPanel({ onClose }: SermonsPanelProps) {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [verseTexts, setVerseTexts] = useState<Record<string, string>>({});
  const sermonCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!expandedId) return;
    const sermon = sermons.find((s) => s.id === expandedId);
    if (!sermon) return;
    const insights = parseVerseInsights(sermon.verse_insights);
    if (insights.length === 0) return;
    let mounted = true;
    Promise.all(insights.map(async (vi) => {
      const text = await getVerseTextForReference(vi.verse);
      return [vi.verse, text] as const;
    })).then((entries) => {
      if (!mounted) return;
      setVerseTexts((prev) => ({
        ...prev,
        ...Object.fromEntries(entries.filter((e): e is readonly [string, string] => typeof e[1] === 'string' && e[1].length > 0)),
      }));
    });
    return () => { mounted = false; };
  }, [expandedId, sermons]);

  useEffect(() => {
    loadSermons();
  }, [region]);

  useEffect(() => {
    setPage(1);
  }, [search, region]);

  const loadSermons = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);

    const baseFields = 'id, title, speaker, church, region, youtube_url, processed_at, summary, transcript_preview, verses, verse_insights, tags';
    const fieldsWithPublishedAt = `${baseFields}, youtube_published_at`;

    let query = supabase
      .from('sermons')
      .select(fieldsWithPublishedAt);

    if (region) {
      query = query.eq('region', region);
    }

    let { data, error } = await query;

    if (error && error.message?.toLowerCase().includes('youtube_published_at')) {
      let fallbackQuery = supabase
        .from('sermons')
        .select(baseFields);

      if (region) {
        fallbackQuery = fallbackQuery.eq('region', region);
      }

      const fallback = await fallbackQuery;
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('Error loading sermons:', error);
      setSermons([]);
      setLoading(false);
      return;
    }

    setSermons(sortSermonsNewestFirst(data || []));
    setLoading(false);
  };

  const filtered = sermons.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const verseInsights = parseVerseInsights(s.verse_insights);
    const tags = parseTags(s.tags);
    const verseRefs = parseSermonVerseRefs(s.verses);

    return (
      s.title?.toLowerCase().includes(q) ||
      s.speaker?.toLowerCase().includes(q) ||
      s.church?.toLowerCase().includes(q) ||
      tags.some(tag => tag.toLowerCase().includes(q)) ||
      verseRefs.some(ref => ref.toLowerCase().includes(q)) ||
      verseInsights.some(vi =>
        vi.verse?.toLowerCase().includes(q) ||
        vi.insight?.toLowerCase().includes(q)
      )
    );
  });

  const toggleExpand = (id: string, trigger?: HTMLButtonElement | null) => {
    const willOpen = expandedId !== id;
    trigger?.blur();
    setExpandedId(prev => (prev === id ? null : id));

    if (willOpen) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          sermonCardRefs.current[id]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
      });
    }
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visiblePages = buildVisiblePages(currentPage, totalPages);
  const paginatedGroups = paginated.reduce<Array<{ label: string; sermons: Sermon[] }>>((groups, sermon) => {
    const label = formatSermonMonth(getPrimarySermonDate(sermon)) || 'Earlier';
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.label === label) {
      lastGroup.sermons.push(sermon);
      return groups;
    }

    groups.push({ label, sermons: [sermon] });
    return groups;
  }, []);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
        <div className="bg-[#faf8f4] w-full max-w-2xl rounded-t-2xl shadow-2xl h-[92dvh] sm:h-auto sm:max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 sm:p-6 border-b border-[#c49a5c]/20">
          <h3 className="text-lg sm:text-xl font-serif text-[#2c1810]">Sermons</h3>
          <button
            onClick={onClose}
            className="text-[#2c1810]/60 hover:text-[#2c1810] transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-3 py-3 sm:p-4 border-b border-[#c49a5c]/20 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c1810]/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search title, speaker, church, topic, or scripture…"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#c49a5c]/30 rounded-lg text-[#2c1810] placeholder-[#2c1810]/40 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/50"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {REGIONS.map(r => (
              <button
                key={r.value}
                onClick={() => setRegion(r.value)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  region === r.value
                    ? 'bg-[#c49a5c] text-white'
                    : 'bg-white border border-[#c49a5c]/30 text-[#2c1810] hover:bg-[#c49a5c]/10'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {!loading && filtered.length > 0 && (
            <p className="text-xs sm:text-sm text-[#2c1810]/60">
              Showing {pageStart}-{pageEnd} of {filtered.length} sermons
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 sm:p-4 space-y-2">
          {loading ? (
            <p className="text-center text-[#2c1810]/60 py-8">Loading sermons…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[#2c1810]/60 py-8">No sermons found.</p>
          ) : (
            paginatedGroups.map((group) => (
              <div key={group.label} className="space-y-2">
                <div className="md:sticky md:top-0 z-10 -mx-1 px-1 py-1 bg-[#faf8f4]/95 backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2c1810]/45">
                    {group.label}
                  </p>
                </div>

                {group.sermons.map(sermon => {
                  const isOpen = expandedId === sermon.id;
                  const verseInsights = parseVerseInsights(sermon.verse_insights);
                  const tags = parseTags(sermon.tags);
                  const scriptureRefs = parseVerseInsights(sermon.verse_insights)
                    .map((vi) => vi.verse)
                    .filter((ref): ref is string => typeof ref === 'string' && ref.trim().length > 0);
                  const sermonDate = formatSermonDate(getPrimarySermonDate(sermon));
                  const summaryText = sermon.summary?.trim() || sermon.transcript_preview?.trim() || '';

                  return (
                    <div
                      key={sermon.id}
                      ref={(node) => {
                        sermonCardRefs.current[sermon.id] = node;
                      }}
                      className="bg-white/60 rounded-lg border border-[#c49a5c]/20 overflow-hidden scroll-mt-4"
                    >
                      <button
                        className="w-full text-left px-3 py-3 sm:p-4 flex items-start justify-between gap-3"
                        onClick={(e) => toggleExpand(sermon.id, e.currentTarget)}
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-[#2c1810] leading-snug text-[15px] sm:text-base">{sermon.title}</h4>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[#2c1810]/70 mt-1">
                            {sermon.speaker && <span>{sermon.speaker}</span>}
                            {sermon.speaker && sermon.church && <span>•</span>}
                            {sermon.church && <span>{sermon.church}</span>}
                          </div>
                          {sermonDate && (
                            <p className="text-xs text-[#2c1810]/50 mt-0.5">{sermonDate}</p>
                          )}
                        </div>
                        {isOpen ? (
                          <ChevronUp size={18} className="flex-shrink-0 text-[#c49a5c] mt-1" />
                        ) : (
                          <ChevronDown size={18} className="flex-shrink-0 text-[#2c1810]/40 mt-1" />
                        )}
                      </button>

                      {isOpen && (
                        <div className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-3 border-t border-[#c49a5c]/10 pt-3">
                          <div className="flex flex-wrap gap-2">
                            {sermon.youtube_url && (
                              <a
                                href={sermon.youtube_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center rounded-lg bg-[#c49a5c] px-3 py-2 text-sm font-medium text-white hover:bg-[#b38a4d] transition-colors"
                              >
                                Watch Full Sermon
                              </a>
                            )}

                          </div>

                          {summaryText && (
                            <p className="text-sm text-[#2c1810] leading-relaxed">{summaryText}</p>
                          )}

                          {scriptureRefs.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-[#2c1810]/50 uppercase tracking-wide mb-2">
                                Scripture Path
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {scriptureRefs.slice(0, 6).map((ref) => (
                                  <span
                                    key={ref}
                                    className="rounded-full px-3 py-1.5 text-xs bg-[#c49a5c]/10 text-[#c49a5c]"
                                  >
                                    {ref}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {verseInsights.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-[#2c1810]/50 uppercase tracking-wide mb-2">Verse Insights</p>
                              <ul className="space-y-2">
                                {verseInsights.map((vi, i) => (
                                  <li key={i} className="text-sm text-[#2c1810]">
                                    <p className="font-medium text-[#c49a5c]">{vi.verse}</p>
                                    {verseTexts[vi.verse] && (
                                      <p className="mt-1 text-xs leading-relaxed text-[#2c1810]/70 italic">
                                        {verseTexts[vi.verse]}
                                      </p>
                                    )}
                                    <p className="mt-2 leading-relaxed">{vi.insight}</p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {tags.map((tag, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-[#c49a5c]/10 text-[#c49a5c] text-xs rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {!loading && filtered.length > PAGE_SIZE && (
          <div className="border-t border-[#c49a5c]/20 px-3 py-3 sm:px-4 flex items-center justify-between gap-3">
            <p className="text-sm text-[#2c1810]/60">
              Page {currentPage} of {totalPages}
            </p>
            <div className="hidden sm:flex items-center gap-2 flex-wrap justify-end">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-lg bg-white border border-[#c49a5c]/30 text-[#2c1810] disabled:opacity-40"
              >
                Previous
              </button>
              {visiblePages.map((pageNumber, index) => {
                const previousPage = visiblePages[index - 1];
                const showGap = previousPage && pageNumber - previousPage > 1;

                return (
                  <div key={pageNumber} className="contents">
                    {showGap && (
                      <span className="px-1 text-sm text-[#2c1810]/40">…</span>
                    )}
                    <button
                      onClick={() => setPage(pageNumber)}
                      className={`px-3 py-1.5 text-sm rounded-lg border ${
                        pageNumber === currentPage
                          ? 'bg-[#c49a5c] border-[#c49a5c] text-white'
                          : 'bg-white border-[#c49a5c]/30 text-[#2c1810]'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg bg-white border border-[#c49a5c]/30 text-[#2c1810] disabled:opacity-40"
              >
                Next
              </button>
            </div>
            <div className="flex sm:hidden items-center gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm rounded-lg bg-white border border-[#c49a5c]/30 text-[#2c1810] disabled:opacity-40"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg bg-white border border-[#c49a5c]/30 text-[#2c1810] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

    </>
  );
}

async function getVerseTextForReference(verseRef: string): Promise<string | null> {
  if (!verseTextPromiseCache.has(verseRef)) {
    verseTextPromiseCache.set(
      verseRef,
      (async () => {
        const parsed = parseVerseReference(verseRef);
        if (parsed.length === 0) return null;
        const { book, chapter } = parsed[0];
        const chapterData = await ensureBibleChapter(book, chapter, false);
        if (!chapterData) return null;
        const verseMap = new Map(chapterData.verses.map((e) => [e.verse, e.text]));
        const texts = parsed
          .map(({ verse }) => verseMap.get(verse))
          .filter((t): t is string => typeof t === 'string' && t.length > 0);
        return texts.length > 0 ? texts.join(' ') : null;
      })()
    );
  }
  return verseTextPromiseCache.get(verseRef)!;
}

import { useState, useEffect } from 'react';
import { X, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ensureBibleChapter } from '../data/bibleText';
import { parseVerseReference } from '../utils/verseParser';
import { parseSermonVerseRefs } from '../utils/sermonReferences';
import { sortSermonsNewestFirst } from '../utils/sermonSorting';

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
  verses?: unknown;
  verse_insights?: VerseInsight[];
  tags?: string[];
};

const verseTextPromiseCache = new Map<string, Promise<string | null>>();

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

export function SermonsPanel({ onClose }: SermonsPanelProps) {
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [verseTexts, setVerseTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!expandedId) return;

    const sermon = sermons.find((item) => item.id === expandedId);
    if (!sermon) return;

    const insights = parseVerseInsights(sermon.verse_insights);
    if (insights.length === 0) return;

    let mounted = true;

    Promise.all(
      insights.map(async (insight) => {
        const text = await getVerseTextForReference(insight.verse);
        return [insight.verse, text] as const;
      })
    ).then((entries) => {
      if (!mounted) return;

      setVerseTexts((prev) => ({
        ...prev,
        ...Object.fromEntries(
          entries.filter((entry): entry is readonly [string, string] => typeof entry[1] === 'string' && entry[1].length > 0)
        ),
      }));
    });

    return () => {
      mounted = false;
    };
  }, [expandedId, sermons]);

  useEffect(() => {
    loadSermons();
  }, [region]);

  const loadSermons = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);

    const baseFields = 'id, title, speaker, church, region, youtube_url, processed_at, summary, verses, verse_insights, tags';
    const fieldsWithPublishedAt = `${baseFields}, youtube_published_at`;

    let query = supabase
      .from('sermons')
      .select(fieldsWithPublishedAt)
      .limit(200);

    if (region) {
      query = query.eq('region', region);
    }

    let { data, error } = await query;

    if (error && error.message?.toLowerCase().includes('youtube_published_at')) {
      let fallbackQuery = supabase
        .from('sermons')
        .select(baseFields)
        .limit(200);

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

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
      <div className="bg-[#faf8f4] w-full max-w-2xl rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#c49a5c]/20">
          <h3 className="text-xl font-serif text-[#2c1810]">Sermons</h3>
          <button
            onClick={onClose}
            className="text-[#2c1810]/60 hover:text-[#2c1810] transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 border-b border-[#c49a5c]/20 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c1810]/40" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search title, speaker, church, tag, or scripture…"
              className="w-full pl-9 pr-4 py-2 bg-white border border-[#c49a5c]/30 rounded-lg text-[#2c1810] placeholder-[#2c1810]/40 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/50"
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
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-center text-[#2c1810]/60 py-8">Loading sermons…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[#2c1810]/60 py-8">No sermons found.</p>
          ) : (
            filtered.map(sermon => {
              const isOpen = expandedId === sermon.id;
              const verseInsights = parseVerseInsights(sermon.verse_insights);
              const tags = parseTags(sermon.tags);
              return (
                <div key={sermon.id} className="bg-white/60 rounded-lg border border-[#c49a5c]/20 overflow-hidden">
                  <button
                    className="w-full text-left p-4 flex items-start justify-between gap-3"
                    onClick={() => toggleExpand(sermon.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[#2c1810] leading-snug">{sermon.title}</h4>
                      <div className="flex items-center gap-2 text-sm text-[#2c1810]/70 mt-1">
                        {sermon.speaker && <span>{sermon.speaker}</span>}
                        {sermon.speaker && sermon.church && <span>•</span>}
                        {sermon.church && <span>{sermon.church}</span>}
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronUp size={18} className="flex-shrink-0 text-[#c49a5c] mt-1" />
                    ) : (
                      <ChevronDown size={18} className="flex-shrink-0 text-[#2c1810]/40 mt-1" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-4 border-t border-[#c49a5c]/10 pt-3">
                      {sermon.summary && (
                        <p className="text-sm text-[#2c1810] leading-relaxed">{sermon.summary}</p>
                      )}

                      {verseInsights.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-[#2c1810]/50 uppercase tracking-wide mb-2">Verse Insights</p>
                          <ul className="space-y-2">
                            {verseInsights.map((vi, i) => (
                              <li key={i} className="text-sm text-[#2c1810]">
                                <p>
                                  <span className="font-medium text-[#c49a5c]">{vi.verse}</span>
                                  {' — '}
                                  {vi.insight}
                                </p>
                                {verseTexts[vi.verse] && (
                                  <p className="mt-1 text-xs leading-relaxed text-[#2c1810]/70 italic">
                                    {verseTexts[vi.verse]}
                                  </p>
                                )}
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

                      {sermon.youtube_url && (
                        <a
                          href={sermon.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block text-xs text-[#c49a5c] hover:underline"
                        >
                          ▶ Watch on YouTube
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
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

        const verseMap = new Map(chapterData.verses.map((entry) => [entry.verse, entry.text]));
        const verseTexts = parsed
          .map(({ verse }) => verseMap.get(verse))
          .filter((text): text is string => typeof text === 'string' && text.length > 0);

        return verseTexts.length > 0 ? verseTexts.join(' ') : null;
      })()
    );
  }

  return verseTextPromiseCache.get(verseRef)!;
}

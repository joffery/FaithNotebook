import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type SermonsPanelProps = {
  onClose: () => void;
};

type Sermon = {
  id: string;
  title: string;
  speaker: string;
  church: string;
  region: string;
  youtube_url: string;
  video_id: string;
  processed_at: string;
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

  useEffect(() => {
    loadSermons();
  }, [region]);

  const loadSermons = async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);

    let query = supabase
      .from('sermons')
      .select('id, title, speaker, church, region, youtube_url, video_id, processed_at')
      .order('processed_at', { ascending: false })
      .limit(200);

    if (region) {
      query = query.eq('region', region);
    }

    const { data } = await query;
    setSermons(data || []);
    setLoading(false);
  };

  const filtered = sermons.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.title?.toLowerCase().includes(q) ||
      s.speaker?.toLowerCase().includes(q) ||
      s.church?.toLowerCase().includes(q)
    );
  });

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
              placeholder="Search title, speaker, or church…"
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

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-center text-[#2c1810]/60 py-8">Loading sermons…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[#2c1810]/60 py-8">No sermons found.</p>
          ) : (
            filtered.map(sermon => (
              <div key={sermon.id} className="bg-white/60 rounded-lg p-4 border border-[#c49a5c]/20">
                <h4 className="font-semibold text-[#2c1810] leading-snug">{sermon.title}</h4>
                <div className="flex items-center gap-2 text-sm text-[#2c1810]/70 mt-1">
                  {sermon.speaker && <span>{sermon.speaker}</span>}
                  {sermon.speaker && sermon.church && <span>•</span>}
                  {sermon.church && <span>{sermon.church}</span>}
                </div>
                {sermon.youtube_url && (
                  <a
                    href={sermon.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-[#c49a5c] hover:underline"
                  >
                    ▶ Watch on YouTube
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { X, Heart, Lock, Unlock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { parseVerseReference, getRandomCommunityName } from '../utils/verseParser';

type VersePanelProps = {
  book: string;
  chapter: number;
  verse: number;
  onClose: () => void;
};

type Note = {
  id: string;
  content: string;
  is_public: boolean;
  updated_at: string;
};

type SharedNote = {
  id: string;
  user_id: string;
  content: string;
  likes_count: number;
  created_at: string;
  profile?: {
    display_name: string;
  };
  is_liked_by_user?: boolean;
};

type SermonInsight = {
  verse: string;
  insight: string;
  sermonTitle: string;
  speaker: string;
  church: string;
};

export function VersePanel({ book, chapter, verse, onClose }: VersePanelProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'sermons' | 'community' | 'my-notes'>('sermons');
  const [myNote, setMyNote] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [communityNotes, setCommunityNotes] = useState<SharedNote[]>([]);
  const [sermonInsights, setSermonInsights] = useState<SermonInsight[]>([]);
  const [saving, setSaving] = useState(false);

  const verseRef = `${book} ${chapter}:${verse}`;

  useEffect(() => {
    loadSermonInsights();
    if (user) {
      loadMyNote();
      loadCommunityNotes();
    }
  }, [user, book, chapter, verse]);

  const loadSermonInsights = async () => {
    const { data } = await supabase
      .from('sermon_verse_insights')
      .select('verse, insight, sermons(title, speaker, church)')
      .order('verse');

    if (data) {
      const insights = data
        .filter((item: any) => {
          const parsedVerses = parseVerseReference(item.verse);
          return parsedVerses.some(parsed =>
            parsed.book === book && parsed.chapter === chapter && parsed.verse === verse
          );
        })
        .map((item: any) => ({
          verse: item.verse,
          insight: item.insight,
          sermonTitle: item.sermons?.title || 'Unknown',
          speaker: item.sermons?.speaker || 'Unknown',
          church: item.sermons?.church || 'Unknown',
        }));

      setSermonInsights(insights);
    }
  };

  const loadMyNote = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('book', book)
      .eq('chapter', chapter)
      .eq('verse', verse)
      .maybeSingle();

    if (data) {
      setMyNote(data.content);
      setNoteId(data.id);
      setIsPublic(data.is_public);
    } else {
      setMyNote('');
      setNoteId(null);
      setIsPublic(false);
    }
  };

  const loadCommunityNotes = async () => {
    if (!user) return;

    const { data: notesData } = await supabase
      .from('shared_notes')
      .select('*')
      .eq('book', book)
      .eq('chapter', chapter)
      .eq('verse', verse)
      .order('likes_count', { ascending: false });

    if (notesData) {
      const { data: likesData } = await supabase
        .from('note_likes')
        .select('note_id')
        .eq('user_id', user.id);

      const likedNoteIds = new Set(likesData?.map(like => like.note_id) || []);

      setCommunityNotes(notesData.map(note => ({
        ...note,
        profile: Array.isArray(note.profiles) ? note.profiles[0] : note.profiles,
        is_liked_by_user: likedNoteIds.has(note.id),
      })));
    }
  };

  const saveMyNote = async () => {
    if (!user) return;
    setSaving(true);

    try {
      if (noteId) {
        await supabase
          .from('notes')
          .update({ content: myNote, is_public: isPublic, updated_at: new Date().toISOString() })
          .eq('id', noteId);
      } else {
        const { data } = await supabase
          .from('notes')
          .insert({
            user_id: user.id,
            book,
            chapter,
            verse,
            content: myNote,
            is_public: isPublic,
          })
          .select()
          .single();

        if (data) {
          setNoteId(data.id);
        }
      }

      if (isPublic) {
        await syncToSharedNotes();
      }
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setSaving(false);
    }
  };

  const syncToSharedNotes = async () => {
    if (!user || !myNote || !isPublic) return;

    const { data: existing } = await supabase
      .from('shared_notes')
      .select('id')
      .eq('user_id', user.id)
      .eq('book', book)
      .eq('chapter', chapter)
      .eq('verse', verse)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('shared_notes')
        .update({ content: myNote, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('shared_notes')
        .insert({
          user_id: user.id,
          book,
          chapter,
          verse,
          content: myNote,
        });
    }

    loadCommunityNotes();
  };

  const togglePublic = async () => {
    const newPublicState = !isPublic;
    setIsPublic(newPublicState);

    if (noteId) {
      await supabase
        .from('notes')
        .update({ is_public: newPublicState })
        .eq('id', noteId);

      if (newPublicState) {
        await syncToSharedNotes();
      } else {
        await supabase
          .from('shared_notes')
          .delete()
          .eq('user_id', user?.id)
          .eq('book', book)
          .eq('chapter', chapter)
          .eq('verse', verse);
        loadCommunityNotes();
      }
    }
  };

  const toggleLike = async (noteId: string, isLiked: boolean) => {
    if (!user) return;

    if (isLiked) {
      await supabase
        .from('note_likes')
        .delete()
        .eq('user_id', user.id)
        .eq('note_id', noteId);

      await supabase.rpc('decrement_likes', { note_id: noteId });
    } else {
      await supabase
        .from('note_likes')
        .insert({ user_id: user.id, note_id: noteId });

      await supabase.rpc('increment_likes', { note_id: noteId });
    }

    loadCommunityNotes();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 animate-fadeIn">
      <div className="bg-[#faf8f4] w-full max-w-2xl rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col animate-slideUp">
        <div className="flex items-center justify-between p-6 border-b border-[#c49a5c]/20">
          <h3 className="text-xl font-serif text-[#2c1810]">{verseRef}</h3>
          <button
            onClick={onClose}
            className="text-[#2c1810]/60 hover:text-[#2c1810] transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-[#c49a5c]/20 overflow-x-auto">
          {(['sermons', 'community', 'my-notes'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-4 px-4 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'text-[#c49a5c] border-b-2 border-[#c49a5c]'
                  : 'text-[#2c1810]/60 hover:text-[#2c1810]'
              }`}
            >
              {tab === 'sermons' && 'Sermons'}
              {tab === 'community' && 'Community'}
              {tab === 'my-notes' && 'My Notes'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'sermons' && (
            <div className="space-y-6">
              {sermonInsights.length === 0 ? (
                <p className="text-[#2c1810]/60 text-center py-8">
                  No sermon insights for this verse yet.
                </p>
              ) : (
                sermonInsights.map((insight: any, idx: number) => (
                  <div key={idx} className="bg-white/60 rounded-lg p-4 border border-[#c49a5c]/20">
                    <h4 className="font-semibold text-[#2c1810] mb-2">{insight.sermonTitle}</h4>
                    <div className="flex items-center gap-2 text-sm text-[#2c1810]/70 mb-3">
                      <span>{insight.speaker}</span>
                      <span>•</span>
                      <span>{insight.church}</span>
                    </div>
                    <p className="text-[#2c1810] leading-relaxed">{insight.insight}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'community' && (
            <div className="space-y-4">
              {communityNotes.length === 0 ? (
                <p className="text-[#2c1810]/60 text-center py-8">
                  No community notes for this verse yet.
                </p>
              ) : (
                communityNotes.map(note => (
                  <div key={note.id} className="bg-white/60 rounded-lg p-4 border border-[#c49a5c]/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-[#2c1810]">
                        {note.profile?.display_name || getRandomCommunityName(note.user_id)}
                      </span>
                      <span className="text-sm text-[#2c1810]/60">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[#2c1810] leading-relaxed mb-3">{note.content}</p>
                    <button
                      onClick={() => toggleLike(note.id, note.is_liked_by_user || false)}
                      className={`flex items-center gap-2 text-sm transition-colors ${
                        note.is_liked_by_user
                          ? 'text-red-500 hover:text-red-600'
                          : 'text-[#2c1810]/60 hover:text-[#c49a5c]'
                      }`}
                    >
                      <Heart size={16} fill={note.is_liked_by_user ? 'currentColor' : 'none'} />
                      <span>{note.likes_count || 0}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'my-notes' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePublic}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                      isPublic
                        ? 'bg-[#c49a5c]/20 text-[#c49a5c]'
                        : 'bg-[#2c1810]/10 text-[#2c1810]/60'
                    }`}
                  >
                    {isPublic ? <Unlock size={16} /> : <Lock size={16} />}
                    <span className="text-sm font-medium">
                      {isPublic ? 'Public' : 'Private'}
                    </span>
                  </button>
                </div>
                {saving && <p className="text-sm text-[#c49a5c]">Saving...</p>}
                {!saving && myNote && <p className="text-sm text-[#2c1810]/60">Saved</p>}
              </div>
              <textarea
                value={myNote}
                onChange={(e) => setMyNote(e.target.value)}
                onBlur={saveMyNote}
                placeholder="Write your reflection on this verse..."
                className="w-full h-64 p-4 bg-white/60 border border-[#c49a5c]/20 rounded-lg text-[#2c1810] placeholder-[#2c1810]/40 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/50 font-serif leading-relaxed resize-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

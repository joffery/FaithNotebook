import { useState, useEffect } from 'react';
import { X, Heart, Lock, Unlock } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { parseVerseReference, getRandomCommunityName } from '../utils/verseParser';
import sermonsJson from '../data/sermons_processed.json';

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [likePendingIds, setLikePendingIds] = useState<Set<string>>(new Set());
  const [currentDisplayName, setCurrentDisplayName] = useState<string>('You');

  const verseRef = `${book} ${chapter}:${verse}`;

  useEffect(() => {
    loadSermonInsights();
    if (user) {
      loadCurrentDisplayName();
      loadMyNote();
      loadCommunityNotes();
    }
    // when the verse/book changes we should save whatever note is in progress
    return () => {
      // avoid calling on first render (user may be null), but always attempt
      // to persist the note when the panel unmounts or props change.
      saveMyNote();
    };
  }, [user, book, chapter, verse]);

  const loadCurrentDisplayName = async () => {
    if (!user) return;

    const fallback = user.email?.split('@')[0] || 'You';
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      setCurrentDisplayName(fallback);
      return;
    }

    setCurrentDisplayName(data?.display_name || fallback);
  };

  const loadSermonInsights = async () => {
    // first gather insights from the static JSON library
    const jsonInsights: SermonInsight[] = [];
    (sermonsJson as any[]).forEach(s => {
      (s.verse_insights || []).forEach((vi: any) => {
        const parsed = parseVerseReference(vi.verse);
        parsed.forEach(p => {
          if (p.book === book && p.chapter === chapter && p.verse === verse) {
            jsonInsights.push({
              verse: vi.verse,
              insight: vi.insight,
              sermonTitle: s.title,
              speaker: s.speaker,
              church: s.church,
            });
          }
        });
      });
    });

    let combined = [...jsonInsights];

    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('sermon_verse_insights')
        .select('verse, insight, sermons(title, speaker, church)')
        .order('verse');

      if (data) {
        const dbInsights = data
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

        // append DB ones, avoiding exact duplicates based on text
        dbInsights.forEach(i => {
          if (!combined.some(existing => existing.insight === i.insight && existing.sermonTitle === i.sermonTitle)) {
            combined.push(i);
          }
        });
      }
    }

    setSermonInsights(combined);
  };

  const loadMyNote = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('book', book)
      .eq('chapter', chapter)
      .eq('verse', verse)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error loading note:', error);
      return;
    }

    const row = data?.[0];

    if (row) {
      setMyNote(row.content);
      setNoteId(row.id);

      // backwards-compatible: older DB schema may not have notes.is_public
      if (typeof (row as any).is_public === 'boolean') {
        setIsPublic((row as any).is_public);
      } else {
        const { data: sharedData } = await supabase
          .from('shared_notes')
          .select('id')
          .eq('user_id', user.id)
          .eq('book', book)
          .eq('chapter', chapter)
          .eq('verse', verse)
          .maybeSingle();
        setIsPublic(!!sharedData);
      }
    } else {
      setMyNote('');
      setNoteId(null);
      setIsPublic(false);
    }
  };

  const loadCommunityNotes = async () => {
    if (!user) return;

    let { data: notesData, error: notesError } = await supabase
      .from('shared_notes')
      .select('*')
      .eq('book', book)
      .eq('chapter', chapter)
      .eq('verse', verse)
      .order('likes_count', { ascending: false });

    // compatibility fallback for older DB schema missing likes_count
    if (notesError && notesError.message?.toLowerCase().includes('likes_count')) {
      const fallback = await supabase
        .from('shared_notes')
        .select('*')
        .eq('book', book)
        .eq('chapter', chapter)
        .eq('verse', verse)
        .order('created_at', { ascending: false });

      notesData = fallback.data;
      notesError = fallback.error;
      setSaveError('Database schema is outdated: missing shared_notes.likes_count. Please run latest Supabase migrations.');
    }

    if (notesError) {
      console.error('Error loading shared notes:', notesError);
      setSaveError(notesError.message);

      // fallback: at least show the signed-in user's own public note for this verse
      if (isPublic && myNote.trim()) {
        setCommunityNotes([
          {
            id: `local-${book}-${chapter}-${verse}-${user.id}`,
            user_id: user.id,
            content: myNote,
            likes_count: 0,
            created_at: new Date().toISOString(),
            profile: { display_name: 'You' },
            is_liked_by_user: false,
          },
        ]);
      }

      return;
    }

    if (notesData) {
      const { data: likesData } = await supabase
        .from('note_likes')
        .select('note_id')
        .eq('user_id', user.id);

      const userIds = [...new Set((notesData || []).map((note: any) => note.user_id).filter(Boolean))];
      let profileMap = new Map<string, string>();

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', userIds);

        profileMap = new Map((profilesData || []).map((p: any) => [p.id, p.display_name]));
      }

      const likedNoteIds = new Set(likesData?.map(like => like.note_id) || []);

      setCommunityNotes(notesData.map(note => ({
        ...note,
        profile: {
          display_name:
            profileMap.get(note.user_id) ||
            (note.user_id === user.id ? currentDisplayName : getRandomCommunityName(note.user_id)),
        },
        is_liked_by_user: likedNoteIds.has(note.id),
      })));
    }
  };

  async function saveMyNote(publicOverride?: boolean): Promise<string | null> {
    if (!user) return null;
    if (!myNote.trim()) return null;

    const effectiveIsPublic = publicOverride ?? isPublic;
    setSaving(true);
    setSaveError(null);

    try {
      let activeNoteId = noteId;

      if (!activeNoteId) {
        const { data: existingRows, error: existingError } = await supabase
          .from('notes')
          .select('id')
          .eq('user_id', user.id)
          .eq('book', book)
          .eq('chapter', chapter)
          .eq('verse', verse)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (existingError) throw existingError;
        if (existingRows && existingRows.length > 0) {
          activeNoteId = existingRows[0].id;
          setNoteId(activeNoteId);
        }
      }

      if (activeNoteId) {
        let { error } = await supabase
          .from('notes')
          .update({ content: myNote, is_public: effectiveIsPublic, updated_at: new Date().toISOString() })
          .eq('id', activeNoteId);

        if (error && error.message?.toLowerCase().includes('is_public')) {
          const fallback = await supabase
            .from('notes')
            .update({ content: myNote, updated_at: new Date().toISOString() })
            .eq('id', activeNoteId);
          error = fallback.error;
        }

        if (error) throw error;
      } else {
        let { data, error } = await supabase
          .from('notes')
          .insert({
            user_id: user.id,
            book,
            chapter,
            verse,
            content: myNote,
            is_public: effectiveIsPublic,
          })
          .select()
          .single();

        if (error && error.message?.toLowerCase().includes('is_public')) {
          const fallback = await supabase
            .from('notes')
            .insert({
              user_id: user.id,
              book,
              chapter,
              verse,
              content: myNote,
            })
            .select()
            .single();

          data = fallback.data;
          error = fallback.error;
        }

        if (error) throw error;

        if (data) {
          activeNoteId = data.id;
          setNoteId(activeNoteId);
        }
      }

      if (effectiveIsPublic) {
        await syncToSharedNotes(true);
      }

      return activeNoteId || null;
    } catch (error) {
      console.error('Error saving note:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save note');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function syncToSharedNotes(forcePublic?: boolean) {
    const shouldShare = forcePublic ?? isPublic;
    if (!user || !myNote || !shouldShare) return;

    const { data: existingRows, error: existingError } = await supabase
      .from('shared_notes')
      .select('id')
      .eq('user_id', user.id)
      .eq('book', book)
      .eq('chapter', chapter)
      .eq('verse', verse)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (existingError) throw existingError;
    const existing = existingRows?.[0];

    if (existing) {
      const { error } = await supabase
        .from('shared_notes')
        .update({ content: myNote, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('shared_notes')
        .insert({
          user_id: user.id,
          book,
          chapter,
          verse,
          content: myNote,
        });
      if (error) throw error;
    }

    loadCommunityNotes();
  }

  const togglePublic = async () => {
    if (!user) return;

    const newPublicState = !isPublic;
    setIsPublic(newPublicState);
    setSaveError(null);

    // ensure note row exists first, then apply sharing state
    let currentNoteId = noteId;
    if (!currentNoteId && myNote.trim()) {
      currentNoteId = await saveMyNote(newPublicState);
    }

    if (currentNoteId) {
      const { error: noteUpdateError } = await supabase
        .from('notes')
        .update({ is_public: newPublicState })
        .eq('id', currentNoteId);

      if (noteUpdateError && !noteUpdateError.message?.toLowerCase().includes('is_public')) {
        setSaveError(noteUpdateError.message);
        return;
      }

      if (newPublicState) {
        try {
          await syncToSharedNotes(true);
        } catch (e) {
          setSaveError(e instanceof Error ? e.message : 'Failed to share note');
        }
      } else {
        const { error: deleteError } = await supabase
          .from('shared_notes')
          .delete()
          .eq('user_id', user?.id)
          .eq('book', book)
          .eq('chapter', chapter)
          .eq('verse', verse);

        if (deleteError) {
          setSaveError(deleteError.message);
          return;
        }

        loadCommunityNotes();
      }
    }
  };

  const toggleLike = async (noteId: string) => {
    if (!user) return;
    if (likePendingIds.has(noteId)) return;

    setLikePendingIds(prev => new Set(prev).add(noteId));

    const currentNote = communityNotes.find(note => note.id === noteId);
    const currentlyLiked = !!currentNote?.is_liked_by_user;

    try {
      if (currentlyLiked) {
        const { error: deleteLikeError, count: deletedCount } = await supabase
          .from('note_likes')
          .delete({ count: 'exact' })
          .eq('user_id', user.id)
          .eq('note_id', noteId)
          .select('id');

        if (deleteLikeError) throw deleteLikeError;

        if ((deletedCount || 0) > 0) {
          const { data: noteData } = await supabase
            .from('shared_notes')
            .select('likes_count')
            .eq('id', noteId)
            .maybeSingle();

          const current = (noteData?.likes_count ?? 0);
          const next = Math.max(0, current - 1);

          await supabase
            .from('shared_notes')
            .update({ likes_count: next })
            .eq('id', noteId);
        }
      } else {
        const { data: existingLikeRows, error: existingLikeError } = await supabase
          .from('note_likes')
          .select('id')
          .eq('user_id', user.id)
          .eq('note_id', noteId)
          .limit(1);

        if (existingLikeError) throw existingLikeError;

        if (!existingLikeRows || existingLikeRows.length === 0) {
          await supabase
            .from('note_likes')
            .insert({ user_id: user.id, note_id: noteId });

          const { data: noteData } = await supabase
            .from('shared_notes')
            .select('likes_count')
            .eq('id', noteId)
            .maybeSingle();

          const current = (noteData?.likes_count ?? 0);
          const next = current + 1;

          await supabase
            .from('shared_notes')
            .update({ likes_count: next })
            .eq('id', noteId);
        }
      }
    } catch (err) {
      // fallback to rpc in case of unexpected failure
      if (currentlyLiked) {
        await supabase.rpc('decrement_likes', { note_id: noteId });
      } else {
        await supabase.rpc('increment_likes', { note_id: noteId });
      }

      const message = err instanceof Error ? err.message : '';
      if (message.toLowerCase().includes('likes_count')) {
        setSaveError('Likes are unavailable until migration adds shared_notes.likes_count.');
      }
    } finally {
      await loadCommunityNotes();
      setLikePendingIds(prev => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    }
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
                      onClick={() => toggleLike(note.id)}
                      disabled={likePendingIds.has(note.id)}
                      className={`flex items-center gap-2 text-sm transition-colors ${
                        note.is_liked_by_user
                          ? 'text-red-500 hover:text-red-600'
                          : 'text-[#2c1810]/60 hover:text-[#c49a5c]'
                      } disabled:opacity-50`}
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
                  {/* explicit save button to avoid loss when user refreshes before blur */}
                  <button
                    onClick={() => { void saveMyNote(); }}
                    disabled={saving}
                    className="ml-4 px-3 py-1.5 bg-[#c49a5c] text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
                {saving && <p className="text-sm text-[#c49a5c]">Saving...</p>}
                {!saving && myNote && !saveError && <p className="text-sm text-[#2c1810]/60">Saved</p>}
              </div>
              {saveError && (
                <p className="text-sm text-red-500 mb-3">{saveError}</p>
              )}
              <textarea
                value={myNote}
                onChange={(e) => setMyNote(e.target.value)}
                onBlur={() => { void saveMyNote(); }}
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

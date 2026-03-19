import { useState, useEffect, useRef } from 'react';
import { X, Heart, Lock, Unlock, ThumbsUp, ThumbsDown, Copy, Check, Trash2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getBibleChapter, ensureBibleChapter } from '../data/bibleText';
import { parseVerseReference } from '../utils/verseParser';
import { formatSermonDate, getPrimarySermonDate, sortSermonsNewestFirst } from '../utils/sermonSorting';
import { ProfileAvatar } from './ProfileAvatar';

type VersePanelProps = {
  book: string;
  chapter: number;
  verse: number;
  onClose: () => void;
};

type SharedNote = {
  id: string;
  user_id: string;
  content: string;
  likes_count: number;
  created_at: string;
  profile?: {
    display_name: string;
    username?: string | null;
    avatar_url?: string | null;
  };
  is_liked_by_user?: boolean;
};

type SermonGroup = {
  sermonId: string;
  title: string;
  speaker: string;
  church: string;
  youtubeUrl: string;
  summary: string;
  relevantText: string | null;
  isSummaryFallback: boolean;
  matchType: 'exact' | 'broader';
  matchedReference: string | null;
  youtubePublishedAt?: string | null;
};

function trimToSentences(text: string, max: number): string {
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.slice(0, max).join(' ').trim();
}

const parseVerseInsights = (value: unknown): { verse: string; insight: string }[] => {
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

const normalizeVerseReference = (value: string) =>
  value
    .replace(/[–—]/g, '-')
    .replace(/\s*:\s*/g, ':')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const matchesVerseReference = (candidate: string, book: string, chapter: number, verse: number) => {
  const parsed = parseVerseReference(normalizeVerseReference(candidate));
  return parsed.some((item) => item.book === book && item.chapter === chapter && item.verse === verse);
};

const isMissingProfileFieldError = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return message.includes('username') || message.includes('avatar_url');
};

const isUniqueConstraintError = (error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return code === '23505' || message.includes('duplicate key') || message.includes('unique constraint');
};

const isMissingNoteLikesTableError = (error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
  return code === '42P01' || message.includes('note_likes') || message.includes('relation') && message.includes('does not exist');
};

export function VersePanel({ book, chapter, verse, onClose }: VersePanelProps) {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'sermons' | 'community' | 'my-notes'>('sermons');
  const [myNote, setMyNote] = useState('');
  const [noteId, setNoteId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [communityNotes, setCommunityNotes] = useState<SharedNote[]>([]);
  const [sermonGroups, setSermonGroups] = useState<SermonGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [likePendingIds, setLikePendingIds] = useState<Set<string>>(new Set());
  const [currentDisplayName, setCurrentDisplayName] = useState<string>('You');
  const [expandedSermonIds, setExpandedSermonIds] = useState<Set<string>>(new Set());
  const [sermonFeedbackById, setSermonFeedbackById] = useState<Record<string, 'helpful' | 'not_relevant'>>({});
  const [verseText, setVerseText] = useState('');
  const [copiedVerse, setCopiedVerse] = useState(false);
  const sermonCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const verseRef = `${book} ${chapter}:${verse}`;

  useEffect(() => {
    loadSermonChunks();
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

  useEffect(() => {
    setSaveError(null);
  }, [activeTab]);

  useEffect(() => {
    setExpandedSermonIds(
      new Set(
        sermonGroups
          .filter((group) => group.matchType === 'exact')
          .map((group) => group.sermonId)
      )
    );
  }, [sermonGroups]);

  useEffect(() => {
    let mounted = true;

    const loadVerseText = async () => {
      let chapterData = getBibleChapter(book, chapter);
      if (!chapterData) {
        chapterData = await ensureBibleChapter(book, chapter, false);
      }

      if (!mounted) return;

      const matchedVerse = chapterData?.verses.find((item) => item.verse === verse);
      setVerseText(matchedVerse?.text || '');
    };

    void loadVerseText();

    return () => {
      mounted = false;
    };
  }, [book, chapter, verse]);

  const loadCurrentDisplayName = async () => {
    if (!user) return;

    const fallback =
      profile?.display_name?.trim() ||
      profile?.username?.trim() ||
      user.email?.split('@')[0] ||
      'You';
    let { data, error } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', user.id)
      .maybeSingle();

    if (error && isMissingProfileFieldError(error)) {
      const fallback = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();
      data = fallback.data as any;
      error = fallback.error;
    }

    if (error) {
      setCurrentDisplayName(fallback);
      return;
    }

    setCurrentDisplayName(data?.display_name?.trim() || data?.username?.trim() || fallback);
  };

  const loadSermonChunks = async () => {
    if (!isSupabaseConfigured) return;

    const chapterRef = `${book} ${chapter}`;
    const chapterPrefix = `${book} ${chapter}:`;
    const baseFields = 'id, title, speaker, church, youtube_url, verse_insights, summary, verses, processed_at';
    const fieldsWithPublishedAt = `${baseFields}, youtube_published_at`;

    console.log('VersePanel sermon query refs:', {
      verseRef,
      chapterRef,
    });

    let { data, error } = await supabase
      .from('sermons')
      .select(fieldsWithPublishedAt);

    if (error && error.message?.toLowerCase().includes('youtube_published_at')) {
      const fallback = await supabase
        .from('sermons')
        .select(baseFields);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error('VersePanel sermon query error:', error);
      setSermonGroups([]);
      return;
    }

    const sortedRows = sortSermonsNewestFirst(data || []);

    console.log('VersePanel sermon query data:', sortedRows);

    const matchedRows = sortedRows.filter((row: any) => {
      const vis = parseVerseInsights(row.verse_insights);
      const hasExactInsight = vis.some((vi: { verse: string }) => matchesVerseReference(vi.verse, book, chapter, verse));
      const hasChapterInsight = vis.some((vi: { verse: string }) => vi.verse?.startsWith(chapterPrefix));

      return hasExactInsight || hasChapterInsight;
    });

    console.log('VersePanel sermon matched data:', matchedRows);

    const groups = matchedRows
      .map((row: any): SermonGroup | null => {
        const vis = parseVerseInsights(row.verse_insights);
        const exact = vis.find((vi: { verse: string }) => matchesVerseReference(vi.verse, book, chapter, verse));
        const chMatch = vis.find((vi: { verse: string }) => vi.verse?.startsWith(chapterPrefix));
        const hasExactInsight = !!exact;
        const insightText = exact?.insight || chMatch?.insight || null;
        const summary = trimToSentences(row.summary || '', 3);
        const matchType: SermonGroup['matchType'] = hasExactInsight ? 'exact' : 'broader';
        const matchedReference = exact?.verse || chMatch?.verse || null;

        if (!insightText) {
          return null;
        }

        return {
          sermonId: row.id,
          title: row.title || 'Unknown Sermon',
          speaker: row.speaker || '',
          church: row.church || '',
          youtubeUrl: row.youtube_url || '',
          summary,
          relevantText: insightText,
          isSummaryFallback: !insightText,
          matchType,
          matchedReference,
          youtubePublishedAt: getPrimarySermonDate(row),
        };
      })
      .filter((group): group is SermonGroup => group !== null);

    setSermonGroups(groups);
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
      let likesData: any[] | null = null;
      const { data: rawLikesData, error: likesError } = await supabase
        .from('note_likes')
        .select('note_id')
        .eq('user_id', user.id);

      if (likesError && !isMissingNoteLikesTableError(likesError)) {
        console.error('Error loading note likes:', likesError);
      } else {
        likesData = rawLikesData;
      }

      const userIds = [...new Set((notesData || []).map((note: any) => note.user_id).filter(Boolean))];
      let profileMap = new Map<string, { display_name?: string | null; username?: string | null; avatar_url?: string | null }>();

      if (userIds.length > 0) {
        let { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', userIds);

        if (profilesError && isMissingProfileFieldError(profilesError)) {
          const fallback = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', userIds);
          profilesData = fallback.data as any;
          profilesError = fallback.error;
        }

        if (!profilesError) {
          profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
        }
      }

      const likedNoteIds = new Set(likesData?.map((like: any) => like.note_id) || []);

      setCommunityNotes(notesData.map((note: any) => ({
        ...note,
        profile: {
          display_name:
            profileMap.get(note.user_id)?.display_name?.trim() ||
            profileMap.get(note.user_id)?.username?.trim() ||
            (note.user_id === user.id ? currentDisplayName : 'Church Member'),
          username: profileMap.get(note.user_id)?.username || null,
          avatar_url: profileMap.get(note.user_id)?.avatar_url || null,
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
          const next = Math.max(0, current - (deletedCount || 0));

          const { error: updateLikesError } = await supabase
            .from('shared_notes')
            .update({ likes_count: next })
            .eq('id', noteId);

          if (updateLikesError) throw updateLikesError;
        }
      } else {
        const { error: insertLikeError } = await supabase
          .from('note_likes')
          .insert({ user_id: user.id, note_id: noteId });

        if (insertLikeError) {
          if (isUniqueConstraintError(insertLikeError)) {
            return;
          }
          if (isMissingNoteLikesTableError(insertLikeError)) {
            setSaveError('Likes are not ready yet. Please run the latest Supabase migrations for note likes.');
            return;
          }
          throw insertLikeError;
        }

        const { data: noteData, error: noteDataError } = await supabase
          .from('shared_notes')
          .select('likes_count')
          .eq('id', noteId)
          .maybeSingle();

        if (noteDataError) throw noteDataError;

        const current = (noteData?.likes_count ?? 0);
        const next = current + 1;

        const { error: updateLikesError } = await supabase
          .from('shared_notes')
          .update({ likes_count: next })
          .eq('id', noteId);

        if (updateLikesError) throw updateLikesError;
      }
    } catch (err) {
      console.error('Error toggling note like:', err);

      const message = err instanceof Error ? err.message : '';
      if (isMissingNoteLikesTableError(err)) {
        setSaveError('Likes are not ready yet. Please run the latest Supabase migrations for note likes.');
      } else if (message.toLowerCase().includes('likes_count')) {
        setSaveError('Likes are unavailable until migration adds shared_notes.likes_count.');
      } else if (!isUniqueConstraintError(err)) {
        setSaveError('We could not update that like just now.');
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

  const deleteMyNote = async () => {
    if (!user || !noteId) return;
    if (typeof window !== 'undefined' && !window.confirm('Delete this note? This will also remove it from shared notes.')) {
      return;
    }

    setDeleting(true);
    setSaveError(null);

    try {
      const { data: sharedRows, error: sharedLookupError } = await supabase
        .from('shared_notes')
        .select('id')
        .eq('user_id', user.id)
        .eq('book', book)
        .eq('chapter', chapter)
        .eq('verse', verse);

      if (sharedLookupError) throw sharedLookupError;

      const sharedIds = (sharedRows || []).map((row: { id: string }) => row.id);

      if (sharedIds.length > 0) {
        const { error: deleteLikesError } = await supabase
          .from('note_likes')
          .delete()
          .in('note_id', sharedIds);

        if (deleteLikesError && !String(deleteLikesError.message || '').toLowerCase().includes('note_likes')) {
          throw deleteLikesError;
        }

        const { error: deleteSharedError } = await supabase
          .from('shared_notes')
          .delete()
          .in('id', sharedIds);

        if (deleteSharedError) throw deleteSharedError;
      }

      const { error: deleteNoteError } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId)
        .eq('user_id', user.id);

      if (deleteNoteError) throw deleteNoteError;

      setMyNote('');
      setNoteId(null);
      setIsPublic(false);
      await loadCommunityNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to delete note');
    } finally {
      setDeleting(false);
    }
  };

  const submitSermonFeedback = async (group: SermonGroup, isHelpful: boolean) => {
    setSermonFeedbackById((prev) => ({
      ...prev,
      [group.sermonId]: isHelpful ? 'helpful' : 'not_relevant',
    }));

    try {
      await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surface: 'verse_match',
          question: verseRef,
          answer: `${group.title}\n${group.relevantText || group.summary || ''}`.trim(),
          feedbackKind: isHelpful ? 'match_helpful' : 'match_not_relevant',
          targetRef: group.matchedReference || verseRef,
          targetId: group.sermonId,
        }),
      });
    } catch (error) {
      console.error('Failed to save sermon match feedback:', error);
    }
  };

  const toggleSermonExpanded = (sermonId: string, trigger?: HTMLButtonElement | null) => {
    const willOpen = !expandedSermonIds.has(sermonId);
    trigger?.blur();

    setExpandedSermonIds((prev) => {
      const next = new Set(prev);
      if (next.has(sermonId)) {
        next.delete(sermonId);
      } else {
        next.add(sermonId);
      }
      return next;
    });

    if (willOpen) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          sermonCardRefs.current[sermonId]?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        });
      });
    }
  };

  const handleCopyScripture = async () => {
    const textToCopy = verseText ? `${verseRef} — ${verseText}` : verseRef;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedVerse(true);
      window.setTimeout(() => setCopiedVerse(false), 1800);
    } catch (error) {
      console.error('Failed to copy scripture:', error);
    }
  };

  const exactMatches = sermonGroups.filter((group) => group.matchType === 'exact');
  const broaderMatches = sermonGroups.filter((group) => group.matchType === 'broader');

  return (
    <div className="fixed inset-0 bg-black/45 flex items-end justify-center z-[95] animate-fadeIn">
      <div className="bg-[#faf8f4] w-full max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[80vh] rounded-none sm:rounded-t-2xl shadow-2xl flex flex-col animate-slideUp">
        <div className="flex items-center justify-between px-5 py-5 sm:p-6 border-b border-[#c49a5c]/20">
          <h3 className="text-xl font-serif text-[#2c1810]">{verseRef}</h3>
          <button
            onClick={onClose}
            className="text-[#2c1810]/60 hover:text-[#2c1810] transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-[#c49a5c]/20 overflow-x-auto bg-[#faf8f4]">
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

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 sm:pb-6">
          <div className="mb-6 rounded-xl border border-[#c49a5c]/18 bg-white/65 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2c1810]/45 mb-2">
                  Scripture
                </p>
                <p className="text-lg font-serif leading-relaxed text-[#2c1810]">
                  {verseText || verseRef}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyScripture}
                className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-[#c49a5c]/20 bg-white px-3 py-2 text-xs font-medium text-[#2c1810]/75 hover:bg-[#c49a5c]/10 hover:text-[#2c1810] transition-colors"
              >
                {copiedVerse ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedVerse ? 'Copied' : 'Copy Scripture'}</span>
              </button>
            </div>
          </div>

          {activeTab === 'sermons' && (
            <div className="space-y-6">
              {sermonGroups.length === 0 ? (
                <p className="text-[#2c1810]/60 text-center py-8">
                  No sermon content found for this verse yet.
                </p>
              ) : (
                <>
                  {exactMatches.length > 0 && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-[#2c1810]/50 uppercase tracking-wide mb-1">
                          Directly About {verseRef}
                        </p>
                        <p className="text-sm text-[#2c1810]/60">
                          Sermons that directly mention or explain this exact verse.
                        </p>
                      </div>
                      {exactMatches.map((group) => renderSermonCard(group))}
                    </div>
                  )}

                  {broaderMatches.length > 0 && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-[#2c1810]/50 uppercase tracking-wide mb-1">
                          More From {book} {chapter}
                        </p>
                        <p className="text-sm text-[#2c1810]/60">
                          Broader chapter-level sermons that may still help with context.
                        </p>
                      </div>
                      {broaderMatches.map((group) => renderSermonCard(group))}
                    </div>
                  )}
                </>
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
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <ProfileAvatar
                          displayName={note.profile?.display_name}
                          avatarUrl={note.profile?.avatar_url}
                          size="sm"
                        />
                        <span className="font-medium text-[#2c1810] truncate">
                          {note.profile?.display_name || 'Church Member'}
                        </span>
                      </div>
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
              <div className="mb-4 rounded-xl border border-[#c49a5c]/18 bg-white/55 px-4 py-3">
                <p className="text-sm font-medium text-[#2c1810]">Write your own reflection on this Scripture.</p>
                <p className="mt-1 text-sm text-[#2c1810]/62 leading-relaxed">
                  Keep it private, or share it so other disciples can be encouraged by what you learned from this verse.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-2">
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
                      {isPublic ? 'Shared' : 'Private'}
                    </span>
                  </button>
                  {/* explicit save button to avoid loss when user refreshes before blur */}
                  <button
                    onClick={() => { void saveMyNote(); }}
                    disabled={saving || deleting}
                    className="sm:ml-4 px-3 py-1.5 bg-[#c49a5c] text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  {noteId && (
                    <button
                      onClick={() => { void deleteMyNote(); }}
                      disabled={saving || deleting}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 text-sm hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                      <span>{deleting ? 'Deleting…' : 'Delete'}</span>
                    </button>
                  )}
                </div>
                {(saving || deleting) && (
                  <p className="text-sm text-[#c49a5c]">{deleting ? 'Deleting…' : 'Saving...'}</p>
                )}
                {!saving && !deleting && myNote && !saveError && <p className="text-sm text-[#2c1810]/60">Saved</p>}
              </div>
              {saveError && (
                <p className="text-sm text-red-500 mb-3">{saveError}</p>
              )}
              <textarea
                value={myNote}
                onChange={(e) => setMyNote(e.target.value)}
                onBlur={() => { void saveMyNote(); }}
                disabled={deleting}
                placeholder="Write what stands out to you, what you want to obey, or what you want to remember from this verse..."
                className="w-full h-64 p-4 bg-white/60 border border-[#c49a5c]/20 rounded-lg text-[#2c1810] placeholder-[#2c1810]/40 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/50 font-serif leading-relaxed resize-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function renderSermonCard(group: SermonGroup) {
    const isOpen = expandedSermonIds.has(group.sermonId);
    const sermonDate = formatSermonDate(group.youtubePublishedAt);

    return (
      <div
        key={group.sermonId}
        ref={(node) => {
          sermonCardRefs.current[group.sermonId] = node;
        }}
        className="bg-white/60 rounded-lg border border-[#c49a5c]/20 overflow-hidden scroll-mt-4"
      >
        <button
          onClick={(e) => toggleSermonExpanded(group.sermonId, e.currentTarget)}
          className="w-full text-left p-4"
        >
          <h4 className="font-semibold text-[#2c1810] mb-1">{group.title}</h4>
          <div className="flex items-center gap-2 text-sm text-[#2c1810]/70">
            {group.speaker && <span>{group.speaker}</span>}
            {group.speaker && group.church && <span>•</span>}
            {group.church && <span>{group.church}</span>}
          </div>
          {sermonDate && (
            <p className="text-xs text-[#2c1810]/50 mt-1">{sermonDate}</p>
          )}
        </button>

        {isOpen && (
          <div className="px-4 pb-4 border-t border-[#c49a5c]/10 pt-3 space-y-3">
            {group.summary && (
              <div>
                <p className="text-xs font-semibold text-[#2c1810]/50 uppercase tracking-wide mb-1">Summary</p>
                <p className="text-[#2c1810] leading-relaxed text-sm">{group.summary}</p>
              </div>
            )}

            {group.relevantText && !group.isSummaryFallback && (
              <div>
                <p className="text-xs font-semibold text-[#2c1810]/50 uppercase tracking-wide mb-1">
                  Related To {group.matchType === 'exact' ? verseRef : (group.matchedReference || `${book} ${chapter}`)}
                </p>
                <p className="text-[#2c1810] leading-relaxed text-sm">{group.relevantText}</p>
              </div>
            )}

            {group.youtubeUrl && (
              <a
                href={group.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-[#c49a5c] hover:underline"
              >
                ▶ Watch on YouTube
              </a>
            )}

            <div className="pt-1">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#2c1810]/42 mb-2">
                Was this sermon match useful?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => submitSermonFeedback(group, true)}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    sermonFeedbackById[group.sermonId] === 'helpful'
                      ? 'bg-[#c49a5c]/16 text-[#2c1810]'
                      : 'text-[#2c1810]/60 hover:bg-[#c49a5c]/10 hover:text-[#2c1810]'
                  }`}
                >
                  <ThumbsUp size={14} />
                  <span>Helpful</span>
                </button>
                <button
                  onClick={() => submitSermonFeedback(group, false)}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    sermonFeedbackById[group.sermonId] === 'not_relevant'
                      ? 'bg-[#c49a5c]/16 text-[#2c1810]'
                      : 'text-[#2c1810]/60 hover:bg-[#c49a5c]/10 hover:text-[#2c1810]'
                  }`}
                >
                  <ThumbsDown size={14} />
                  <span>Not relevant</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

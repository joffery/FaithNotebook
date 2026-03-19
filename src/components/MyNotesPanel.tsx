import { useEffect, useState } from 'react';
import { BookOpen, ChevronRight, FileText, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type MyNotesPanelProps = {
  onClose: () => void;
  onOpenNote: (book: string, chapter: number, verse: number) => void;
};

type NoteRow = {
  id: string;
  book: string;
  chapter: number;
  verse: number;
  content: string;
  updated_at: string;
  is_public?: boolean;
};

const trimPreview = (text: string, max = 180) => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}...`;
};

export function MyNotesPanel({ onClose, onOpenNote }: MyNotesPanelProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredNotes = normalizedQuery
    ? notes.filter((note) => {
        const reference = `${note.book} ${note.chapter}:${note.verse}`.toLowerCase();
        const chapterReference = `${note.book} ${note.chapter}`.toLowerCase();
        const content = note.content.toLowerCase();
        return (
          reference.includes(normalizedQuery) ||
          chapterReference.includes(normalizedQuery) ||
          content.includes(normalizedQuery)
        );
      })
    : notes;

  useEffect(() => {
    let mounted = true;

    const loadNotes = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      let { data, error: notesError } = await supabase
        .from('notes')
        .select('id, book, chapter, verse, content, updated_at, is_public')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (notesError && notesError.message?.toLowerCase().includes('is_public')) {
        const fallback = await supabase
          .from('notes')
          .select('id, book, chapter, verse, content, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });
        data = fallback.data as any;
        notesError = fallback.error;
      }

      if (!mounted) return;

      if (notesError) {
        console.error('Error loading my notes:', notesError);
        setError('We could not load your notes right now.');
        setLoading(false);
        return;
      }

      setNotes((data || []) as NoteRow[]);
      setLoading(false);
    };

    void loadNotes();

    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <div className="fixed inset-0 z-[65] bg-black/45 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-[#faf8f4] shadow-2xl border border-[#c49a5c]/20 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#c49a5c]/20">
          <div>
            <h2 className="text-xl font-serif text-[#2c1810]">My Notes</h2>
            <p className="text-sm text-[#2c1810]/60 mt-1">
              Reopen a verse where you already wrote something.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#2c1810]/55 hover:bg-[#c49a5c]/10 hover:text-[#2c1810] transition-colors"
            aria-label="Close my notes"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-16 text-center text-[#2c1810]/60">
              Loading your notes...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#c49a5c]/12 text-[#c49a5c]">
                <FileText size={20} />
              </div>
              <p className="text-[#2c1810] font-medium">No notes yet</p>
              <p className="mt-2 text-sm text-[#2c1810]/60">
                Tap any verse while reading and start writing. Your notes will show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2c1810]/35" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by verse, chapter, or note text"
                    className="w-full rounded-xl border border-[#c49a5c]/20 bg-white pl-10 pr-4 py-3 text-[#2c1810] placeholder-[#2c1810]/35 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45"
                  />
                </div>
                <p className="text-xs uppercase tracking-[0.18em] text-[#2c1810]/42">
                  Showing {filteredNotes.length} of {notes.length} notes
                </p>
              </div>

              {filteredNotes.length === 0 ? (
                <div className="rounded-2xl border border-[#c49a5c]/20 bg-white/70 px-4 py-6 text-center">
                  <p className="text-[#2c1810] font-medium">No notes match that search</p>
                  <p className="mt-2 text-sm text-[#2c1810]/60">
                    Try a verse like `Acts 2:38`, a chapter like `John 3`, or a word from your note.
                  </p>
                </div>
              ) : (
                filteredNotes.map((note) => (
                <button
                  key={note.id}
                  onClick={() => onOpenNote(note.book, note.chapter, note.verse)}
                  className="w-full rounded-2xl border border-[#c49a5c]/20 bg-white/70 p-4 text-left hover:bg-[#c49a5c]/8 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[#2c1810]">
                        <BookOpen size={16} className="text-[#c49a5c] flex-shrink-0" />
                        <span className="font-medium">{note.book} {note.chapter}:{note.verse}</span>
                        {note.is_public ? (
                          <span className="rounded-full bg-[#c49a5c]/12 px-2 py-0.5 text-[11px] font-medium text-[#8c6430]">
                            Shared
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-[#2c1810]/78">
                        {trimPreview(note.content)}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#2c1810]/42">
                        Updated {new Date(note.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-[#2c1810]/35 flex-shrink-0" />
                  </div>
                </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Book, ChevronDown, MessageCircle, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { bibleBooks } from '../data/bibleBooks';
import { ProfileAvatar } from './ProfileAvatar';
import { getSermonReferenceIndex, hasBookSermons, hasChapterSermons, SermonReferenceIndex } from '../utils/sermonReferences';

type NavigationProps = {
  currentBook: string;
  currentChapter: number;
  onNavigate: (book: string, chapter: number) => void;
  onOpenAIChat: () => void;
  onOpenSermons: () => void;
  onOpenProfile: () => void;
  onOpenSearch: () => void;
};

export function Navigation({
  currentBook,
  currentChapter,
  onNavigate,
  onOpenAIChat,
  onOpenSermons,
  onOpenProfile,
  onOpenSearch,
}: NavigationProps) {
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const [sermonReferenceIndex, setSermonReferenceIndex] = useState<SermonReferenceIndex | null>(null);
  const { profile } = useAuth();

  const currentBookData = bibleBooks.find(b => b.name === currentBook);
  const chapters = currentBookData ? Array.from({ length: currentBookData.chapters }, (_, i) => i + 1) : [];
  const currentBookHasSermons = hasBookSermons(sermonReferenceIndex, currentBook);
  const currentChapterHasSermons = hasChapterSermons(sermonReferenceIndex, currentBook, currentChapter);
  const profileName = profile?.display_name || profile?.username || 'Profile';
  const oldTestamentBooks = bibleBooks.slice(0, 39);
  const newTestamentBooks = bibleBooks.slice(39);

  useEffect(() => {
    let mounted = true;

    getSermonReferenceIndex().then((index) => {
      if (mounted) setSermonReferenceIndex(index);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <div className="bg-white/60 border-b border-[#c49a5c]/20 py-4 px-6 sticky top-0 backdrop-blur-sm z-40">
        <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Book className="text-[#c49a5c] flex-shrink-0" size={24} />
            <h1 className="text-xl font-serif text-[#2c1810] leading-tight">Faith Notebook</h1>
          </div>

          <button
            onClick={onOpenProfile}
            className="flex flex-shrink-0 items-center gap-2 px-3 py-2 bg-white border border-[#c49a5c]/30 rounded-lg text-[#2c1810] hover:bg-[#c49a5c]/10 transition-colors"
            aria-label="Open profile settings"
          >
            <ProfileAvatar
              displayName={profileName}
              avatarUrl={profile?.avatar_url}
              size="sm"
            />
            <span className="hidden md:inline font-medium">{profileName}</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-3 whitespace-nowrap">
          <button
            onClick={onOpenSermons}
            className="flex flex-shrink-0 items-center gap-2 px-4 py-2 bg-white border border-[#c49a5c]/30 text-[#2c1810] rounded-lg hover:bg-[#c49a5c]/10 transition-colors"
          >
            <span className="font-medium">Sermons</span>
          </button>

          <button
            onClick={onOpenAIChat}
            className="flex flex-shrink-0 items-center gap-2 px-4 py-2 bg-[#c49a5c] text-white rounded-lg hover:bg-[#b38a4d] transition-colors"
          >
            <MessageCircle size={20} />
            <span className="font-medium">AI Chat</span>
          </button>

          <button
            onClick={onOpenSearch}
            className="flex flex-shrink-0 items-center gap-2 px-4 py-2 bg-white border border-[#c49a5c]/30 text-[#2c1810] rounded-lg hover:bg-[#c49a5c]/10 transition-colors"
          >
            <Search size={18} />
            <span className="font-medium">Search</span>
          </button>

          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowBookPicker(!showBookPicker)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#c49a5c]/30 rounded-lg text-[#2c1810] hover:bg-[#c49a5c]/10 transition-colors"
            >
              <span className="font-medium">{currentBook}</span>
              {currentBookHasSermons && <span className="w-2 h-2 rounded-full bg-[#c49a5c]" />}
              <ChevronDown size={16} />
            </button>

            {showBookPicker && (
              <div className="absolute top-full mt-2 right-0 w-64 max-h-96 overflow-y-auto bg-white border border-[#c49a5c]/30 rounded-lg shadow-xl z-50">
                <div className="p-2 flex flex-col gap-1 whitespace-normal">
                  {bibleBooks.map(book => (
                    <button
                      key={book.name}
                      onClick={() => {
                        onNavigate(book.name, 1);
                        setShowBookPicker(false);
                      }}
                      className={`block w-full text-left px-3 py-2 rounded hover:bg-[#c49a5c]/10 transition-colors ${
                        book.name === currentBook ? 'bg-[#c49a5c]/20 font-semibold' : ''
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>{book.name}</span>
                        {hasBookSermons(sermonReferenceIndex, book.name) && (
                          <span className="w-2 h-2 rounded-full bg-[#c49a5c] flex-shrink-0" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowChapterPicker(!showChapterPicker)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#c49a5c]/30 rounded-lg text-[#2c1810] hover:bg-[#c49a5c]/10 transition-colors"
            >
              <span className="font-medium">Chapter {currentChapter}</span>
              {currentChapterHasSermons && <span className="w-2 h-2 rounded-full bg-[#c49a5c]" />}
              <ChevronDown size={16} />
            </button>

            {showChapterPicker && (
              <div className="absolute top-full mt-2 right-0 w-64 max-h-96 overflow-y-auto bg-white border border-[#c49a5c]/30 rounded-lg shadow-xl z-50">
                <div className="p-2 grid grid-cols-5 gap-1">
                  {chapters.map(ch => (
                    <button
                      key={ch}
                      onClick={() => {
                        onNavigate(currentBook, ch);
                        setShowChapterPicker(false);
                      }}
                      className={`relative px-3 py-2 rounded hover:bg-[#c49a5c]/10 transition-colors ${
                        ch === currentChapter ? 'bg-[#c49a5c]/20 font-semibold' : ''
                      }`}
                    >
                      {ch}
                      {hasChapterSermons(sermonReferenceIndex, currentBook, ch) && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#c49a5c]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:hidden">
          <button
            onClick={() => setShowBookPicker(true)}
            className="flex items-center justify-between gap-2 px-4 py-3 bg-white border border-[#c49a5c]/30 rounded-xl text-[#2c1810] hover:bg-[#c49a5c]/10 transition-colors"
          >
            <span className="font-medium truncate">{currentBook}</span>
            <span className="flex items-center gap-2 flex-shrink-0">
              {currentBookHasSermons && <span className="w-2 h-2 rounded-full bg-[#c49a5c]" />}
              <ChevronDown size={16} />
            </span>
          </button>

          <button
            onClick={() => setShowChapterPicker(true)}
            className="flex items-center justify-between gap-2 px-4 py-3 bg-white border border-[#c49a5c]/30 rounded-xl text-[#2c1810] hover:bg-[#c49a5c]/10 transition-colors"
          >
            <span className="font-medium truncate">Chapter {currentChapter}</span>
            <span className="flex items-center gap-2 flex-shrink-0">
              {currentChapterHasSermons && <span className="w-2 h-2 rounded-full bg-[#c49a5c]" />}
              <ChevronDown size={16} />
            </span>
          </button>
        </div>

        <div className="sm:hidden mt-3">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-[#c49a5c]/30 rounded-xl text-[#2c1810] hover:bg-[#c49a5c]/10 transition-colors"
          >
            <Search size={18} />
            <span className="font-medium">Search Bible</span>
          </button>
        </div>
        </div>
      </div>

      {showChapterPicker && (
        <div className="sm:hidden fixed inset-0 z-[90] bg-[#faf8f4] overflow-y-auto">
          <div className="sticky top-0 bg-[#faf8f4]/95 backdrop-blur-sm border-b border-[#c49a5c]/20 px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => setShowChapterPicker(false)}
              className="text-[#2c1810] text-lg"
            >
              Cancel
            </button>
            <h2 className="text-xl font-serif text-[#2c1810]">{currentBook}</h2>
            <div className="w-12" />
          </div>

          <div className="px-4 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2c1810]/45 mb-3">Choose a Chapter</p>
            <div className="grid grid-cols-4 gap-3">
              {chapters.map((ch) => (
                <button
                  key={ch}
                  onClick={() => {
                    onNavigate(currentBook, ch);
                    setShowChapterPicker(false);
                  }}
                  className={`relative rounded-xl border px-3 py-4 text-lg transition-colors ${
                    ch === currentChapter
                      ? 'border-[#c49a5c] bg-[#c49a5c]/16 text-[#2c1810] font-semibold'
                      : 'border-[#c49a5c]/20 bg-white text-[#2c1810]'
                  }`}
                >
                  {ch}
                  {hasChapterSermons(sermonReferenceIndex, currentBook, ch) && (
                    <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#c49a5c]" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showBookPicker && (
        <div className="sm:hidden fixed inset-0 z-[90] bg-[#faf8f4] overflow-y-auto">
          <div className="sticky top-0 bg-[#faf8f4]/95 backdrop-blur-sm border-b border-[#c49a5c]/20 px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => setShowBookPicker(false)}
              className="text-[#2c1810] text-lg"
            >
              Cancel
            </button>
            <h2 className="text-xl font-serif text-[#2c1810]">Books</h2>
            <div className="w-12" />
          </div>

          <div className="px-4 py-5 pb-28 space-y-6">
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2c1810]/45 mb-3">Old Testament</p>
              <div className="grid grid-cols-2 gap-3">
                {oldTestamentBooks.map((book) => (
                  <button
                    key={book.name}
                    onClick={() => {
                      onNavigate(book.name, 1);
                      setShowBookPicker(false);
                    }}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      book.name === currentBook
                        ? 'border-[#c49a5c] bg-[#c49a5c]/16 text-[#2c1810] font-semibold'
                        : 'border-[#c49a5c]/20 bg-white text-[#2c1810]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{book.name}</span>
                      {hasBookSermons(sermonReferenceIndex, book.name) && (
                        <span className="w-2 h-2 rounded-full bg-[#c49a5c] flex-shrink-0" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2c1810]/45 mb-3">New Testament</p>
              <div className="grid grid-cols-2 gap-3">
                {newTestamentBooks.map((book) => (
                  <button
                    key={book.name}
                    onClick={() => {
                      onNavigate(book.name, 1);
                      setShowBookPicker(false);
                    }}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      book.name === currentBook
                        ? 'border-[#c49a5c] bg-[#c49a5c]/16 text-[#2c1810] font-semibold'
                        : 'border-[#c49a5c]/20 bg-white text-[#2c1810]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{book.name}</span>
                      {hasBookSermons(sermonReferenceIndex, book.name) && (
                        <span className="w-2 h-2 rounded-full bg-[#c49a5c] flex-shrink-0" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
}

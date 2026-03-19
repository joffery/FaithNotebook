import { useState } from 'react';
import { Book, ChevronDown, MessageCircle } from 'lucide-react';
import { bibleBooks } from '../data/bibleBooks';
import { hasSermonInBook, hasSermonInChapter, getFirstSermonChapterForBook } from '../data/sermonIndex';

type NavigationProps = {
  currentBook: string;
  currentChapter: number;
  onNavigate: (book: string, chapter: number) => void;
  onOpenAIChat: () => void;
  onOpenSermons: () => void;
};

export function Navigation({ currentBook, currentChapter, onNavigate, onOpenAIChat, onOpenSermons }: NavigationProps) {
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);

  const currentBookData = bibleBooks.find(b => b.name === currentBook);
  const chapters = currentBookData ? Array.from({ length: currentBookData.chapters }, (_, i) => i + 1) : [];

  return (
    <div className="bg-white/60 border-b border-[#c49a5c]/20 py-4 px-6 sticky top-0 backdrop-blur-sm z-40">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Book className="text-[#c49a5c]" size={24} />
          <h1 className="text-xl font-serif text-[#2c1810]">Faith Notebook</h1>
        </div>

        <div
          className={`flex items-center gap-3 whitespace-nowrap sm:max-w-none sm:overflow-visible ${
            showBookPicker || showChapterPicker
              ? 'overflow-visible max-w-none'
              : 'overflow-x-auto max-w-[68vw]'
          }`}
        >
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

          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowBookPicker(!showBookPicker)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#c49a5c]/30 rounded-lg text-[#2c1810] hover:bg-[#c49a5c]/10 transition-colors"
            >
              <span className="font-medium">{currentBook}</span>
              <ChevronDown size={16} />
            </button>

            {showBookPicker && (
              <div className="absolute top-full mt-2 right-0 w-64 max-h-96 overflow-y-auto bg-white border border-[#c49a5c]/30 rounded-lg shadow-xl z-50">
                <div className="p-2 flex flex-col gap-1 whitespace-normal">
                  {bibleBooks.map(book => (
                    <button
                      key={book.name}
                      onClick={() => {
                        onNavigate(book.name, getFirstSermonChapterForBook(book.name) ?? 1);
                        setShowBookPicker(false);
                      }}
                      className={`block w-full text-left px-3 py-2 rounded hover:bg-[#c49a5c]/10 transition-colors ${
                        book.name === currentBook ? 'bg-[#c49a5c]/20 font-semibold' : ''
                      }`}
                    >
                      <span className="flex items-center justify-between">
                        <span>{book.name}</span>
                        {hasSermonInBook(book.name) && (
                          <span className="w-2 h-2 rounded-full bg-[#c49a5c]" />
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
                      className={`px-3 py-2 rounded hover:bg-[#c49a5c]/10 transition-colors ${
                        ch === currentChapter ? 'bg-[#c49a5c]/20 font-semibold' : ''
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span>{ch}</span>
                        {hasSermonInChapter(currentBook, ch) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#c49a5c]" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

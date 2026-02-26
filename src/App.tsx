import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { BibleReader } from './components/BibleReader';
import { AuthForm } from './components/AuthForm';
import { AIChatTab } from './components/AIChatTab';
import { useAuth } from './context/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';
import { getFirstSermonLocation } from './data/sermonIndex';

function App() {
  console.log('App rendering');
  const { user, loading } = useAuth();
  const firstSermonLocation = getFirstSermonLocation();

  useEffect(() => {
    console.log('App mounted, user=', user);
    if (user) {
      const seen = localStorage.getItem('seenIntro');
      if (!seen) setShowIntro(true);
    }
  }, [user]);
  const [currentBook, setCurrentBook] = useState(firstSermonLocation?.book ?? 'Matthew');
  const [currentChapter, setCurrentChapter] = useState(firstSermonLocation?.chapter ?? 6);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiChatInitialView, setAiChatInitialView] = useState<'chat' | 'sermons'>('chat');
  const [showIntro, setShowIntro] = useState(false);
  const [hasAppliedSermonStart, setHasAppliedSermonStart] = useState(false);

  useEffect(() => {
    if (user && !hasAppliedSermonStart && firstSermonLocation) {
      setCurrentBook(firstSermonLocation.book);
      setCurrentChapter(firstSermonLocation.chapter);
      setHasAppliedSermonStart(true);
    }
  }, [user, hasAppliedSermonStart, firstSermonLocation]);

  const handleNavigate = (book: string, chapter: number) => {
    setCurrentBook(book);
    setCurrentChapter(chapter);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f4] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#c49a5c] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#2c1810]/60 font-serif">Loading Faith Notebook...</p>
        </div>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-[#faf8f4] flex items-center justify-center">
        <p className="text-red-500 font-serif">
          Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.
        </p>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="min-h-screen bg-[#faf8f4]">
      <Navigation
        currentBook={currentBook}
        currentChapter={currentChapter}
        onNavigate={handleNavigate}
        onOpenAIChat={() => { setAiChatInitialView('chat'); setShowAIChat(true); }}
        onOpenSermons={() => { setAiChatInitialView('sermons'); setShowAIChat(true); }}
      />

      <main className="py-8 px-6">
        <BibleReader book={currentBook} chapter={currentChapter} />
      </main>

      {showAIChat && (
        <AIChatTab
          initialView={aiChatInitialView}
          onClose={() => setShowAIChat(false)}
        />
      )}

      {showIntro && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg max-w-md text-center">
            <h2 className="text-2xl font-serif mb-4">Welcome to Faith Notebook</h2>
            <div className="mb-4 text-[#2c1810] text-left space-y-3">
              <p>
                <strong>1.</strong> Sermons contain all 56 sermons from our YouTube channel. Click any sermon to view its summary, all related verses, and the speaker&apos;s explanations (insights).
              </p>
              <p>
                <strong>2.</strong> You can browse all scriptures, and books/chapters mentioned in sermons are marked. Click a specific verse to see the corresponding sermon insights.
              </p>
              <p>
                <strong>3.</strong> You can add notes to every verse and set each note as private or public. Public notes appear in the community section.
              </p>
              <p>
                <strong>4.</strong> AI Chat generates answers purely based on sermons and notes.
              </p>
            </div>
            <button
              className="px-4 py-2 bg-[#c49a5c] text-white rounded-lg"
              onClick={() => { localStorage.setItem('seenIntro', '1'); setShowIntro(false); }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#faf8f4] to-transparent pointer-events-none"></div>
    </div>
  );
}

export default App;

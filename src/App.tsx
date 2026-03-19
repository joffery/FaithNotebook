import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { BibleReader } from './components/BibleReader';
import { AuthForm } from './components/AuthForm';
import { AIChatTab } from './components/AIChatTab';
import { SermonsPanel } from './components/SermonsPanel';
import { AccountSetupPrompt } from './components/AccountSetupPrompt';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { useAuth } from './context/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';

function App() {
  console.log('App rendering');
  const { user, profile, loading, profileLoading, needsAccountSetup } = useAuth();

  useEffect(() => {
    console.log('App mounted, user=', user);
  }, [user]);
  const [currentBook, setCurrentBook] = useState('Matthew');
  const [currentChapter, setCurrentChapter] = useState(1);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showSermons, setShowSermons] = useState(false);
  const [showAccountSetupPrompt, setShowAccountSetupPrompt] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);

  useEffect(() => {
    if (needsAccountSetup) {
      setShowAccountSetupPrompt(true);
      return;
    }

    setShowAccountSetupPrompt(false);
  }, [needsAccountSetup]);

  const handleNavigate = (book: string, chapter: number) => {
    setCurrentBook(book);
    setCurrentChapter(chapter);
  };

  if (loading || (user && profileLoading && !profile)) {
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
        onOpenAIChat={() => setShowAIChat(true)}
        onOpenSermons={() => setShowSermons(true)}
        onOpenProfile={() => setShowProfileSettings(true)}
      />

      <main className="py-8 px-6">
        <BibleReader book={currentBook} chapter={currentChapter} />
      </main>

      {showAIChat && (
        <AIChatTab
          onClose={() => setShowAIChat(false)}
        />
      )}

      {showSermons && (
        <SermonsPanel onClose={() => setShowSermons(false)} />
      )}

      {showAccountSetupPrompt && (
        <AccountSetupPrompt onClose={() => setShowAccountSetupPrompt(false)} />
      )}

      {showProfileSettings && (
        <ProfileSettingsModal onClose={() => setShowProfileSettings(false)} />
      )}

      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#faf8f4] to-transparent pointer-events-none"></div>
    </div>
  );
}

export default App;

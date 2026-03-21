import { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { BibleReader } from './components/BibleReader';
import { AuthForm } from './components/AuthForm';
import { AIChatTab } from './components/AIChatTab';
import { SermonsPanel } from './components/SermonsPanel';
import { AccountSetupPrompt } from './components/AccountSetupPrompt';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { MobileTabBar } from './components/MobileTabBar';
import { MyNotesPanel } from './components/MyNotesPanel';
import { BibleSearchModal } from './components/BibleSearchModal';
import { InstallPrompt } from './components/InstallPrompt';
import { useAuth } from './context/AuthContext';
import { isSupabaseConfigured } from './lib/supabase';
import { normalizeBibleBookName } from './utils/verseParser';

const LAST_READING_POSITION_KEY = 'faith-notebook-last-reading-position';

function App() {
  const { user, profile, loading, profileLoading, needsAccountSetup } = useAuth();
  const [currentBook, setCurrentBook] = useState(() => {
    if (typeof window === 'undefined') return 'Matthew';
    try {
      const raw = window.localStorage.getItem(LAST_READING_POSITION_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return normalizeBibleBookName(parsed?.book || 'Matthew');
    } catch {
      return 'Matthew';
    }
  });
  const [currentChapter, setCurrentChapter] = useState(() => {
    if (typeof window === 'undefined') return 1;
    try {
      const raw = window.localStorage.getItem(LAST_READING_POSITION_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Number.isFinite(parsed?.chapter) ? parsed.chapter : 1;
    } catch {
      return 1;
    }
  });
  const [showAIChat, setShowAIChat] = useState(false);
  const [showSermons, setShowSermons] = useState(false);
  const [showAccountSetupPrompt, setShowAccountSetupPrompt] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showMyNotes, setShowMyNotes] = useState(false);
  const [showBibleSearch, setShowBibleSearch] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedVerseFromApp, setSelectedVerseFromApp] = useState<number | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    if (needsAccountSetup) {
      setShowAccountSetupPrompt(true);
      return;
    }

    setShowAccountSetupPrompt(false);
  }, [needsAccountSetup]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        LAST_READING_POSITION_KEY,
        JSON.stringify({ book: currentBook, chapter: currentChapter })
      );
    } catch {
      // Ignore storage failures and keep navigation working.
    }
  }, [currentBook, currentChapter]);

  useEffect(() => {
    if (user) {
      setShowAuthModal(false);
      return;
    }

    setShowProfileSettings(false);
    setShowMyNotes(false);
  }, [user]);

  useEffect(() => {
    if (!statusBanner) return;

    const timeoutId = window.setTimeout(() => {
      setStatusBanner(null);
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [statusBanner]);

  const handleNavigate = (book: string, chapter: number) => {
    setCurrentBook(normalizeBibleBookName(book));
    setCurrentChapter(chapter);
  };

  const mobileActiveTab: 'read' | 'sermons' | 'ask' | 'profile' =
    showProfileSettings || showMyNotes ? 'profile' : showAIChat ? 'ask' : showSermons ? 'sermons' : 'read';

  const hasBlockingOverlay =
    showAIChat ||
    showSermons ||
    showAccountSetupPrompt ||
    showProfileSettings ||
    showMyNotes ||
    showBibleSearch ||
    showAuthModal;

  useEffect(() => {
    if (typeof window === 'undefined' || !hasBlockingOverlay) return;

    const scrollY = window.scrollY;
    const previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
    };
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyStyles.overflow;
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.left = previousBodyStyles.left;
      document.body.style.right = previousBodyStyles.right;
      document.body.style.width = previousBodyStyles.width;
      window.scrollTo(0, scrollY);
    };
  }, [hasBlockingOverlay]);

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

  return (
    <div className="min-h-screen bg-[#faf8f4]">
      {statusBanner && (
        <div className="fixed left-1/2 top-4 z-[120] -translate-x-1/2 px-4">
          <div className="rounded-full border border-[#c49a5c]/25 bg-[#2c1810] px-4 py-2 text-sm text-white shadow-lg">
            {statusBanner}
          </div>
        </div>
      )}

      <Navigation
        currentBook={currentBook}
        currentChapter={currentChapter}
        onNavigate={handleNavigate}
        onOpenAIChat={() => setShowAIChat(true)}
        onOpenSermons={() => setShowSermons(true)}
        onOpenProfile={user ? () => setShowProfileSettings(true) : () => setShowAuthModal(true)}
        onOpenSearch={() => setShowBibleSearch(true)}
        onOpenSignIn={() => setShowAuthModal(true)}
        isAuthenticated={!!user}
      />

      <main className="py-8 px-6 pb-28 sm:pb-8">
        <BibleReader
          book={currentBook}
          chapter={currentChapter}
          selectedVerseFromApp={selectedVerseFromApp}
          onSelectedVerseHandled={() => setSelectedVerseFromApp(null)}
        />
      </main>

      {showAIChat && (
        <AIChatTab
          onClose={() => setShowAIChat(false)}
        />
      )}

      {showSermons && (
        <SermonsPanel
          onClose={() => setShowSermons(false)}
        />
      )}

      {showAccountSetupPrompt && (
        <AccountSetupPrompt onClose={() => setShowAccountSetupPrompt(false)} />
      )}

      {showProfileSettings && (
        <ProfileSettingsModal
          onClose={() => setShowProfileSettings(false)}
          onSignedOut={() => {
            setShowProfileSettings(false);
            setShowMyNotes(false);
            setStatusBanner('Signed out successfully.');
          }}
          onOpenMyNotes={() => {
            setShowProfileSettings(false);
            setShowMyNotes(true);
          }}
        />
      )}

      {showMyNotes && (
        <MyNotesPanel
          onClose={() => setShowMyNotes(false)}
          onOpenNote={(book, chapter, verse) => {
            setCurrentBook(book);
            setCurrentChapter(chapter);
            setSelectedVerseFromApp(verse);
            setShowMyNotes(false);
          }}
        />
      )}

      {showBibleSearch && (
        <BibleSearchModal
          onClose={() => setShowBibleSearch(false)}
          onSelectResult={(book, chapter, verse) => {
            setCurrentBook(normalizeBibleBookName(book));
            setCurrentChapter(chapter);
            setSelectedVerseFromApp(verse ?? null);
            setShowBibleSearch(false);
            setShowAIChat(false);
            setShowSermons(false);
            setShowProfileSettings(false);
            setShowMyNotes(false);
          }}
        />
      )}

      <MobileTabBar
        activeTab={mobileActiveTab}
        onOpenRead={() => {
          setShowSermons(false);
          setShowAIChat(false);
          setShowProfileSettings(false);
          setShowMyNotes(false);
        }}
        onOpenSermons={() => {
          setShowProfileSettings(false);
          setShowAIChat(false);
          setShowMyNotes(false);
          setShowSermons(true);
        }}
        onOpenAIChat={() => {
          setShowProfileSettings(false);
          setShowSermons(false);
          setShowMyNotes(false);
          setShowAIChat(true);
        }}
        onOpenProfile={() => {
          if (!user) { setShowAuthModal(true); return; }
          setShowAIChat(false);
          setShowSermons(false);
          setShowMyNotes(false);
          setShowProfileSettings(true);
        }}
      />

      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#faf8f4] to-transparent pointer-events-none hidden sm:block"></div>

      <InstallPrompt />

      {showAuthModal && (
        <AuthForm
          onClose={() => setShowAuthModal(false)}
          onAuthenticated={(message) => setStatusBanner(message)}
        />
      )}
    </div>
  );
}

export default App;

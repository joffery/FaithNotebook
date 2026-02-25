import { useState } from 'react';
import { Navigation } from './components/Navigation';
import { BibleReader } from './components/BibleReader';
import { AuthForm } from './components/AuthForm';
import { AIChatTab } from './components/AIChatTab';
import { useAuth } from './context/AuthContext';

function App() {
  const { user, loading } = useAuth();
  const [currentBook, setCurrentBook] = useState('Matthew');
  const [currentChapter, setCurrentChapter] = useState(6);
  const [showAIChat, setShowAIChat] = useState(false);

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
      />

      <main className="py-8 px-6">
        <BibleReader book={currentBook} chapter={currentChapter} />
      </main>

      {showAIChat && <AIChatTab onClose={() => setShowAIChat(false)} />}

      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#faf8f4] to-transparent pointer-events-none"></div>
    </div>
  );
}

export default App;

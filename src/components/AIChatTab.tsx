import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, X, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { VersePanel } from './VersePanel';

type AIChatTabProps = {
  onClose: () => void;
};

type Source = {
  sermonTitle: string;
  speaker: string;
  church: string;
  youtubeUrl: string;
  startSeconds: number;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
};

export function AIChatTab({ onClose }: AIChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [versePanelRef, setVersePanelRef] = useState<{ book: string; chapter: number; verse: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch('/api/gemini-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || response.statusText);
      }

      const data = await response.json();
      let aiResponse = data?.aiResponse || 'Sorry, I could not generate a response.';

      if (data?.finishReason === 'MAX_TOKENS') {
        aiResponse += '\n\n[Response truncated. Please ask a narrower follow-up if needed.]';
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: aiResponse,
        sources: data?.sources || [],
      }]);
    } catch (error) {
      console.error('Error calling AI:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleCopy = async (content: string, index: number) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      window.setTimeout(() => {
        setCopiedMessageIndex((current) => (current === index ? null : current));
      }, 1800);
    } catch (error) {
      console.error('Failed to copy AI response:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-[#f5e6d3] to-[#e8d4ba] rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#c49a5c]/20">
          <h2 className="text-xl font-serif text-[#2c1810]">AI Bible Study Assistant</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#c49a5c]/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-[#2c1810]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#2c1810]/60 mb-4">
                Ask questions about the Bible, sermons, or discipleship
              </p>
              <div className="text-left max-w-md mx-auto space-y-2">
                <p className="text-[#2c1810]/50 text-sm font-medium">Try asking:</p>
                <ul className="text-[#2c1810]/40 text-xs space-y-1">
                  <li>• What does the Bible say about baptism?</li>
                  <li>• How do sermons explain John 15:1-8?</li>
                  <li>• What is discipleship according to Scripture?</li>
                </ul>
              </div>
            </div>
          ) : (
            messages.map((message, idx) => (
              <div key={idx} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-[#c49a5c]/20 text-[#2c1810]'
                      : 'bg-white/60 text-[#2c1810] border border-[#c49a5c]/20'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <>
                      <div className="flex items-center justify-end mb-2">
                        <button
                          onClick={() => handleCopy(message.content, idx)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#2c1810]/55 hover:bg-[#c49a5c]/10 hover:text-[#2c1810] transition-colors"
                          aria-label="Copy answer"
                        >
                          {copiedMessageIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedMessageIndex === idx ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-[#2c1810] prose-headings:text-[#2c1810]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#c49a5c]/20 space-y-1">
                          <p className="text-xs font-semibold text-[#2c1810]/60 uppercase tracking-wide">Sources</p>
                          {message.sources.map((src, i) => (
                            <div key={i} className="text-xs text-[#2c1810]/70">
                              <span className="font-medium">{src.sermonTitle}</span>
                              {src.speaker && <span> · {src.speaker}</span>}
                              {src.church && <span> · {src.church}</span>}
                              {src.youtubeUrl && (
                                <a
                                  href={src.startSeconds
                                    ? `${src.youtubeUrl}&t=${src.startSeconds}`
                                    : src.youtubeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-[#c49a5c] hover:underline"
                                >
                                  ▶ Watch
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/60 rounded-lg p-4 border border-[#c49a5c]/20">
                <Loader2 className="animate-spin text-[#c49a5c]" size={20} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-[#c49a5c]/20 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about the Bible, sermons, or discipleship..."
            disabled={loading}
            className="flex-1 px-4 py-3 bg-white/60 border border-[#c49a5c]/20 rounded-lg text-[#2c1810] placeholder-[#2c1810]/40 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/50 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-[#c49a5c] text-white rounded-lg hover:bg-[#b38a4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {versePanelRef && (
        <VersePanel
          book={versePanelRef.book}
          chapter={versePanelRef.chapter}
          verse={versePanelRef.verse}
          onClose={() => setVersePanelRef(null)}
        />
      )}
    </div>
  );
}

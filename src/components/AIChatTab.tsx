import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, X, Copy, Check, ThumbsUp, ThumbsDown, AlertCircle } from 'lucide-react';
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

const SUGGESTED_QUESTIONS = [
  'Is baptism necessary?',
  'What does Acts 2 teach about salvation?',
  'How do sermons explain discipleship?',
];

export function AIChatTab({ onClose }: AIChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [helpfulnessFeedbackByMessageIndex, setHelpfulnessFeedbackByMessageIndex] = useState<Record<number, 'helpful' | 'not_helpful'>>({});
  const [accuracyFeedbackByMessageIndex, setAccuracyFeedbackByMessageIndex] = useState<Record<number, 'accurate' | 'inaccurate'>>({});
  const [flaggedMessageIndexes, setFlaggedMessageIndexes] = useState<Record<number, boolean>>({});
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendFeedback = async (payload: {
    question: string;
    answer: string;
    feedbackKind: string;
  }) => {
    try {
      await fetch('/api/ai-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surface: 'ai_chat',
          question: payload.question,
          answer: payload.answer,
          feedbackKind: payload.feedbackKind,
        }),
      });
    } catch (error) {
      console.error('Failed to save AI feedback:', error);
    }
  };

  const getQuestionForMessage = (index: number) =>
    messages
      .slice(0, index)
      .reverse()
      .find((item) => item.role === 'user')?.content || '';

  const handleHelpfulnessFeedback = async (message: Message, index: number, isHelpful: boolean) => {
    setHelpfulnessFeedbackByMessageIndex((prev) => ({
      ...prev,
      [index]: isHelpful ? 'helpful' : 'not_helpful',
    }));

    await sendFeedback({
      question: getQuestionForMessage(index),
      answer: message.content,
      feedbackKind: isHelpful ? 'helpful' : 'not_helpful',
    });
  };

  const handleAccuracyFeedback = async (message: Message, index: number, isAccurate: boolean) => {
    setAccuracyFeedbackByMessageIndex((prev) => ({
      ...prev,
      [index]: isAccurate ? 'accurate' : 'inaccurate',
    }));

    await sendFeedback({
      question: getQuestionForMessage(index),
      answer: message.content,
      feedbackKind: isAccurate ? 'accurate' : 'inaccurate',
    });
  };

  const handleLooksWrongFeedback = async (message: Message, index: number) => {
    setFlaggedMessageIndexes((prev) => ({
      ...prev,
      [index]: true,
    }));

    await sendFeedback({
      question: getQuestionForMessage(index),
      answer: message.content,
      feedbackKind: 'looks_wrong',
    });
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center sm:p-4">
      <div className="bg-gradient-to-b from-[#f5e6d3] to-[#e8d4ba] w-full h-[100dvh] sm:h-auto sm:max-w-4xl sm:max-h-[90vh] flex flex-col sm:rounded-lg shadow-2xl">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#c49a5c]/20">
          <h2 className="text-2xl font-serif text-[#2c1810]">AI Bible Study Assistant</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#c49a5c]/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-[#2c1810]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4 sm:p-5">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#2c1810]/60 mb-2 text-lg">
                Ask about the Bible, sermons, or discipleship
              </p>
              <p className="text-[#2c1810]/45 text-sm mb-5 max-w-md mx-auto">
                Start with a simple question and the assistant will answer from Scripture and sermon material.
              </p>
              <div className="max-w-lg mx-auto flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => setInput(question)}
                    className="rounded-full border border-[#c49a5c]/25 bg-white/65 px-4 py-2 text-sm text-[#2c1810] hover:bg-[#c49a5c]/10 transition-colors"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, idx) => (
              <div key={idx} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[92%] sm:max-w-[80%] rounded-xl p-4 sm:p-5 ${
                    message.role === 'user'
                      ? 'bg-[#c49a5c]/20 text-[#2c1810]'
                      : 'bg-white/60 text-[#2c1810] border border-[#c49a5c]/20'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <>
                      <div className="flex items-center justify-end mb-2">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <button
                            onClick={() => handleCopy(message.content, idx)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#2c1810]/55 hover:bg-[#c49a5c]/10 hover:text-[#2c1810] transition-colors"
                            aria-label="Copy answer"
                          >
                            {copiedMessageIndex === idx ? <Check size={14} /> : <Copy size={14} />}
                            <span>{copiedMessageIndex === idx ? 'Copied' : 'Copy'}</span>
                          </button>
                          <button
                            onClick={() => handleHelpfulnessFeedback(message, idx, true)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                              helpfulnessFeedbackByMessageIndex[idx] === 'helpful'
                                ? 'bg-[#c49a5c]/16 text-[#2c1810]'
                                : 'text-[#2c1810]/55 hover:bg-[#c49a5c]/10 hover:text-[#2c1810]'
                            }`}
                            aria-label="Helpful answer"
                          >
                            <ThumbsUp size={14} />
                            <span>Helpful</span>
                          </button>
                          <button
                            onClick={() => handleHelpfulnessFeedback(message, idx, false)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                              helpfulnessFeedbackByMessageIndex[idx] === 'not_helpful'
                                ? 'bg-[#c49a5c]/16 text-[#2c1810]'
                                : 'text-[#2c1810]/55 hover:bg-[#c49a5c]/10 hover:text-[#2c1810]'
                            }`}
                            aria-label="Not helpful answer"
                          >
                            <ThumbsDown size={14} />
                            <span>Not helpful</span>
                          </button>
                          <button
                            onClick={() => handleAccuracyFeedback(message, idx, true)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                              accuracyFeedbackByMessageIndex[idx] === 'accurate'
                                ? 'bg-[#c49a5c]/16 text-[#2c1810]'
                                : 'text-[#2c1810]/55 hover:bg-[#c49a5c]/10 hover:text-[#2c1810]'
                            }`}
                            aria-label="Accurate answer"
                          >
                            <Check size={14} />
                            <span>Accurate</span>
                          </button>
                          <button
                            onClick={() => handleAccuracyFeedback(message, idx, false)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                              accuracyFeedbackByMessageIndex[idx] === 'inaccurate'
                                ? 'bg-[#c49a5c]/16 text-[#2c1810]'
                                : 'text-[#2c1810]/55 hover:bg-[#c49a5c]/10 hover:text-[#2c1810]'
                            }`}
                            aria-label="Not accurate answer"
                          >
                            <X size={14} />
                            <span>Not accurate</span>
                          </button>
                          <button
                            onClick={() => handleLooksWrongFeedback(message, idx)}
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                              flaggedMessageIndexes[idx]
                                ? 'bg-[#c49a5c]/16 text-[#2c1810]'
                                : 'text-[#2c1810]/55 hover:bg-[#c49a5c]/10 hover:text-[#2c1810]'
                            }`}
                            aria-label="Something looks wrong"
                          >
                            <AlertCircle size={14} />
                            <span>Looks wrong</span>
                          </button>
                        </div>
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

        <div className="p-4 sm:p-5 border-t border-[#c49a5c]/20 flex gap-2 bg-[#f2dfc5]/85 backdrop-blur-sm pb-[max(1rem,env(safe-area-inset-bottom))]">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the Bible, sermons, or discipleship..."
            disabled={loading}
            className="flex-1 min-w-0 px-4 py-3 bg-white/70 border border-[#c49a5c]/20 rounded-xl text-[#2c1810] placeholder-[#2c1810]/40 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/50 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-4 py-3 bg-[#c49a5c] text-white rounded-xl hover:bg-[#b38a4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
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

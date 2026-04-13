import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, X, Copy, Check, ThumbsUp, ThumbsDown, Pencil } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { VersePanel } from './VersePanel';
import { useAuth } from '../context/AuthContext';
import { FeedbackModal, type FeedbackReasonOption } from './FeedbackModal';
import {
  buildFeedbackKey,
  clearPersistedFeedbackState,
  getPersistedFeedbackState,
  hashFeedbackValue,
  savePersistedFeedbackState,
} from '../utils/feedback';
import { buildFeedbackActorKey, getAnonymousFeedbackSessionId } from '../utils/feedbackActor';
import { flushPendingFeedbackQueue, submitFeedbackWithRetry } from '../utils/feedbackQueue';

type AIChatTabProps = {
  onClose: () => void;
};

type Source = {
  sermonTitle: string;
  speaker: string;
  church: string;
  youtubeUrl: string;
  startSeconds: number;
  summary?: string;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
};

type FeedbackVote = 'up' | 'down';

type ThumbDownFeedbackDraft = {
  messageIndex: number;
  reason: string;
  details: string;
  isSubmitting: boolean;
};

const AI_CHAT_THUMB_DOWN_REASONS: FeedbackReasonOption[] = [
  { value: 'incorrect_or_incomplete', label: 'Incorrect or incomplete' },
  { value: 'not_what_i_asked_for', label: 'Not what I asked for' },
  { value: 'wrong_scripture_or_interpretation', label: 'Wrong scripture or interpretation' },
  { value: 'unclear_or_confusing', label: 'Unclear or confusing' },
  { value: 'other', label: 'Other' },
];

const SUGGESTED_QUESTIONS = [
  'What does the Bible say about baptism?',
  'Why did Moses spend 40 years in Midian?',
  'What scriptures help with anxiety?',
];

const AI_CHAT_SESSION_KEY = 'faith-notebook-ai-chat-session';

const loadMessagesFromSession = (): Message[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.sessionStorage.getItem(AI_CHAT_SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is Message =>
      item &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.content === 'string'
    );
  } catch {
    return [];
  }
};

export function AIChatTab({ onClose }: AIChatTabProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(() => loadMessagesFromSession());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [feedbackByMessageIndex, setFeedbackByMessageIndex] = useState<Record<number, FeedbackVote>>({});
  const [thumbDownFeedbackByMessageIndex, setThumbDownFeedbackByMessageIndex] = useState<Record<number, { reason: string; details: string }>>({});
  const [thumbDownDraft, setThumbDownDraft] = useState<ThumbDownFeedbackDraft | null>(null);
  const [feedbackStatusByMessageIndex, setFeedbackStatusByMessageIndex] = useState<Record<number, string>>({});
  const [versePanelRef, setVersePanelRef] = useState<{ book: string; chapter: number; verse: number } | null>(null);
  const [expandedSummaryIndex, setExpandedSummaryIndex] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastAssistantMsgRef = useRef<HTMLDivElement | null>(null);
  const prevMessageCount = useRef(0);
  const anonymousSessionIdRef = useRef<string>(getAnonymousFeedbackSessionId());
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingUserMessageRef = useRef<string>('');

  useEffect(() => {
    const count = messages.length;
    const lastMessage = messages[count - 1];

    if (count > prevMessageCount.current && lastMessage?.role === 'assistant') {
      lastAssistantMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    prevMessageCount.current = count;
  }, [messages, loading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      if (messages.length === 0) {
        window.sessionStorage.removeItem(AI_CHAT_SESSION_KEY);
        return;
      }

      window.sessionStorage.setItem(AI_CHAT_SESSION_KEY, JSON.stringify(messages));
    } catch {
      // Ignore storage failures and keep chat working.
    }
  }, [messages]);

  useEffect(() => {
    void flushPendingFeedbackQueue();
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const nextFeedbackByMessageIndex: Record<number, FeedbackVote> = {};
    const nextThumbDownFeedbackByMessageIndex: Record<number, { reason: string; details: string }> = {};

    messages.forEach((message, index) => {
      if (message.role !== 'assistant') return;

      const { feedbackGroupKey } = getSentimentFeedbackKeys(index, 'helpful');
      const persistedFeedback = getPersistedFeedbackState(feedbackGroupKey);

      if (!persistedFeedback) return;

      if (persistedFeedback.feedbackKind === 'helpful') {
        nextFeedbackByMessageIndex[index] = 'up';
        return;
      }

      if (persistedFeedback.feedbackKind === 'not_helpful') {
        nextFeedbackByMessageIndex[index] = 'down';
        nextThumbDownFeedbackByMessageIndex[index] = {
          reason: persistedFeedback.feedbackReason || '',
          details: persistedFeedback.feedbackDetails || '',
        };
      }
    });

    setFeedbackByMessageIndex(nextFeedbackByMessageIndex);
    setThumbDownFeedbackByMessageIndex(nextThumbDownFeedbackByMessageIndex);
  }, [messages, user?.id]);

  const setFeedbackStatus = (index: number, message: string) => {
    setFeedbackStatusByMessageIndex((prev) => ({
      ...prev,
      [index]: message,
    }));

    window.setTimeout(() => {
      setFeedbackStatusByMessageIndex((prev) => {
        if (prev[index] !== message) return prev;
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }, 2400);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    pendingUserMessageRef.current = userMessage;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/gemini-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage }),
        signal: abortController.signal,
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
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      console.error('Error calling AI:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      abortControllerRef.current = null;
      pendingUserMessageRef.current = '';
      setLoading(false);
    }
  };

  const stopMessage = () => {
    if (!loading) return;

    const pendingUserMessage = pendingUserMessageRef.current;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    pendingUserMessageRef.current = '';
    setLoading(false);

    if (pendingUserMessage) {
      setInput(pendingUserMessage);
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage?.role === 'user' && lastMessage.content === pendingUserMessage) {
          return prev.slice(0, -1);
        }
        return prev;
      });
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
    feedbackKey: string;
    feedbackGroupKey?: string;
    feedbackReason?: string;
    feedbackDetails?: string;
    action?: 'set' | 'unset';
  }) => {
    return await submitFeedbackWithRetry({
      surface: 'ai_chat',
      question: payload.question,
      answer: payload.answer,
      feedbackKind: payload.feedbackKind,
      feedbackKey: payload.feedbackKey,
      feedbackGroupKey: payload.feedbackGroupKey,
      feedbackReason: payload.feedbackReason,
      feedbackDetails: payload.feedbackDetails,
      userId: user?.id,
      anonymousSessionId: anonymousSessionIdRef.current,
      feedbackActorKey: buildFeedbackActorKey(user?.id, anonymousSessionIdRef.current),
      action: payload.action || 'set',
    });
  };

  const getMessageFeedbackBase = (index: number) => {
    const message = messages[index];
    const question = getQuestionForMessage(index);
    const answerHash = hashFeedbackValue(message?.content || '');
    const questionHash = hashFeedbackValue(question);
    return buildFeedbackKey(
      'ai_chat',
      buildFeedbackActorKey(user?.id, anonymousSessionIdRef.current),
      index,
      questionHash,
      answerHash
    );
  };

  const getQuestionForMessage = (index: number) =>
    messages
      .slice(0, index)
      .reverse()
      .find((item) => item.role === 'user')?.content || '';

  const clearFeedbackStatus = (index: number) => {
    setFeedbackStatusByMessageIndex((prev) => {
      if (!prev[index]) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const getSentimentFeedbackKeys = (index: number, feedbackKind: 'helpful' | 'not_helpful') => {
    const feedbackBase = getMessageFeedbackBase(index);
    const feedbackGroupKey = buildFeedbackKey(feedbackBase, 'sentiment');
    const feedbackKey = buildFeedbackKey(feedbackGroupKey, feedbackKind);
    return { feedbackGroupKey, feedbackKey };
  };

  const handleThumbUpFeedback = async (message: Message, index: number) => {
    const { feedbackGroupKey, feedbackKey } = getSentimentFeedbackKeys(index, 'helpful');

    if (feedbackByMessageIndex[index] === 'up') {
      clearPersistedFeedbackState(feedbackGroupKey, feedbackKey);
      setFeedbackByMessageIndex((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });

      const result = await sendFeedback({
        question: getQuestionForMessage(index),
        answer: message.content,
        feedbackKind: 'helpful',
        feedbackKey,
        feedbackGroupKey,
        action: 'unset',
      });

      if (result.queued) {
        setFeedbackStatus(index, 'Feedback removal saved locally and will retry automatically.');
      } else {
        clearFeedbackStatus(index);
      }
      return;
    }

    setFeedbackByMessageIndex((prev) => ({
      ...prev,
      [index]: 'up',
    }));
    setThumbDownDraft((current) => (current?.messageIndex === index ? null : current));
    savePersistedFeedbackState({
      feedbackKey,
      feedbackGroupKey,
      feedbackKind: 'helpful',
      surface: 'ai_chat',
      updatedAt: Date.now(),
    });

    const result = await sendFeedback({
      question: getQuestionForMessage(index),
      answer: message.content,
      feedbackKind: 'helpful',
      feedbackKey,
      feedbackGroupKey,
    });

    if (result.queued) {
      setFeedbackStatus(index, 'Feedback saved locally and will retry automatically.');
    } else {
      clearFeedbackStatus(index);
    }
  };

  const openThumbDownFeedback = (index: number) => {
    if (feedbackByMessageIndex[index] === 'down') {
      void removeThumbDownFeedback(index);
      return;
    }

    const existingFeedback = thumbDownFeedbackByMessageIndex[index];
    setThumbDownDraft({
      messageIndex: index,
      reason: existingFeedback?.reason || '',
      details: existingFeedback?.details || '',
      isSubmitting: false,
    });
  };

  const removeThumbDownFeedback = async (index: number) => {
    const message = messages[index];
    if (!message) return;

    const { feedbackGroupKey, feedbackKey } = getSentimentFeedbackKeys(index, 'not_helpful');

    clearPersistedFeedbackState(feedbackGroupKey, feedbackKey);
    setFeedbackByMessageIndex((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    const result = await sendFeedback({
      question: getQuestionForMessage(index),
      answer: message.content,
      feedbackKind: 'not_helpful',
      feedbackKey,
      feedbackGroupKey,
      action: 'unset',
    });

    if (result.queued) {
      setFeedbackStatus(index, 'Feedback removal saved locally and will retry automatically.');
    } else {
      clearFeedbackStatus(index);
    }
  };

  const submitThumbDownFeedback = async () => {
    if (!thumbDownDraft) return;

    const message = messages[thumbDownDraft.messageIndex];
    if (!message) {
      setThumbDownDraft(null);
      return;
    }

    const nextDraft = { ...thumbDownDraft, isSubmitting: true };
    setThumbDownDraft(nextDraft);

    const { feedbackGroupKey, feedbackKey } = getSentimentFeedbackKeys(thumbDownDraft.messageIndex, 'not_helpful');
    const trimmedDetails = nextDraft.details.trim();

    setFeedbackByMessageIndex((prev) => ({
      ...prev,
      [thumbDownDraft.messageIndex]: 'down',
    }));
    setThumbDownFeedbackByMessageIndex((prev) => ({
      ...prev,
      [thumbDownDraft.messageIndex]: {
        reason: nextDraft.reason,
        details: trimmedDetails,
      },
    }));
    savePersistedFeedbackState({
      feedbackKey,
      feedbackGroupKey,
      feedbackKind: 'not_helpful',
      feedbackReason: nextDraft.reason,
      feedbackDetails: trimmedDetails,
      surface: 'ai_chat',
      updatedAt: Date.now(),
    });

    const result = await sendFeedback({
      question: getQuestionForMessage(thumbDownDraft.messageIndex),
      answer: message.content,
      feedbackKind: 'not_helpful',
      feedbackKey,
      feedbackGroupKey,
      feedbackReason: nextDraft.reason,
      feedbackDetails: trimmedDetails,
    });

    setThumbDownDraft(null);

    if (result.queued) {
      setFeedbackStatus(thumbDownDraft.messageIndex, 'Feedback saved locally and will retry automatically.');
    } else {
      clearFeedbackStatus(thumbDownDraft.messageIndex);
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

  const feedbackButtonClassName = (isActive: boolean) =>
    `inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
      isActive
        ? 'border-[#2c1810] bg-[#2c1810] text-white shadow-sm'
        : 'border-[#c49a5c]/30 bg-white/70 text-[#2c1810]/70 hover:bg-[#c49a5c]/12 hover:text-[#2c1810]'
    }`;

  const isEditableUserMessage = (index: number) =>
    messages[index]?.role === 'user' &&
    !loading &&
    (index === messages.length - 1 || (index === messages.length - 2 && messages[index + 1]?.role === 'assistant'));

  const editUserMessage = (index: number) => {
    const message = messages[index];
    if (!message || message.role !== 'user') return;

    setInput(message.content);
    setMessages((prev) => prev.slice(0, index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center sm:p-4 overscroll-contain">
      <div className="bg-gradient-to-b from-[#f5e6d3] to-[#e8d4ba] w-full h-[100dvh] sm:h-auto sm:max-w-4xl sm:max-h-[90vh] flex flex-col sm:rounded-lg shadow-2xl">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#c49a5c]/20">
          <h2 className="text-2xl font-serif text-[#2c1810]">Bible Q&A</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#c49a5c]/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-[#2c1810]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 p-4 sm:p-5">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#2c1810]/60 mb-2 text-lg">
                Ask Scripture questions and explore sermon insights
              </p>
              <p className="text-[#2c1810]/45 text-sm mb-5 max-w-md mx-auto">
                Get a Bible-based answer that can draw from Scripture and relevant sermons.
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
              <div
                key={idx}
                ref={message.role === 'assistant' && idx === messages.length - 1 ? lastAssistantMsgRef : undefined}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
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
                            onClick={() => handleThumbUpFeedback(message, idx)}
                            className={feedbackButtonClassName(feedbackByMessageIndex[idx] === 'up')}
                            aria-label="Thumbs up"
                            aria-pressed={feedbackByMessageIndex[idx] === 'up'}
                          >
                            <ThumbsUp size={14} />
                          </button>
                          <button
                            onClick={() => openThumbDownFeedback(idx)}
                            className={feedbackButtonClassName(feedbackByMessageIndex[idx] === 'down')}
                            aria-label="Thumbs down"
                            aria-pressed={feedbackByMessageIndex[idx] === 'down'}
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </div>
                      </div>
                      {feedbackStatusByMessageIndex[idx] && (
                        <p className="mb-2 text-right text-xs font-medium text-[#8c6430]">
                          {feedbackStatusByMessageIndex[idx]}
                        </p>
                      )}
                      <div className="leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-[#2c1810] prose-headings:text-[#2c1810]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#c49a5c]/20 space-y-2">
                          <p className="text-xs font-semibold text-[#2c1810]/60 uppercase tracking-wide">Sources</p>
                          {message.sources.map((src, i) => {
                            const summaryKey = `${idx}-${i}`;
                            const isSummaryOpen = expandedSummaryIndex === summaryKey;
                            return (
                              <div key={i} className="text-xs text-[#2c1810]/70">
                                <div className="flex flex-wrap items-center gap-x-1">
                                  <span className="font-medium">{src.sermonTitle}</span>
                                  {src.speaker && <span>· {src.speaker}</span>}
                                  {src.church && <span>· {src.church}</span>}
                                  {src.summary && (
                                    <button
                                      onClick={() => setExpandedSummaryIndex(isSummaryOpen ? null : summaryKey)}
                                      className="ml-1 text-[#c49a5c] hover:underline"
                                    >
                                      {isSummaryOpen ? 'Hide summary' : 'Summary'}
                                    </button>
                                  )}
                                  {src.youtubeUrl && (
                                    <a
                                      href={src.youtubeUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-1 text-[#c49a5c] hover:underline"
                                    >
                                      ▶ Watch
                                    </a>
                                  )}
                                </div>
                                {isSummaryOpen && src.summary && (
                                  <p className="mt-2 p-3 bg-[#faf8f4] rounded-lg leading-relaxed text-[#2c1810]/80 border border-[#c49a5c]/15">
                                    {src.summary}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="mb-2 flex items-center justify-end">
                        {isEditableUserMessage(idx) && (
                          <button
                            onClick={() => editUserMessage(idx)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#2c1810]/55 hover:bg-[#c49a5c]/10 hover:text-[#2c1810] transition-colors"
                          >
                            <Pencil size={12} />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                      <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    </>
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
            placeholder="Ask a Bible or sermon question..."
            disabled={loading}
            className="flex-1 min-w-0 px-4 py-3 bg-white/70 border border-[#c49a5c]/20 rounded-xl text-[#2c1810] placeholder-[#2c1810]/40 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/50 disabled:opacity-50"
          />
          {loading ? (
            <button
              onClick={stopMessage}
              className="px-4 py-3 bg-[#2c1810] text-white rounded-xl hover:bg-[#1f120d] transition-colors flex-shrink-0"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-4 py-3 bg-[#c49a5c] text-white rounded-xl hover:bg-[#b38a4d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Send size={20} />
            </button>
          )}
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

      <FeedbackModal
        isOpen={!!thumbDownDraft}
        reasons={AI_CHAT_THUMB_DOWN_REASONS}
        selectedReason={thumbDownDraft?.reason || ''}
        details={thumbDownDraft?.details || ''}
        description="Your feedback will help improve this app."
        onClose={() => setThumbDownDraft(null)}
        onReasonChange={(reason) => {
          setThumbDownDraft((current) => (current ? { ...current, reason } : current));
        }}
        onDetailsChange={(details) => {
          setThumbDownDraft((current) => (current ? { ...current, details } : current));
        }}
        onSubmit={() => {
          void submitThumbDownFeedback();
        }}
        isSubmitting={thumbDownDraft?.isSubmitting}
      />
    </div>
  );
}

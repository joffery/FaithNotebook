import { useState, useEffect } from 'react';
import { Send, Loader2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { parseVerseReference } from '../utils/verseParser';
import { VersePanel } from './VersePanel';
import sermonsJson from '../data/sermons_processed.json';
import { useAuth } from '../context/AuthContext';
import { getBibleChapter } from '../data/bibleText';

type AIChatTabProps = {
  initialView?: 'chat' | 'sermons';
  onClose: () => void;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const MAX_SERMONS_IN_CONTEXT = 8;
const MAX_NOTES_IN_CONTEXT = 10;
const CONTEXT_CHAR_BUDGET = 12000;

function tokenizeQuery(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s:]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
}

function scoreByQuery(text: string, terms: string[]): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) score += 1;
  }
  return score;
}

function trimToSentence(text: string, maxChars: number): string {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;

  const sliced = normalized.slice(0, maxChars);
  const lastStop = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('! '), sliced.lastIndexOf('? '));
  if (lastStop > 40) return sliced.slice(0, lastStop + 1).trim();
  return `${sliced.trim()}...`;
}

export function AIChatTab({ onClose, initialView = 'chat' }: AIChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [allSermons, setAllSermons] = useState<any[]>(sermonsJson as any[]);
  const [allNotes, setAllNotes] = useState<any[]>([]);
  const [userNotes, setUserNotes] = useState<any[]>([]);
  const [allInsights, setAllInsights] = useState<any[]>([]);
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<'chat' | 'sermons'>(initialView);
  const [selectedSermon, setSelectedSermon] = useState<any | null>(null);
  const [versePanelRef, setVersePanelRef] = useState<{book:string;chapter:number;verse:number} | null>(null);

  useEffect(() => {
    setActiveView(initialView);
    setSelectedSermon(null);
  }, [initialView]);

  const getOriginalVerseText = (verseRef: string) => {
    const parsed = parseVerseReference(verseRef);
    if (parsed.length === 0) return 'Verse text unavailable.';

    const fragments = parsed
      .map((p) => {
        const chapterData = getBibleChapter(p.book, p.chapter);
        const verseData = chapterData?.verses.find(v => v.verse === p.verse);
        return verseData ? `${p.verse}. ${verseData.text}` : null;
      })
      .filter(Boolean);

    return fragments.length > 0 ? fragments.join(' ') : 'Verse text unavailable.';
  };

  useEffect(() => {
    const fetchData = async () => {
      // always start with the static JSON sermons/insights
      setAllSermons(sermonsJson as any[]);

      const jsonInsights: any[] = [];
      (sermonsJson as any[]).forEach(s => {
        (s.verse_insights || []).forEach((vi: any) => {
          jsonInsights.push({
            verse: vi.verse,
            insight: vi.insight,
            sermons: {
              title: s.title,
              speaker: s.speaker,
              church: s.church,
            },
          });
        });
      });
      setAllInsights(jsonInsights);

      if (isSupabaseConfigured) {
        // fetch community-shared notes
        const { data: notesData } = await supabase
          .from('shared_notes')
          .select('*')
          .order('likes_count', { ascending: false });
        if (notesData) setAllNotes(notesData);

        // if user is signed in, grab their personal notes
        if (user) {
          const { data: personal } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);
          if (personal) setUserNotes(personal);
        }

        // optionally merge any server-side sermon/insight overrides
        const { data: dbInsights } = await supabase
          .from('sermon_verse_insights')
          .select('*, sermons(title, speaker, church)')
          .order('verse');
        if (dbInsights) {
          // append any that aren't already included
          setAllInsights(prev => [...prev, ...dbInsights]);
        }
      }
    };

    fetchData();
  }, [user]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const terms = tokenizeQuery(userMessage);

      const rankedSermons = [...allSermons]
        .map((sermon: any) => {
          const title = sermon.title || '';
          const summary = sermon.summary || '';
          const tags = Array.isArray(sermon.tags) ? sermon.tags.join(' ') : '';
          const reference = sermon.book_reference || '';
          const score =
            scoreByQuery(title, terms) * 4 +
            scoreByQuery(tags, terms) * 3 +
            scoreByQuery(reference, terms) * 2 +
            scoreByQuery(summary, terms);

          return { sermon, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_SERMONS_IN_CONTEXT)
        .map((item) => item.sermon);

      const sermonsContext = rankedSermons.length > 0
        ? `Relevant Sermons (Top ${rankedSermons.length}):\n${rankedSermons
            .map((s: any, idx: number) => {
              const summary = trimToSentence(s.summary || '', 220);
              const tagLine = Array.isArray(s.tags) ? s.tags.slice(0, 5).join(', ') : '';
              return `${idx + 1}. "${s.title}" by ${s.speaker} (${s.church})\n   Ref: ${s.book_reference || 'N/A'}\n   Summary: ${summary}\n   Tags: ${tagLine || 'N/A'}`;
            })
            .join('\n\n')}`
        : '';

      const combinedNotes = [
        ...userNotes.map((note: any) => ({ ...note, noteScope: 'My Note' })),
        ...allNotes.map((note: any) => ({ ...note, noteScope: 'Community Note' })),
      ];

      const rankedNotes = combinedNotes
        .map((note: any) => {
          const loc = `${note.book || ''} ${note.chapter || ''}:${note.verse || ''}`;
          const body = `${loc} ${note.content || ''}`;
          const score =
            scoreByQuery(loc, terms) * 3 +
            scoreByQuery(note.content || '', terms) +
            (note.noteScope === 'My Note' ? 1 : 0);

          return { note, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_NOTES_IN_CONTEXT)
        .map((item) => item.note);

      const notesContext = rankedNotes.length > 0
        ? `Relevant Notes (Top ${rankedNotes.length}):\n${rankedNotes
            .map((n: any, idx: number) => {
              const content = trimToSentence(n.content || '', 180);
              const likes = typeof n.likes_count === 'number' ? ` | likes=${n.likes_count}` : '';
              return `${idx + 1}. [${n.noteScope}] ${n.book} ${n.chapter}:${n.verse}${likes}\n   ${content}`;
            })
            .join('\n\n')}`
        : '';

      let fullContext = [sermonsContext, notesContext].filter(Boolean).join('\n\n---\n\n');
      if (fullContext.length > CONTEXT_CHAR_BUDGET) {
        fullContext = `${fullContext.slice(0, CONTEXT_CHAR_BUDGET)}\n\n[Context trimmed due to size budget]`;
      }

      const response = await fetch('/api/gemini-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullContext,
          userMessage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('AI route error:', errorData);
        throw new Error(`Failed to get response from AI: ${errorData?.error || response.statusText}`);
      }

      const data = await response.json();
      console.log('AI debug', {
        finishReason: data?.finishReason,
        usageMetadata: data?.usageMetadata,
        contextCharCount: data?.contextCharCount,
      });
      let aiResponse = data?.aiResponse || 'Sorry, I could not generate a response.';

      if (data?.finishReason === 'MAX_TOKENS') {
        aiResponse += '\n\n[Response truncated due to token limit. Please ask a narrower follow-up if needed.]';
      }

      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-[#f5e6d3] to-[#e8d4ba] rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#c49a5c]/20">
          <h2 className="text-xl font-serif text-[#2c1810]">AI Bible Study Assistant</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#c49a5c]/10 rounded-lg transition-colors"
            >
              <X size={20} className="text-[#2c1810]" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 p-4">
        {activeView === 'chat' ? (
          <> 
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#2c1810]/60 mb-2">
                  Ask questions about the Bible, sermons, or community insights
                </p>
                <p className="text-[#2c1810]/40 text-sm">
                  I’m using {allSermons.length} sermons and {allInsights.length} verse insights from the static library.
                  {allNotes.length > 0 && ` I also know about ${allNotes.length} community notes.`}
                  {userNotes.length > 0 && ` Plus you’ve written ${userNotes.length} personal notes.`}
                </p>
                <div className="mt-4 text-left max-w-md mx-auto space-y-2">
                  <p className="text-[#2c1810]/50 text-sm font-medium">Try asking:</p>
                  <ul className="text-[#2c1810]/40 text-xs space-y-1">
                    <li>• What sermons talk about faith and prayer?</li>
                    <li>• How does Malik Speckman explain John 15:1-8?</li>
                    <li>• What insights are there about overcoming trouble?</li>
                  </ul>
                </div>
              </div>
            ) : (
              messages.map((message, idx) => (
                <div
                  key={idx}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-[#c49a5c]/20 text-[#2c1810]'
                        : 'bg-white/60 text-[#2c1810] border border-[#c49a5c]/20'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-strong:text-[#2c1810] prose-headings:text-[#2c1810]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
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
          </>
        ) : (
          <div className="space-y-4">
            {selectedSermon ? (
              <div>
                <button
                  onClick={() => setSelectedSermon(null)}
                  className="text-[#c49a5c] underline mb-2"
                >
                  ← Back to list
                </button>
                <h3 className="text-lg font-semibold text-[#2c1810] mb-2">{selectedSermon.title}</h3>
                <p className="text-sm text-[#2c1810]/70 mb-4">
                  {selectedSermon.speaker} • {selectedSermon.church}
                </p>
                <p className="text-[#2c1810] leading-relaxed mb-4">{selectedSermon.summary}</p>
                {selectedSermon.verse_insights && selectedSermon.verse_insights.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium text-[#2c1810]">Insights:</p>
                    {selectedSermon.verse_insights.map((vi: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white/60 rounded-lg border border-[#c49a5c]/20">
                        <button
                          onClick={() => {
                            const parsed = parseVerseReference(vi.verse);
                            if (parsed.length > 0) {
                              const { book, chapter, verse } = parsed[0];
                              setVersePanelRef({ book, chapter, verse });
                            }
                          }}
                          className="text-[#c49a5c] underline text-left mb-2"
                        >
                          {vi.verse}
                        </button>
                        <p className="text-sm text-[#2c1810]/80 mb-2">{getOriginalVerseText(vi.verse)}</p>
                        <p className="text-[#2c1810]">{vi.insight}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              allSermons.map((s: any) => (
                <div
                  key={s.id}
                  className="p-4 bg-white/60 rounded-lg border border-[#c49a5c]/20 cursor-pointer hover:bg-[#c49a5c]/10"
                  onClick={() => setSelectedSermon(s)}
                >
                  <h4 className="font-semibold text-[#2c1810]">{s.title}</h4>
                  <p className="text-sm text-[#2c1810]/70">
                    {s.speaker} • {s.church}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
        {versePanelRef && (
          <VersePanel
            book={versePanelRef.book}
            chapter={versePanelRef.chapter}
            verse={versePanelRef.verse}
            onClose={() => setVersePanelRef(null)}
          />
        )}
        </div>

        {activeView === 'chat' && (
          <div className="p-4 border-t border-[#c49a5c]/20 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about sermons, verses, or community insights..."
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
        )}
      </div>
    </div>
  );
}

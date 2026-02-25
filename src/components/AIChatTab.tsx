import { useState, useEffect } from 'react';
import { Send, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type AIChatTabProps = {
  onClose: () => void;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export function AIChatTab({ onClose }: AIChatTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [allSermons, setAllSermons] = useState<any[]>([]);
  const [allNotes, setAllNotes] = useState<any[]>([]);
  const [allInsights, setAllInsights] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: sermonsData } = await supabase
        .from('sermons')
        .select('*')
        .order('series_number', { ascending: true });

      const { data: notesData } = await supabase
        .from('shared_notes')
        .select('*')
        .order('likes_count', { ascending: false });

      const { data: insightsData } = await supabase
        .from('sermon_verse_insights')
        .select('*, sermons(title, speaker, church)')
        .order('verse');

      if (sermonsData) setAllSermons(sermonsData);
      if (notesData) setAllNotes(notesData);
      if (insightsData) setAllInsights(insightsData);
    };

    fetchData();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const sermonsContext = allSermons.length > 0
        ? `Available Sermons:\n${allSermons
            .map((s: any) => `"${s.title}" by ${s.speaker} (${s.church}) - ${s.book_reference}\nSummary: ${s.summary}\nKey Tags: ${s.tags.slice(0, 5).join(', ')}`)
            .join('\n\n')}`
        : '';

      const notesContext = allNotes.length > 0
        ? `Community Notes:\n${allNotes
            .map((n: any) => `${n.book} ${n.chapter}:${n.verse} - ${n.content} (${n.likes_count} likes)`)
            .join('\n')}`
        : '';

      const insightsContext = allInsights.length > 0
        ? `Verse Insights from Sermons:\n${allInsights
            .map((i: any) => `${i.verse} - From "${i.sermons?.title}" by ${i.sermons?.speaker}: ${i.insight}`)
            .join('\n')}`
        : '';

      const fullContext = [sermonsContext, notesContext, insightsContext].filter(c => c).join('\n\n---\n\n');

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

      if (!apiKey) {
        throw new Error('Gemini API key not configured');
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `You are a helpful Bible study assistant with access to sermons and community notes.

${fullContext}

User question: ${userMessage}

Provide a thoughtful, biblically-grounded response. When relevant, reference specific sermons by title and speaker, or mention insights from community notes. Be conversational and helpful.`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Gemini API error:', errorData);
        throw new Error(`Failed to get response from AI: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

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
            <p className="text-[#2c1810]/60 mb-2">
              Ask questions about the Bible, sermons, or community insights
            </p>
            <p className="text-[#2c1810]/40 text-sm">
              I have access to {allSermons.length} sermons, {allInsights.length} verse insights, and {allNotes.length} community notes to help answer your questions.
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
                <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
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
        </div>

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
      </div>
    </div>
  );
}

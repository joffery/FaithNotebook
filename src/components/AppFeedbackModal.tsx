import { useEffect, useState } from 'react';
import { MessageSquareQuote, Wrench, X } from 'lucide-react';

const FEEDBACK_CATEGORIES = [
  { value: 'bug_report', label: 'Bug report' },
  { value: 'feature_request', label: 'Feature request' },
  { value: 'improvement', label: 'Improvement idea' },
  { value: 'other', label: 'Other' },
] as const;

type AppFeedbackModalProps = {
  isOpen: boolean;
  currentBook: string;
  currentChapter: number;
  savedEmail?: string | null;
  userId?: string | null;
  displayName?: string | null;
  username?: string | null;
  churchAffiliation?: string | null;
  onClose: () => void;
  onSubmitted: (message: string) => void;
};

export function AppFeedbackModal({
  isOpen,
  currentBook,
  currentChapter,
  savedEmail,
  userId,
  displayName,
  username,
  churchAffiliation,
  onClose,
  onSubmitted,
}: AppFeedbackModalProps) {
  const normalizedSavedEmail = savedEmail?.trim() || '';
  const [category, setCategory] = useState<(typeof FEEDBACK_CATEGORIES)[number]['value']>('bug_report');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCategory('bug_report');
    setMessage('');
    setError('');
    setIsSubmitting(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setError('');

    if (message.trim().length < 10) {
      setError('Please share a little more detail so we can understand the issue or request.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/app-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category,
          message: message.trim(),
          contactEmail: normalizedSavedEmail || null,
          userId,
          displayName,
          username,
          churchAffiliation,
          source: 'main_feedback_modal',
          metadata: {
            currentBook,
            currentChapter,
          },
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.ok) {
        setError(result?.error || 'We could not submit your feedback right now.');
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onClose();
      onSubmitted('Thanks for sharing your feedback.');
    } catch {
      setError('We could not submit your feedback right now.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 overscroll-contain">
      <div className="flex max-h-[min(88vh,44rem)] w-full max-w-xl flex-col overflow-hidden rounded-[24px] border border-[#d7d1c8] bg-white shadow-2xl sm:max-w-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#ece6de] px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-2xl leading-none text-[#1f1813] sm:text-[2rem]">Share App Feedback</h3>
            <p className="mt-2 text-sm text-[#1f1813]/60 sm:text-base">
              Tell us what feels broken, missing, or worth improving in Faith Notebook.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#1f1813]/62 transition-colors hover:bg-[#efe7dd] hover:text-[#1f1813]"
            aria-label="Close app feedback dialog"
          >
            <X size={28} />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap gap-3">
            {FEEDBACK_CATEGORIES.map((option) => {
              const isSelected = category === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  className={`rounded-full border px-4 py-2.5 text-left text-sm transition-colors sm:px-6 sm:text-[1.05rem] ${
                    isSelected
                      ? 'border-[#1f1813] bg-[#1f1813] text-white'
                      : 'border-[#dbd6cf] bg-white text-[#1f1813] hover:bg-[#f5efe8]'
                  }`}
                  aria-pressed={isSelected}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div>
            <label htmlFor="app-feedback-message" className="mb-2 block text-sm font-medium text-[#1f1813]">
              What would you like us to know?
            </label>
            <div className="relative">
              <MessageSquareQuote size={18} className="absolute left-3 top-4 text-[#1f1813]/35" />
              <textarea
                id="app-feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Describe the bug, feature idea, or rough edge you ran into."
                rows={6}
                className="min-h-[160px] w-full rounded-2xl border border-[#dbd6cf] px-11 py-3 text-base text-[#1f1813] placeholder-[#1f1813]/42 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45 sm:text-lg"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-[#f2f0ec] px-4 py-3 text-sm leading-relaxed text-[#1f1813]/66 sm:text-base">
            Feedback helps improve the reading experience, sermon matching, AI responses, and the overall flow of the app.
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:text-base">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[#ece6de] pt-3 sm:pt-4">
            <div className="hidden items-center gap-2 text-sm text-[#1f1813]/48 sm:flex">
              <Wrench size={16} />
              <span>Current reading position: {currentBook} {currentChapter}</span>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="ml-auto rounded-full bg-[#c49a5c] px-6 py-2.5 text-base font-medium text-white transition-colors hover:bg-[#b38a4d] disabled:cursor-not-allowed disabled:bg-[#bdb8b3] disabled:opacity-70 sm:px-7 sm:py-3 sm:text-xl"
            >
              {isSubmitting ? 'Sending...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

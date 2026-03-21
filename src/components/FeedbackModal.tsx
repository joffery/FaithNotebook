import { X } from 'lucide-react';

export type FeedbackReasonOption = {
  value: string;
  label: string;
};

type FeedbackModalProps = {
  isOpen: boolean;
  title?: string;
  description?: string;
  reasons: FeedbackReasonOption[];
  selectedReason: string;
  details: string;
  detailsPlaceholder?: string;
  submitLabel?: string;
  onClose: () => void;
  onReasonChange: (reason: string) => void;
  onDetailsChange: (details: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
};

export function FeedbackModal({
  isOpen,
  title = 'Share feedback',
  description = 'Your feedback will help improve this app.',
  reasons,
  selectedReason,
  details,
  detailsPlaceholder = 'Share details (optional)',
  submitLabel = 'Submit',
  onClose,
  onReasonChange,
  onDetailsChange,
  onSubmit,
  isSubmitting = false,
}: FeedbackModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 overscroll-contain">
      <div className="w-full max-w-2xl rounded-[28px] border border-[#d7d1c8] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 px-6 py-5">
          <h3 className="text-[2rem] leading-none text-[#1f1813]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#1f1813]/62 transition-colors hover:bg-[#efe7dd] hover:text-[#1f1813]"
            aria-label="Close feedback dialog"
          >
            <X size={28} />
          </button>
        </div>

        <div className="space-y-5 px-6 pb-6">
          <div className="flex flex-wrap gap-3">
            {reasons.map((reason) => {
              const isSelected = selectedReason === reason.value;

              return (
                <button
                  key={reason.value}
                  type="button"
                  onClick={() => onReasonChange(reason.value)}
                  className={`rounded-full border px-6 py-3 text-left text-[1.05rem] transition-colors ${
                    isSelected
                      ? 'border-[#1f1813] bg-[#1f1813] text-white'
                      : 'border-[#dbd6cf] bg-white text-[#1f1813] hover:bg-[#f5efe8]'
                  }`}
                  aria-pressed={isSelected}
                >
                  {reason.label}
                </button>
              );
            })}
          </div>

          <textarea
            value={details}
            onChange={(event) => onDetailsChange(event.target.value)}
            placeholder={detailsPlaceholder}
            rows={3}
            className="w-full rounded-2xl border border-[#dbd6cf] px-5 py-4 text-lg text-[#1f1813] placeholder-[#1f1813]/42 focus:outline-none focus:ring-2 focus:ring-[#c49a5c]/45"
          />

          <div className="rounded-2xl bg-[#f2f0ec] px-5 py-4 text-lg text-[#1f1813]/66">
            {description}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!selectedReason || isSubmitting}
              className="rounded-full bg-[#bdb8b3] px-7 py-3 text-2xl font-medium text-white transition-colors hover:bg-[#aba59f] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Saving...' : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

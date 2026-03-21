export type FeedbackAction = 'set' | 'unset';

export type FeedbackPayload = {
  question: string;
  answer: string;
  feedbackKind: string;
  feedbackKey: string;
  feedbackGroupKey?: string;
  feedbackReason?: string;
  feedbackDetails?: string;
  userId?: string;
  anonymousSessionId?: string;
  feedbackActorKey?: string;
  action?: FeedbackAction;
  surface?: string;
  targetRef?: string;
  targetId?: string;
};

const FEEDBACK_QUEUE_STORAGE_KEY = 'faith-notebook-pending-feedback';

const loadPendingFeedbackQueue = () => {
  if (typeof window === 'undefined') return {} as Record<string, FeedbackPayload>;

  try {
    const raw = window.localStorage.getItem(FEEDBACK_QUEUE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as Record<string, FeedbackPayload> : {};
  } catch {
    return {};
  }
};

const savePendingFeedbackQueue = (queue: Record<string, FeedbackPayload>) => {
  if (typeof window === 'undefined') return;

  try {
    if (Object.keys(queue).length === 0) {
      window.localStorage.removeItem(FEEDBACK_QUEUE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(FEEDBACK_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage failures and still attempt direct delivery.
  }
};

const queueFeedbackPayload = (payload: FeedbackPayload) => {
  const queue = loadPendingFeedbackQueue();

  if (payload.feedbackGroupKey) {
    Object.entries(queue).forEach(([key, pending]) => {
      if (pending.feedbackGroupKey === payload.feedbackGroupKey && key !== payload.feedbackKey) {
        delete queue[key];
      }
    });
  }

  queue[payload.feedbackKey] = payload;
  savePendingFeedbackQueue(queue);
};

const clearQueuedFeedbackPayload = (feedbackKey: string) => {
  const queue = loadPendingFeedbackQueue();
  if (!queue[feedbackKey]) return;

  delete queue[feedbackKey];
  savePendingFeedbackQueue(queue);
};

const postFeedbackPayload = async (payload: FeedbackPayload) => {
  const response = await fetch('/api/ai-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      surface: payload.surface || 'ai_chat',
      question: payload.question,
      answer: payload.answer,
      feedbackKind: payload.feedbackKind,
      feedbackKey: payload.feedbackKey,
      feedbackGroupKey: payload.feedbackGroupKey,
      feedbackReason: payload.feedbackReason,
      feedbackDetails: payload.feedbackDetails,
      userId: payload.userId,
      anonymousSessionId: payload.anonymousSessionId,
      feedbackActorKey: payload.feedbackActorKey,
      action: payload.action || 'set',
      targetRef: payload.targetRef,
      targetId: payload.targetId,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || 'Feedback was not accepted by the server.');
  }
};

export const submitFeedbackWithRetry = async (payload: FeedbackPayload) => {
  try {
    await postFeedbackPayload(payload);
    clearQueuedFeedbackPayload(payload.feedbackKey);
    return { queued: false };
  } catch (error) {
    queueFeedbackPayload(payload);
    console.error('Feedback request failed, queued for retry:', error);
    return { queued: true };
  }
};

export const flushPendingFeedbackQueue = async () => {
  const queue = loadPendingFeedbackQueue();
  const remaining: Record<string, FeedbackPayload> = {};

  for (const payload of Object.values(queue)) {
    try {
      await postFeedbackPayload(payload);
    } catch (error) {
      remaining[payload.feedbackKey] = payload;
      console.error('Pending feedback retry failed:', error);
    }
  }

  savePendingFeedbackQueue(remaining);
  return { remainingCount: Object.keys(remaining).length };
};

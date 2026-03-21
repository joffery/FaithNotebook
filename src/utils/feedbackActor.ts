const FEEDBACK_ANONYMOUS_SESSION_STORAGE_KEY = 'faith-notebook-feedback-anonymous-session';

const createAnonymousSessionId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `anon-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
};

export const getAnonymousFeedbackSessionId = () => {
  if (typeof window === 'undefined') return 'anonymous-server';

  try {
    const existing = window.localStorage.getItem(FEEDBACK_ANONYMOUS_SESSION_STORAGE_KEY)?.trim();
    if (existing) return existing;

    const next = createAnonymousSessionId();
    window.localStorage.setItem(FEEDBACK_ANONYMOUS_SESSION_STORAGE_KEY, next);
    return next;
  } catch {
    return 'anonymous-storage-unavailable';
  }
};

export const buildFeedbackActorKey = (userId?: string | null, anonymousSessionId?: string | null) => {
  const normalizedUserId = userId?.trim();
  if (normalizedUserId) {
    return `user:${normalizedUserId}`;
  }

  const normalizedSessionId = anonymousSessionId?.trim();
  if (normalizedSessionId) {
    return `anon:${normalizedSessionId}`;
  }

  return 'anon:unknown';
};

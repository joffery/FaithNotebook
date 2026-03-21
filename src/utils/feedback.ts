export const hashFeedbackValue = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
};

export const buildFeedbackKey = (...parts: Array<string | number | null | undefined>) =>
  parts
    .map((part) => String(part ?? '').trim())
    .join('|');

export type PersistedFeedbackState = {
  feedbackKey: string;
  feedbackGroupKey?: string;
  feedbackKind: string;
  feedbackReason?: string;
  feedbackDetails?: string;
  surface: string;
  updatedAt: number;
};

const FEEDBACK_STATE_STORAGE_KEY = 'faith-notebook-feedback-state';

const getPersistedStateMap = (): Record<string, PersistedFeedbackState> => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(FEEDBACK_STATE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed as Record<string, PersistedFeedbackState> : {};
  } catch {
    return {};
  }
};

const savePersistedStateMap = (stateMap: Record<string, PersistedFeedbackState>) => {
  if (typeof window === 'undefined') return;

  try {
    if (Object.keys(stateMap).length === 0) {
      window.localStorage.removeItem(FEEDBACK_STATE_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(FEEDBACK_STATE_STORAGE_KEY, JSON.stringify(stateMap));
  } catch {
    // Ignore storage errors and keep feedback usable.
  }
};

const getPersistedStateKey = (feedbackGroupKey?: string, feedbackKey?: string) =>
  (feedbackGroupKey || feedbackKey || '').trim();

export const getPersistedFeedbackState = (feedbackGroupKey?: string, feedbackKey?: string) => {
  const stateKey = getPersistedStateKey(feedbackGroupKey, feedbackKey);
  if (!stateKey) return null;

  return getPersistedStateMap()[stateKey] || null;
};

export const savePersistedFeedbackState = (state: PersistedFeedbackState) => {
  const stateKey = getPersistedStateKey(state.feedbackGroupKey, state.feedbackKey);
  if (!stateKey) return;

  const stateMap = getPersistedStateMap();
  stateMap[stateKey] = state;
  savePersistedStateMap(stateMap);
};

export const clearPersistedFeedbackState = (feedbackGroupKey?: string, feedbackKey?: string) => {
  const stateKey = getPersistedStateKey(feedbackGroupKey, feedbackKey);
  if (!stateKey) return;

  const stateMap = getPersistedStateMap();
  if (!stateMap[stateKey]) return;

  delete stateMap[stateKey];
  savePersistedStateMap(stateMap);
};

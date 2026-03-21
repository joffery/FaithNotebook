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

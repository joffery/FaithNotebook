const SEARCH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'with',
  'your',
]);

const TOKEN_EQUIVALENTS: Record<string, string[]> = {
  baptize: ['baptize', 'baptized', 'baptizing', 'baptism'],
  baptized: ['baptize', 'baptized', 'baptizing', 'baptism'],
  baptism: ['baptize', 'baptized', 'baptizing', 'baptism'],
  disciple: ['disciple', 'disciples', 'discipleship'],
  discipleship: ['disciple', 'disciples', 'discipleship'],
  forgive: ['forgive', 'forgiven', 'forgiveness', 'forgiving'],
  forgiven: ['forgive', 'forgiven', 'forgiveness', 'forgiving'],
  forgiveness: ['forgive', 'forgiven', 'forgiveness', 'forgiving'],
  humble: ['humble', 'humbled', 'humbly', 'humility'],
  humility: ['humble', 'humbled', 'humbly', 'humility'],
  obey: ['obey', 'obeyed', 'obeying', 'obedience', 'obedient'],
  obedience: ['obey', 'obeyed', 'obeying', 'obedience', 'obedient'],
  repent: ['repent', 'repented', 'repenting', 'repentance'],
  repentance: ['repent', 'repented', 'repenting', 'repentance'],
  save: ['save', 'saved', 'saving', 'salvation'],
  salvation: ['save', 'saved', 'saving', 'salvation'],
  serve: ['serve', 'served', 'serving', 'service', 'servant'],
  servant: ['serve', 'served', 'serving', 'service', 'servant'],
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const getTokenVariants = (token: string): string[] => {
  const variants = new Set<string>([token]);
  const manual = TOKEN_EQUIVALENTS[token];
  if (manual) {
    manual.forEach((value) => variants.add(value));
  }

  if (token.length >= 4) {
    variants.add(`${token}s`);
    variants.add(`${token}ed`);
    variants.add(`${token}ing`);
    variants.add(`${token}er`);
    variants.add(`${token}ers`);
  }

  if (token.endsWith('e') && token.length >= 4) {
    variants.add(`${token}d`);
    variants.add(`${token.slice(0, -1)}ing`);
  }

  if (token.endsWith('y') && token.length >= 4) {
    variants.add(`${token.slice(0, -1)}ies`);
    variants.add(`${token.slice(0, -1)}ied`);
  }

  return unique(Array.from(variants).map(normalizeSearchText));
};

export type SearchMatcher = {
  hasQuery: boolean;
  normalizedQuery: string;
  tokens: Array<{
    raw: string;
    variants: string[];
  }>;
  scoreText: (...values: Array<string | null | undefined>) => number;
};

export function createSearchMatcher(query: string): SearchMatcher {
  const normalizedQuery = normalizeSearchText(query);
  const baseTokens = unique(
    normalizedQuery
      .split(' ')
      .filter(Boolean)
      .filter((token) => token.length >= 2 || /^\d+$/.test(token))
  );
  const significantTokens = baseTokens.filter((token) => !SEARCH_STOP_WORDS.has(token));
  const selectedTokens = (significantTokens.length > 0 ? significantTokens : baseTokens).slice(0, 8);
  const tokens = selectedTokens.map((raw) => ({
    raw,
    variants: getTokenVariants(raw),
  }));

  return {
    hasQuery: normalizedQuery.length > 0 && tokens.length > 0,
    normalizedQuery,
    tokens,
    scoreText: (...values) => {
      const normalizedValues = values
        .map((value) => normalizeSearchText(value || ''))
        .filter(Boolean);
      if (normalizedValues.length === 0 || tokens.length === 0) return 0;

      const combined = normalizedValues.join(' ');
      const bounded = ` ${combined} `;
      let score = 0;
      let matchedTokenCount = 0;

      if (normalizedQuery && combined.includes(normalizedQuery)) {
        score += 18;
      }

      tokens.forEach((token) => {
        let tokenScore = 0;

        token.variants.forEach((variant) => {
          if (!variant) return;

          if (bounded.includes(` ${variant} `)) {
            tokenScore = Math.max(tokenScore, 9);
            return;
          }

          if (combined.includes(variant)) {
            tokenScore = Math.max(tokenScore, 6);
          }
        });

        if (tokenScore > 0) {
          matchedTokenCount += 1;
          score += tokenScore;
        }
      });

      if (matchedTokenCount === 0) return 0;

      if (matchedTokenCount === tokens.length) {
        score += 10;
      } else if (matchedTokenCount >= Math.ceil(tokens.length / 2)) {
        score += 4;
      }

      return score;
    },
  };
}

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

const TOKEN_SYNONYM_GROUPS = [
  ['baptize', 'baptized', 'baptizing', 'baptism'],
  ['believe', 'belief', 'believing', 'faith', 'trust', 'trusted'],
  ['church', 'churches', 'body', 'congregation', 'fellowship', 'kingdom'],
  ['disciple', 'disciples', 'discipleship', 'follower', 'followers'],
  ['evil', 'wicked', 'wickedness', 'sin', 'sins', 'sinful'],
  ['fear', 'fears', 'afraid', 'anxious', 'anxiety', 'worry', 'worried'],
  ['forgive', 'forgiven', 'forgiveness', 'forgiving', 'mercy', 'merciful'],
  ['grace', 'gracious', 'favor', 'favour'],
  ['grief', 'grieve', 'grieving', 'sorrow', 'sorrows', 'mourning', 'mourn'],
  ['holy', 'holiness', 'righteous', 'righteousness'],
  ['humble', 'humbled', 'humbly', 'humility', 'meek', 'meekness'],
  ['joy', 'joyful', 'rejoice', 'rejoicing', 'glad', 'gladness'],
  ['love', 'loved', 'loving', 'beloved', 'compassion'],
  ['obey', 'obeyed', 'obeying', 'obedience', 'obedient', 'submit', 'submission'],
  ['pray', 'prayer', 'praying', 'prayed'],
  ['proud', 'pride', 'arrogant', 'boast', 'boasting'],
  ['repent', 'repented', 'repenting', 'repentance', 'turn', 'turning'],
  ['save', 'saved', 'saving', 'salvation', 'rescue', 'rescued'],
  ['serve', 'served', 'serving', 'service', 'servant', 'servants'],
  ['teach', 'teacher', 'teaching', 'doctrine', 'instruction'],
  ['true', 'truth', 'truthful'],
];

const TOKEN_EQUIVALENTS: Record<string, string[]> = Object.fromEntries(
  TOKEN_SYNONYM_GROUPS.flatMap((group) =>
    group.map((token) => [token, group.filter((candidate) => candidate !== token)])
  )
);

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const stemSearchToken = (token: string): string => {
  let stem = normalizeSearchText(token);
  if (!stem) return stem;

  if (stem.length > 6 && stem.endsWith('ility')) {
    stem = `${stem.slice(0, -5)}le`;
  } else if (stem.length > 5 && stem.endsWith('ness')) {
    stem = stem.slice(0, -4);
  } else if (stem.length > 5 && stem.endsWith('ment')) {
    stem = stem.slice(0, -4);
  } else if (stem.length > 5 && stem.endsWith('tion')) {
    stem = stem.slice(0, -4);
  } else if (stem.length > 5 && stem.endsWith('ance')) {
    stem = stem.slice(0, -4);
  } else if (stem.length > 5 && stem.endsWith('ence')) {
    stem = stem.slice(0, -4);
  }

  if (stem.length > 5 && stem.endsWith('ies')) {
    stem = `${stem.slice(0, -3)}y`;
  } else if (stem.length > 5 && stem.endsWith('ing')) {
    stem = stem.slice(0, -3);
  } else if (stem.length > 4 && stem.endsWith('ied')) {
    stem = `${stem.slice(0, -3)}y`;
  } else if (stem.length > 4 && stem.endsWith('ed')) {
    stem = stem.slice(0, -2);
  } else if (stem.length > 4 && stem.endsWith('es')) {
    stem = stem.slice(0, -2);
  } else if (stem.length > 3 && stem.endsWith('s')) {
    stem = stem.slice(0, -1);
  }

  if (stem.length > 4 && /([b-df-hj-np-tv-z])\1$/.test(stem)) {
    stem = stem.slice(0, -1);
  }

  return stem;
};

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

const hasNearTypoMatch = (needle: string, haystack: string): boolean => {
  if (!needle || !haystack) return false;
  if (needle === haystack) return true;

  const needleLength = needle.length;
  const haystackLength = haystack.length;
  if (needleLength < 4 || haystackLength < 4) return false;
  if (Math.abs(needleLength - haystackLength) > 1) return false;
  if (needle[0] !== haystack[0]) return false;

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < needleLength && j < haystackLength) {
    if (needle[i] === haystack[j]) {
      i += 1;
      j += 1;
      continue;
    }

    edits += 1;
    if (edits > 1) return false;

    if (needleLength > haystackLength) {
      i += 1;
    } else if (needleLength < haystackLength) {
      j += 1;
    } else {
      i += 1;
      j += 1;
    }
  }

  if (i < needleLength || j < haystackLength) {
    edits += 1;
  }

  return edits <= 1;
};

export type SearchMatcher = {
  hasQuery: boolean;
  normalizedQuery: string;
  tokens: Array<{
    raw: string;
    variants: string[];
    stems: string[];
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
    stems: unique(getTokenVariants(raw).map(stemSearchToken)),
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
      const textTokens = unique(combined.split(' ').filter(Boolean));
      const textStems = new Set(textTokens.map(stemSearchToken).filter(Boolean));
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

        if (tokenScore === 0 && token.stems.length > 0) {
          const hasStemMatch = token.stems.some((stem) => stem.length >= 3 && textStems.has(stem));
          if (hasStemMatch) {
            tokenScore = 5;
          }
        }

        if (tokenScore === 0 && token.stems.length > 0) {
          const hasTypoMatch = token.stems.some((stem) =>
            stem.length >= 4 &&
            Array.from(textStems).some((textStem) => hasNearTypoMatch(stem, textStem))
          );
          if (hasTypoMatch) {
            tokenScore = 4;
          }
        }

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

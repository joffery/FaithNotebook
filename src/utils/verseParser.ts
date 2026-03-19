export type ParsedVerse = {
  book: string;
  chapter: number;
  verse: number;
};

const BOOK_NAME_ALIASES: Record<string, string> = {
  Psalm: 'Psalms',
  Psalms: 'Psalms',
  Proverbs: 'Proverbs',
  Song: 'Song of Solomon',
  'Song of Songs': 'Song of Solomon',
  Canticles: 'Song of Solomon',
};

export function normalizeBibleBookName(book: string): string {
  const trimmed = book.trim();
  return BOOK_NAME_ALIASES[trimmed] || trimmed;
}

export function parseVerseReference(verseRef: string): ParsedVerse[] {
  const match = verseRef.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return [];

  const book = normalizeBibleBookName(match[1]);
  const chapter = parseInt(match[2], 10);
  const startVerse = parseInt(match[3], 10);
  const endVerse = match[4] ? parseInt(match[4], 10) : startVerse;

  const verses: ParsedVerse[] = [];
  for (let verse = startVerse; verse <= endVerse; verse++) {
    verses.push({ book, chapter, verse });
  }

  return verses;
}

export function getRandomCommunityName(userId: string): string {
  const names = [
    'Brother A',
    'Brother B',
    'Brother C',
    'Brother D',
    'Sister E',
    'Sister F',
    'Sister G',
    'Sister H'
  ];

  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return names[hash % names.length];
}

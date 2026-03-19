import fs from 'fs/promises';
import path from 'path';

const sermonsPath = path.join(process.cwd(), 'src', 'data', 'sermons_processed.json');
const bibleTextPath = path.join(process.cwd(), 'src', 'data', 'bibleText.ts');

function parseVerseReference(ref) {
  // supports: "BookName 3:16" or "1 John 3:15" or ranges like "John 14:12-14"
  const m = ref.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
  if (!m) return [];
  const book = m[1].trim();
  const chapter = parseInt(m[2], 10);
  if (!m[3]) return [{ book, chapter, verse: null }];
  const start = parseInt(m[3], 10);
  const end = m[4] ? parseInt(m[4], 10) : start;
  const out = [];
  for (let v = start; v <= end; v++) out.push({ book, chapter, verse: v });
  return out;
}

async function run() {
  const sermonsRaw = await fs.readFile(sermonsPath, 'utf8');
  const sermons = JSON.parse(sermonsRaw);

  const content = await fs.readFile(bibleTextPath, 'utf8');

  // find existing keys like 'John-14'
  const existing = new Set();
  for (const m of content.matchAll(/'([^']+-\d+)'\s*:/g)) existing.add(m[1]);

  // also load bibleBooks to ensure full coverage of all chapters
  const bibleBooksPath = path.join(process.cwd(), 'src', 'data', 'bibleBooks.ts');
  let bibleBooksContent = '';
  try {
    bibleBooksContent = await fs.readFile(bibleBooksPath, 'utf8');
  } catch (err) {
    console.warn('Could not read bibleBooks.ts, skipping full-chapter generation');
  }
  const allChapterKeys = new Set();
  if (bibleBooksContent) {
    for (const m of bibleBooksContent.matchAll(/\{\s*name:\s*'([^']+)',\s*chapters:\s*(\d+)\s*\}/g)) {
      const book = m[1];
      const chapters = parseInt(m[2], 10);
      for (let c = 1; c <= chapters; c++) allChapterKeys.add(`${book}-${c}`);
    }
  }

  // collect referenced verses from sermons
  const needed = new Map(); // key -> Set of verses (numbers or null)

  for (const s of sermons) {
    if (!s.verse_insights) continue;
    for (const vi of s.verse_insights) {
      const parsed = parseVerseReference(vi.verse);
      for (const p of parsed) {
        const key = `${p.book}-${p.chapter}`;
        if (!needed.has(key)) needed.set(key, new Set());
        if (p.verse == null) {
          // mark chapter presence by adding marker 0
          needed.get(key).add(0);
        } else {
          needed.get(key).add(p.verse);
        }
      }
    }
  }

  // determine missing keys referenced by sermons
  const missingFromSermons = [];
  for (const [key, verses] of needed.entries()) {
    if (!existing.has(key)) missingFromSermons.push({ key, verses });
  }

  // determine all chapters missing (for full bible placeholders)
  const missingAllChapters = [];
  for (const key of allChapterKeys) {
    if (!existing.has(key)) {
      // verses set empty -> will create placeholder verse
      missingAllChapters.push({ key, verses: new Set([0]) });
    }
  }

  // merge both lists, avoiding duplicates
  const missingMap = new Map();
  for (const m of [...missingAllChapters, ...missingFromSermons]) {
    if (!missingMap.has(m.key)) missingMap.set(m.key, m.verses);
    else {
      for (const v of m.verses) missingMap.get(m.key).add(v);
    }
  }

  const missing = Array.from(missingMap.entries()).map(([key, verses]) => ({ key, verses }));

  if (missing.length === 0) {
    console.log('No missing chapters to add.');
    return;
  }

  // build text to insert
  const entries = missing.map(({ key, verses }) => {
    const [book, chapterStr] = key.split('-');
    const chapter = parseInt(chapterStr, 10);
    // turn verses set into sorted array, ignore marker 0 when listing verses
    const verseNums = Array.from(verses).filter(v => v !== 0).map(Number).sort((a,b)=>a-b);
    let versesText = '';
    if (verseNums.length === 0) {
      // only chapter marker: create a single placeholder verse 1
      versesText = `      { verse: 1, text: 'Verse text not available.' },\n`;
    } else {
      versesText = verseNums.map(v => `      { verse: ${v}, text: 'Verse text not available.' },`).join('\n') + '\n';
    }

    return `  '${key}': {\n    book: '${book}',\n    chapter: ${chapter},\n    verses: [\n${versesText}    ],\n  },\n`;
  }).join('\n');

  // insert before the closing "};" that ends the bibleChapters object
  const marker = '\n};\n\nexport function getBibleChapter';
  const idx = content.indexOf(marker);
  if (idx === -1) {
    console.error('Could not find insertion point in bibleText.ts');
    return;
  }

  const newContent = content.slice(0, idx) + '\n' + entries + content.slice(idx);
  await fs.writeFile(bibleTextPath, newContent, 'utf8');

  console.log(`Inserted ${missing.length} chapter(s) into src/data/bibleText.ts`);

  // also write an index of chapters that have sermon insights
  const sermonChapterKeys = Array.from(needed.keys());
  const sermonIndexPath = path.join(process.cwd(), 'src', 'data', 'sermonIndex.json');
  const sermonIndex = { chapters: sermonChapterKeys };
  await fs.writeFile(sermonIndexPath, JSON.stringify(sermonIndex, null, 2), 'utf8');
  console.log(`Wrote sermon index with ${sermonChapterKeys.length} entries to src/data/sermonIndex.json`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

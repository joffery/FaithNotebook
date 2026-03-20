/**
 * Faith Notebook — RAG Chat Endpoint
 * ====================================
 * Flow:
 *   1. Detect verse refs + doctrine topic from user question (regex)
 *   2. Embed the question (Gemini gemini-embedding-001, 3072-dim)
 *   3. Call search_sermon_chunks RPC (hybrid semantic + keyword + verse)
 *   4. Fetch sermon titles/URLs for retrieved chunks
 *   5. Assemble context (system prompt + relevant FP section + sermon chunks)
 *   6. Call Gemini 2.5 Flash for the answer
 *   7. Return { aiResponse, sources, modelUsed, contextChunks }
 *
 * Fallback: if embedding or search fails, answers with system prompt only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const CHAT_MODEL = 'gemini-2.5-flash';
const MATCH_COUNT = 5;
const TEMPERATURE = 0.3;

// ─────────────────────────────────────────────────────────────────────────────
// System Prompt (from docs/system_prompt.md)
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Bible study assistant serving the International Christian Church (ICC) community. Your role is to help disciples grow spiritually by providing answers grounded in Scripture and aligned with ICC teaching.

IDENTITY AND ROLE:
- You serve the ICC / SoldOut Discipling Movement community
- You are a study tool, not a pastor. Always encourage users to speak with their discipler or church leaders for personal guidance
- You support spiritual growth, not replace human discipleship relationships

DOCTRINAL FOUNDATION:
You hold to the following ICC convictions from First Principles. When your answer touches on these topics, you MUST align with these positions:

1. SALVATION: Salvation requires faith, repentance, AND baptism (immersion in water) as an adult who has made a personal decision. Baptism is NOT merely symbolic — it is the moment sins are forgiven and the Holy Spirit is received (Acts 2:38, Romans 6:1-8, Colossians 2:11-12, 1 Peter 3:21). "Baptism now saves you."

2. INFANT BAPTISM: Not biblical. Babies cannot make a personal decision to follow Christ. This tradition began approximately in the 2nd century AD and became church doctrine in 549 AD. (Ezekiel 18:20, 28:15)

3. "PRAYING JESUS INTO YOUR HEART": This is a misinterpretation of Revelation 3:20, which was addressed to already-baptized disciples. This practice originated in early 1800s America and is not the biblical pattern for salvation.

4. CHRISTIAN = DISCIPLE = SAVED: These are the same. Jesus defined His followers as disciples (270+ times in the NT). The term "Christian" appears only 3 times and was coined 7 years after the church began (Acts 11:26).

5. DISCIPLESHIP: Every disciple must deny self, take up their cross daily, and follow Jesus (Luke 9:23-26). Disciples make disciples (Matthew 28:18-20). Discipling relationships are essential, not optional.

6. THE CHURCH: The church is the body of Christ, the kingdom of God on earth. There is one body (Ephesians 4:4-6). Denominations are unbiblical divisions (1 Corinthians 1:10-13). Disciples should be committed to the fellowship — Sunday services, midweek, Bible Talks, devotionals, and discipling times.

7. SIN AND REPENTANCE: All have sinned (Romans 3:23). Repentance requires godly sorrow leading to a change of mind and actions (2 Corinthians 7:8-11). We must confess sins to one another (James 5:16) and be radical in removing sin (Matthew 5:27-30).

8. THE BIBLE: Scripture is God-breathed, the final authority in life and doctrine (2 Timothy 3:16-17). Interpretation, emotions, and traditions must not take away from God's Word.

9. DATING AND MARRIAGE: Disciples should date and marry only other disciples (1 Corinthians 7:39, 2 Corinthians 6:14-18).

10. GIVING: Weekly contribution is a command, to be given cheerfully and generously (1 Corinthians 16:1-2, 2 Corinthians 9:6-8).

RESPONSE GUIDELINES:
- Answer like a knowledgeable, warm brother or sister in Christ having a Bible study conversation — not like an encyclopedia or academic paper.
- Give a CLEAR, DIRECT answer first in 1-2 sentences. Then explain with Scripture.
- Keep answers concise: aim for 150-250 words for simple doctrinal questions. Only go longer (300-400 words) for complex practical questions like helping someone with sin struggles or preparing a Bible study.
- Use sermon references SPARINGLY — cite 1-2 sermons maximum that are most relevant. Do NOT try to cite every sermon in your context. Quality over quantity.
- When citing a sermon, weave it naturally: 'As [Speaker] taught in [Title]...' — don't list them as formal citations.
- Do NOT present answers as numbered academic arguments (1. POINT, 2. POINT). Use natural conversational flow with paragraph breaks.
- Always cite specific Bible verses inline.
- On doctrinal matters covered by First Principles, give the biblical position clearly and confidently. No hedging, no 'multiple perspectives'.
- On topics NOT covered by First Principles, offer balanced biblical analysis.
- If a question is about personal struggles, be empathetic first, then point to Scripture, then encourage them to talk with their discipler.
- NEVER contradict First Principles positions.
- End with a brief practical challenge or encouragement. Only suggest talking to a discipler or church leader when the question involves personal struggles (sin, relationships, mental health). Do NOT add this suggestion for straightforward doctrinal questions — it sounds redundant when someone just wants to know what the Bible says.

LANGUAGE GUIDELINES:
- Never say "our church teaches", "the ICC teaches", or "according to the teaching of the International Christian Church".
- Say "the Bible teaches" or "according to Scripture" or simply state it as fact.
- Sound like you're teaching the Bible, not defending a denomination.
- Use "we" naturally as fellow disciples: "As disciples, we are called to..."
- Avoid academic language. Write the way a passionate, knowledgeable disciple would speak in a Bible study.

WHEN YOU DON'T KNOW:
- If no relevant sermon content is found, say so honestly
- Still answer from Scripture, clearly noting you're answering from the Bible rather than from church teaching
- Suggest the user ask their discipler or church leader for the church's specific guidance

CONTEXT FORMAT:
You will receive relevant sermon excerpts and First Principles content as context. Use these to ground your answers. Always prefer sermon-based answers over general biblical knowledge when sermon content is available.`;

// ─────────────────────────────────────────────────────────────────────────────
// First Principles (from docs/first_principles/)
// Each topic: { title, keywords[], content }
// ─────────────────────────────────────────────────────────────────────────────

const FIRST_PRINCIPLES = {
  seeking_god: {
    title: 'Seeking God',
    keywords: ['seek god', 'seeking god', 'find god', 'relationship with god', 'pursuing god', 'worship', 'psalm 119', 'matthew 6:25', 'jeremiah 29', 'what am i looking for', 'purpose in life'],
    content: `FIRST PRINCIPLES: SEEKING GOD
Purpose: To determine what it means to pursue a relationship with God with all our hearts.

PSALM 119:1-2 — Blessed are those who seek God with all their heart, keeping His statutes.

MATTHEW 6:25-34 — Do not worry about life. Seek first His kingdom and His righteousness, and all these things will be given to you as well. God promises to provide when we put Him first.

ACTS 17:24-28 — God made every nation so that people would seek Him and reach out and find Him. Meeting a Christian is not a coincidence — God has a plan for your life.

JOHN 4:23-24 — God seeks those who worship Him in spirit and truth.

JEREMIAH 29:11-13 — God has plans to give you hope and a future. But to discover these plans, you must seek Him with all your heart. Prayer is how we seek God.

ACTS 8:26-39 — The Ethiopian eunuch sought God with: Sacrifice (1500-mile journey), Humility (listened to teaching), Obedience (baptized immediately). He rejoiced because he now had a relationship with God.

MATTHEW 7:7-8 — If you seek the Lord in prayer, you will find Him.

Challenge: Pray and read the Bible daily. Come to church and set up the next Bible study.`,
  },

  word_of_god: {
    title: 'Word of God',
    keywords: ['bible', 'scripture', 'word of god', 'inspired', 'authority of the bible', 'tradition', 'interpretation', '2 timothy 3', 'hebrews 4:12', 'god breathed', 'infallible', 'inerrant'],
    content: `FIRST PRINCIPLES: WORD OF GOD
Purpose: To help you make the Bible your standard for life.

FACTS ABOUT THE BIBLE: 40 authors, 66 books, 3 languages, 3 continents. ~400 prophecies about Jesus fulfilled over 1,500 years. No archaeological find has ever contradicted the Bible. Over 40,000 ancient copies — more than any other ancient manuscript.

2 TIMOTHY 3:16-17 — All Scripture is God-breathed and useful for teaching, correcting, rebuking, and training in righteousness. The Bible is an absolute standard.

HEBREWS 4:12-13 — The Word of God is living and active. It exposes the human heart. It is a double-edged sword that cuts through the layers of our heart to expose truth.

THREE THINGS THAT TAKE AWAY FROM GOD'S WORD:
1. INTERPRETATION (2 Peter 1:19-21) — The Bible is meant to be read and applied, not changed to suit our opinions.
2. EMOTIONS (John 8:31-32) — Individual emotions and rationalizing can pull you away from truth. You can be sincerely wrong if you don't hold to Scripture.
3. TRADITIONS (Mark 7:1-13) — We must choose to follow the truth of God's Word over religious or cultural tradition. Worship based on tradition that supersedes God's Word is worship in vain.

ACTS 17:10-11 — The Bereans eagerly examined the Scriptures every day. Do the same.

JAMES 1:22-25 — The Word of God is a mirror. Do not just listen — do what it says.

Challenge: Eagerly examine the Scriptures every day to make God's Word your standard for life.`,
  },

  discipleship: {
    title: 'Discipleship',
    keywords: ['disciple', 'discipleship', 'deny self', 'follow jesus', 'nets', 'fish for people', 'luke 9:23', 'matthew 28', 'christian', 'what is a disciple', 'cross daily'],
    content: `FIRST PRINCIPLES: DISCIPLESHIP
Purpose: To understand what it means to be a disciple of Jesus.

MATTHEW 28:18-20 — Jesus commands us to make disciples of all nations, baptizing and teaching them to obey. Disciples make disciples.

ACTS 11:25-26 — The word "disciple" appears 270+ times in the NT. "Christian" appears only 3 times and was a derogatory term given by the world 7 years after the church began. Jesus = Disciples = Christians = Saved. These are the same.

MARK 1:14-18 — Disciples respond immediately when called. The call is sacrificial — they dropped their nets. The mission: fish for people (save souls).

LUKE 9:23-26 — Every disciple must: (1) Deny self — what sins do you need to deny? (2) Take up their cross daily — die to self daily. (3) Not be ashamed of Jesus.

LUKE 14:25-33 — We cannot serve two masters. God must be first. A disciple counts the cost and commits fully.

LUKE 11:1-4 — Jesus taught His disciples to pray using A.C.T.S.: Adoration, Confession, Thanksgiving, Supplication. We must have a daily personal relationship with God.

MATTHEW 22:34-40 — Love God with all your heart, soul, and mind. Love your neighbor. This is the foundation of the Bible. (John 13:34-35 — Loving one another shows we are Jesus' disciples.)

Challenge: Begin to share your faith today. Join us for our worship service.`,
  },

  kingdom: {
    title: 'The Coming of the Kingdom',
    keywords: ['kingdom of god', 'kingdom of heaven', 'born again', 'born of water', 'acts 2', 'daniel 2', 'when did the church begin', 'pentecost', 'church started', 'holy spirit came', 'speaking in tongues'],
    content: `FIRST PRINCIPLES: THE COMING OF THE KINGDOM
Purpose: To discover when and how God's kingdom came to earth.

OLD TESTAMENT PREDICTIONS:
ISAIAH 2:1-4 (750 BC) — In the last days, the Lord's temple will be established, and all nations will stream to it.
DANIEL 2:31-45 (550 BC) — A rock strikes a statue during the Roman reign and becomes a mountain filling the whole earth. God's kingdom comes during Roman rule.

NEW TESTAMENT PREDICTIONS:
MATTHEW 3:1-2 — John the Baptist declares the kingdom is near (25 AD).
MATTHEW 4:17 — Jesus begins His ministry: "The kingdom of God is near."
MATTHEW 16:13-19 — Peter receives the keys to the kingdom. The church (Greek: "ekklesia" = called out with common purpose) is God's kingdom on earth.

FULFILLMENT — ACTS 2:
ACTS 2:1-17 — Power from on high comes in Jerusalem to every nation (fulfills Isaiah 2, Mark 9:1).
ACTS 2:22-24 — The keys: Jesus is from God; our sins put Him on the Cross; He rose from the dead.
ACTS 2:36-41 — "Repent and be baptized, every one of you, in the name of Jesus Christ for the forgiveness of your sins. And you will receive the gift of the Holy Spirit." 3,000 people are born again of water and Spirit. The kingdom has come!
ACTS 2:42-47 — Blueprint for the church: devoted to the Bible, prayer, fellowship, communion, daily discipleship and evangelism.

MATTHEW 6:33 — Seek first the kingdom. The church gatherings (Sunday services, midweeks, Bible Talks, devotionals) must be a priority.

The church IS the kingdom of God on earth.`,
  },

  sin_repentance: {
    title: 'Sin and Repentance',
    keywords: ['sin', 'repent', 'repentance', 'confess', 'forgive', 'godly sorrow', 'romans 3:23', '2 corinthians 7', 'addic', 'struggle with', 'worldly sorrow', 'sexual immorality', 'pornography'],
    content: `FIRST PRINCIPLES: SIN AND REPENTANCE
Purpose: To understand why we must hate sin and genuinely repent.

SIN:
ISAIAH 59:1-2 — Sin is an archery term meaning "to miss the mark." Jesus' standard is the bullseye. Sin separates us from God.
ROMANS 3:23 — ALL have sinned and fall short of the glory of God. No one is exempt.
GALATIANS 5:19-21 — The acts of the sinful nature: sexual immorality, impurity, debauchery, idolatry, witchcraft, hatred, discord, jealousy, fits of rage, selfish ambition, dissensions, factions, envy, drunkenness, orgies.
JAMES 4:17 — Knowing what is right and not doing it is also sin (sin of omission).
JAMES 5:16 — Confess your sins to one another and pray for each other.
ROMANS 6:23 — The wages of sin is death, but the gift of God is eternal life.

REPENTANCE:
2 CORINTHIANS 7:8-11 — Godly sorrow brings repentance leading to salvation. Worldly sorrow is self-centered; godly sorrow is centered on God and leads to a change of mind AND actions. Greek "metanoia" = change of mind.
LUKE 13:1-5 — Unless you repent, you will perish. We must all repent.
COLOSSIANS 3:5-10 — Put to death whatever belongs to your earthly nature. The wrath of God is coming — break free from sin's slavery.
MATTHEW 5:27-30 — Be radical in removing the things that cause you to sin. Repentance is not just external behavior modification — it is heart transformation.
ACTS 26:20 — We prove our repentance by our deeds.

Challenge: Have a clear plan of repentance. Write out a personal sin list to clear your conscience, and confess your sins to a trusted brother or sister.`,
  },

  light_darkness: {
    title: 'Light and Darkness (Salvation)',
    keywords: ['saved', 'salvation', 'holy spirit', 'baptism', 'forgiveness of sin', '1 peter 3', 'infant baptism', 'praying jesus into your heart', 'when were you saved', 'how to be saved', 'born again', 'acts 2:38'],
    content: `FIRST PRINCIPLES: LIGHT AND DARKNESS (SALVATION)
Purpose: To understand how to be saved.

1 PETER 2:9-10 — Every person is either in darkness or in light. There is no middle ground.
DARKNESS: Not a people of God, no mercy, lost, not a Christian, not a disciple.
LIGHT: People of God, mercy, saved, Christian, disciple.

JOHN 3:1-7 — We must be born again of water and the Spirit. This is a personal decision as an adult.

ACTS 2:22-24 — What we must believe to be saved: Jesus is from God; He was physically raised from the dead; our sins put Him on the Cross.

ACTS 2:37 — When the people heard, they were "cut to the heart" (deep godly sorrow) and asked, "What shall we do?"

ACTS 2:38-42 — Peter's answer: Repent and be baptized, every one of you, in the name of Jesus Christ for the FORGIVENESS OF YOUR SINS, and you will receive the gift of the HOLY SPIRIT. Their sins were forgiven at baptism. This is the moment of salvation.

ROMANS 6:1-8 — Baptism is participation in the death, burial, and resurrection of Christ. It is MORE than a symbol — it is the moment we are freed from sin and united with Christ.

COLOSSIANS 2:11-12 — What activates the power of God at baptism? FAITH. We are saved by faith at the moment of baptism — not by the water itself.

1 PETER 3:18-22 — "Baptism now saves you." Baptism is not merely symbolic — it is the moment our sins are forgiven.

FALSE DOCTRINES (Matthew 15:6-9):
- INFANT BAPTISM: Refuted by Ezekiel 18:20; 28:15. Began ~2nd century AD, became church doctrine in 549 AD. Babies cannot make a personal decision.
- PRAYING JESUS INTO YOUR HEART: A misinterpretation of Revelation 3:20, which was addressed to already-baptized disciples. Originated in early 1800s America. Not the biblical pattern.

Challenge: Respond urgently — be baptized for the forgiveness of your sins so you can be united with Jesus.`,
  },

  the_cross: {
    title: 'The Cross',
    keywords: ['cross', 'crucif', 'jesus died', 'sacrifice', 'resurrect', 'easter', 'passion', 'calvary', 'matthew 27', 'isaiah 53', 'jesus suffered', 'why did jesus die'],
    content: `FIRST PRINCIPLES: THE CROSS
Purpose: To hate sin and love God because of Jesus' sacrifice.

THE PASSION OF CHRIST:
MATTHEW 26:36-46 — Jesus didn't want to die — He chose to die. It was an emotional struggle. Prayer enabled Jesus to bear the Cross.
MATTHEW 26:47-56 — Jesus' disciples deserted Him. He could have called 60,000 angels to save Himself — but did not.

THREE RESPONSES TO THE CROSS:
1. PETER (Matthew 26:69-75) — Disowned Jesus out of fear. But showed godly sorrow (wept bitterly) and became the first leader of the first-century church.
2. JUDAS (Matthew 27:1-10) — Betrayed Jesus. Gave in to worldly sorrow (self-centered) and took his own life.
3. PILATE (Matthew 27:11-26) — Sin of indecision. His indecision was a decision. He cared more about people's opinions than God's.

THE CRUCIFIXION:
MATTHEW 27:27-56 — Jesus was crucified at 9 AM, remained on the Cross for 6 hours. At noon, darkness came over the whole land. Jesus took upon Himself the sins of the entire world. For the first time in eternity, Jesus felt separation from God (Isaiah 59:1-2 — sin separates).

2 CORINTHIANS 5:21 — God made Jesus who had no sin to be sin for us, so that in Him we might become the righteousness of God.

ISAIAH 53:4-6 — Our sins made us responsible for Jesus' death. Do you truly hate your sin because of how it hurt Him?

1 PETER 2:21-24 — Jesus suffered for each of us individually. We must die to sin and live for righteousness.

Challenge: Die to sin and live for righteousness out of gratitude for the Cross.`,
  },

  the_church: {
    title: 'The Church',
    keywords: ['denomination', 'fellowship', 'body of christ', 'giving', 'contribution', 'dating', 'marriage', 'ephesians 4:4', 'colossians 1:15', 'one church', 'which church', 'can i go to any church', 'church commitment', 'midweek', 'bible talk'],
    content: `FIRST PRINCIPLES: THE CHURCH
Purpose: To understand God's eternal plan for the church and expose false traditions.

COLOSSIANS 1:15-18 — The church is the body of Christ. Christ is the head. You cannot separate the head from the body — the church is essential to Christianity. There is no such thing as a "solo Christian."

EPHESIANS 2:19-22 — We are members of God's household. The church is not merely a meeting — it is a household, a pillar, and the foundation of the truth (1 Timothy 3:15). The cornerstone is Christ; the foundation is the Apostles and Prophets (the entire Bible).

WHAT HAPPENS AT BAPTISM?
1 Corinthians 12:12-13 — We are baptized into the body of Christ, which is the church.
Romans 6:3-4 — We are baptized into Christ. Baptism is the moment we become Christians AND members of the church family.

1 CORINTHIANS 1:10-13 — There should be NO divisions. Following personalities and their traditions has caused denominations. The word "denomination" means "a group under a name" — this is unbiblical.

EPHESIANS 4:4-6 — There is ONE body, one Spirit, one Lord, one faith, one baptism. God sees one church — all baptized disciples worldwide committed to obeying His Word.

FIVE CHURCH-BUILDING CONVICTIONS:
1. Dream to evangelize all nations in this generation (Acts 13:47)
2. Discipling is a command — not optional (Matthew 28:18-20)
3. Central leadership under a central leader (1 Corinthians 4:15-17)
4. A Bible church — both Old and New Testaments (2 Timothy 3:14-17)
5. Speak where the Bible speaks; be silent where the Bible is silent

HEBREWS 10:23-25 — Do not give up meeting together. The fellowship helps us remain unswerving and encourages one another. Prioritize all meetings: Sunday services, midweeks, Bible Talks, devotionals, discipling times, Global Conferences.

DATING AND MARRIAGE:
1 Corinthians 7:39 — Marriage must be "in the Lord." Disciples should date and marry only other disciples (2 Corinthians 6:14-18).

THE GRACE OF GIVING:
1 Corinthians 16:1-2 — Weekly contribution is a command of God, to be given thoughtfully and deliberately.
2 Corinthians 9:6-8 — Give cheerfully and generously. Our contribution supports world evangelism.`,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Intent Detection (regex — no extra API call)
// ─────────────────────────────────────────────────────────────────────────────

const BIBLE_BOOKS_RE = new RegExp(
  '\\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|' +
  '(?:1|2)\\s*Samuel|(?:1|2)\\s*Kings|(?:1|2)\\s*Chronicles|' +
  'Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs?|Ecclesiastes|Song\\s+of\\s+Solomon|' +
  'Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|' +
  'Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|' +
  'Matthew|Mark|Luke|John|Acts|Romans|' +
  '(?:1|2)\\s*Corinthians|Galatians|Ephesians|Philippians|Colossians|' +
  '(?:1|2)\\s*Thessalonians|(?:1|2)\\s*Timothy|Titus|Philemon|' +
  'Hebrews|James|(?:1|2|3)\\s*(?:Peter|John)|Jude|Revelation)' +
  '\\s+\\d+(?::\\d+(?:-\\d+)?)?' +
  '\\b',
  'gi'
);

function detectVerseRefs(text) {
  const matches = text.match(BIBLE_BOOKS_RE) || [];
  // Deduplicate
  return [...new Set(matches.map((m) => m.trim()))];
}

// Bible book names to exclude from name detection
const BIBLE_BOOKS_SET = new Set([
  'genesis','exodus','leviticus','numbers','deuteronomy','joshua','judges','ruth',
  'samuel','kings','chronicles','ezra','nehemiah','esther','job','psalms','psalm',
  'proverbs','ecclesiastes','isaiah','jeremiah','lamentations','ezekiel','daniel',
  'hosea','joel','amos','obadiah','jonah','micah','nahum','habakkuk','zephaniah',
  'haggai','zechariah','malachi','matthew','mark','luke','john','acts','romans',
  'corinthians','galatians','ephesians','philippians','colossians','thessalonians',
  'timothy','titus','philemon','hebrews','james','peter','jude','revelation',
  'song','solomon',
]);

function detectPersonNames(text) {
  // Match capitalized words that aren't Bible books, question words, or common English words
  const SKIP = new Set([
    'what','who','how','why','when','where','which','is','are','was','were',
    'did','does','do','can','could','should','would','will','the','a','an',
    'i','my','me','we','our','you','your','he','she','it','they','their',
    'about','with','from','that','this','have','has','had','not','but','and',
    'or','for','in','on','at','to','of','if','so','be','by','his','her',
    'bible','god','jesus','christ','holy','spirit','lord','church','scripture',
  ]);
  const matches = text.match(/\b([A-Z][a-z]{2,})\b/g) || [];
  return matches
    .map((m) => m.toLowerCase())
    .filter((m) => !SKIP.has(m) && !BIBLE_BOOKS_SET.has(m));
}

function detectDoctrineTopics(text) {
  const lower = text.toLowerCase();
  const scores = Object.entries(FIRST_PRINCIPLES).map(([key, topic]) => {
    const hits = topic.keywords.filter((kw) => lower.includes(kw)).length;
    return { key, hits };
  });
  // Return up to 2 topics that have at least 1 keyword hit, sorted by score
  return scores
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 2)
    .map((s) => s.key);
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Embedding (REST)
// ─────────────────────────────────────────────────────────────────────────────

async function embedQuery(text, apiKey) {
  const url = `${GEMINI_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: 768,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.embedding?.values ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Helpers (REST — no SDK)
// ─────────────────────────────────────────────────────────────────────────────

function supabaseHeaders(key) {
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

async function searchChunks({ queryText, queryEmbedding, matchCount, filterVerse, supabaseUrl, supabaseKey }) {
  const url = `${supabaseUrl}/rest/v1/rpc/search_sermon_chunks`;
  const body = {
    query_text: queryText,
    query_embedding: queryEmbedding,
    match_count: matchCount,
  };
  if (filterVerse) body.filter_verse = filterVerse;

  const res = await fetch(url, {
    method: 'POST',
    headers: supabaseHeaders(supabaseKey),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`search_sermon_chunks ${res.status}: ${err}`);
  }
  return res.json(); // array of chunk rows
}

async function fetchSermonsByIds(ids, supabaseUrl, supabaseKey) {
  if (!ids.length) return [];
  const idList = ids.map((id) => `"${id}"`).join(',');
  const url = `${supabaseUrl}/rest/v1/sermons?id=in.(${idList})&select=id,title,youtube_url,summary`;
  const res = await fetch(url, { headers: supabaseHeaders(supabaseKey) });
  if (!res.ok) return [];
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Assembly
// ─────────────────────────────────────────────────────────────────────────────

function buildContext({ chunks, sermonMap, doctrineTopics, personNames }) {
  const parts = [];

  // First Principles sections (inject only relevant ones)
  if (doctrineTopics.length > 0) {
    parts.push('--- RELEVANT FIRST PRINCIPLES TEACHING ---');
    for (const key of doctrineTopics) {
      const fp = FIRST_PRINCIPLES[key];
      if (fp) parts.push(fp.content);
    }
  }

  // Sermon chunks
  if (chunks.length > 0) {
    // If the user asked about a specific speaker, surface a summary of which
    // speakers appear in the retrieved results so Gemini can match confidently.
    if (personNames && personNames.length > 0) {
      const speakerIndex = {};
      for (const chunk of chunks) {
        const meta = chunk.metadata || {};
        const sermon = sermonMap[chunk.sermon_id] || {};
        const speaker = meta.speaker || '';
        const title = sermon.title || '';
        if (speaker) {
          if (!speakerIndex[speaker]) speakerIndex[speaker] = [];
          if (title && !speakerIndex[speaker].includes(title)) {
            speakerIndex[speaker].push(title);
          }
        }
      }
      const indexLines = Object.entries(speakerIndex)
        .map(([sp, titles]) => `  ${sp}: ${titles.slice(0, 3).join('; ')}`)
        .join('\n');
      if (indexLines) {
        parts.push(`--- SPEAKERS IN RETRIEVED RESULTS ---\n${indexLines}`);
      }
    }

    parts.push('\n--- RELEVANT SERMON EXCERPTS ---');
    for (const chunk of chunks) {
      const meta = chunk.metadata || {};
      const sermon = sermonMap[chunk.sermon_id] || {};
      const title = sermon.title || 'Unknown Sermon';
      const speaker = meta.speaker || 'Unknown Speaker';
      const church = meta.church || '';
      const videoId = meta.video_id || '';
      const startSec = chunk.start_seconds || 0;
      const ytLink = videoId
        ? `https://www.youtube.com/watch?v=${videoId}&t=${startSec}`
        : '';
      const verseList = (chunk.verse_references || []).join(', ');

      parts.push(
        `[Sermon: "${title}" | Speaker: ${speaker} | ${church}` +
        (ytLink ? ` | ${ytLink}` : '') +
        (verseList ? ` | Verses: ${verseList}` : '') +
        `]\n${chunk.content}`
      );
    }
    parts.push('\nNote: Use the above sermon excerpts as background knowledge to inform your answer. Do NOT try to cite all of them. Pick the 1-2 most relevant ones and weave them naturally into your response.');
  }

  return parts.join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini Chat (REST)
// ─────────────────────────────────────────────────────────────────────────────

async function callGemini({ systemPrompt, context, userMessage, apiKey }) {
  const url = `${GEMINI_BASE}/models/${CHAT_MODEL}:generateContent?key=${apiKey}`;

  const userContent = context
    ? `${context}\n\n---\nUser question: ${userMessage}`
    : `User question: ${userMessage}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: {
      temperature: TEMPERATURE,
      maxOutputTokens: 4096,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini ${res.status}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const aiResponse = parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim() || 'Sorry, I could not generate a response.';

  return { aiResponse, usageMetadata: data.usageMetadata || null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sources Builder
// ─────────────────────────────────────────────────────────────────────────────

function extractSpeakerFromTitle(title) {
  if (!title) return '';
  const m = title.match(/\bby\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\s*$/);
  return m ? m[1] : '';
}

function buildSources(chunks, sermonMap) {
  // Deduplicate by sermon_id, keeping the highest-scoring chunk per sermon
  const seen = new Map();
  for (const chunk of chunks) {
    if (!seen.has(chunk.sermon_id)) {
      seen.set(chunk.sermon_id, chunk);
    }
  }
  return [...seen.values()].map((chunk) => {
    const meta = chunk.metadata || {};
    const sermon = sermonMap[chunk.sermon_id] || {};
    const videoId = meta.video_id || '';
    const startSec = chunk.start_seconds || 0;
    return {
      sermonTitle: sermon.title || 'Unknown Sermon',
      speaker: meta.speaker || extractSpeakerFromTitle(sermon.title),
      church: meta.church || '',
      youtubeUrl: videoId
        ? `https://www.youtube.com/watch?v=${videoId}&t=${startSec}`
        : (sermon.youtube_url || ''),
      verseRefs: chunk.verse_references || [],
      summary: sermon.summary || '',
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  const { userMessage } = req.body || {};
  if (!userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ error: 'userMessage is required' });
  }

  // ── Step 1: Intent detection ──────────────────────────────────────────────
  const detectedVerses = detectVerseRefs(userMessage);
  const doctrineTopics = detectDoctrineTopics(userMessage);

  // ── Steps 2–4: Embed → Search → Fetch titles ─────────────────────────────
  let chunks = [];
  let sermonMap = {}; // { [sermon_id]: { title, youtube_url } }
  let ragSucceeded = false;

  if (supabaseUrl && supabaseKey) {
    try {
      const queryEmbedding = await embedQuery(userMessage, apiKey);

      if (queryEmbedding) {
        // Boost queryText with any person names detected (e.g. "Malik" in "What did Malik teach about John 5?")
        const personNames = detectPersonNames(userMessage);
        const boostedQueryText = personNames.length > 0
          ? `${personNames.join(' ')} ${userMessage}`
          : userMessage;

        chunks = await searchChunks({
          queryText: boostedQueryText,
          queryEmbedding,
          matchCount: MATCH_COUNT,
          filterVerse: detectedVerses[0] || null,
          supabaseUrl,
          supabaseKey,
        });

        // Fetch sermon titles for the retrieved chunks
        const sermonIds = [...new Set(chunks.map((c) => c.sermon_id).filter(Boolean))];
        const sermons = await fetchSermonsByIds(sermonIds, supabaseUrl, supabaseKey);
        sermonMap = Object.fromEntries(sermons.map((s) => [s.id, s]));

        ragSucceeded = true;
      }
    } catch (err) {
      console.error('[RAG] Pipeline failed, falling back to system-prompt-only:', err.message);
      // chunks stays []
    }
  } else {
    console.warn('[RAG] Supabase env vars not configured — skipping retrieval');
  }

  // ── Step 5: Assemble context ──────────────────────────────────────────────
  const personNames = detectPersonNames(userMessage);
  const context = buildContext({ chunks, sermonMap, doctrineTopics, personNames });

  // ── Step 6: Call Gemini ───────────────────────────────────────────────────
  try {
    const { aiResponse, usageMetadata } = await callGemini({
      systemPrompt: SYSTEM_PROMPT,
      context,
      userMessage,
      apiKey,
    });

    // ── Step 7: Build sources and return ─────────────────────────────────────
    const sources = buildSources(chunks, sermonMap);

    return res.status(200).json({
      aiResponse,
      sources,
      modelUsed: CHAT_MODEL,
      contextChunks: chunks.length,
      doctrineTopicsDetected: doctrineTopics,
      ragSucceeded,
      usageMetadata,
    });
  } catch (err) {
    console.error('[Gemini] generateContent failed:', err.message);
    return res.status(500).json({ error: 'AI request failed on server' });
  }
}

// Cloudflare Pages Function: /api/meta
// 성경 66권 목록 및 지원 번역본 메타데이터

const BIBLE_BOOKS = [
  // 구약 39권
  { code: 'gen', name: '창세기', abbr: '창', eng: 'genesis', testament: 'OT', chapters: 50 },
  { code: 'exo', name: '출애굽기', abbr: '출', eng: 'exodus', testament: 'OT', chapters: 40 },
  { code: 'lev', name: '레위기', abbr: '레', eng: 'leviticus', testament: 'OT', chapters: 27 },
  { code: 'num', name: '민수기', abbr: '민', eng: 'numbers', testament: 'OT', chapters: 36 },
  { code: 'deu', name: '신명기', abbr: '신', eng: 'deuteronomy', testament: 'OT', chapters: 34 },
  { code: 'jos', name: '여호수아', abbr: '수', eng: 'joshua', testament: 'OT', chapters: 24 },
  { code: 'jdg', name: '사사기', abbr: '삿', eng: 'judges', testament: 'OT', chapters: 21 },
  { code: 'rut', name: '룻기', abbr: '룻', eng: 'ruth', testament: 'OT', chapters: 4 },
  { code: '1sa', name: '사무엘상', abbr: '삼상', eng: '1samuel', testament: 'OT', chapters: 31 },
  { code: '2sa', name: '사무엘하', abbr: '삼하', eng: '2samuel', testament: 'OT', chapters: 24 },
  { code: '1ki', name: '열왕기상', abbr: '왕상', eng: '1kings', testament: 'OT', chapters: 22 },
  { code: '2ki', name: '열왕기하', abbr: '왕하', eng: '2kings', testament: 'OT', chapters: 25 },
  { code: '1ch', name: '역대상', abbr: '대상', eng: '1chronicles', testament: 'OT', chapters: 29 },
  { code: '2ch', name: '역대하', abbr: '대하', eng: '2chronicles', testament: 'OT', chapters: 36 },
  { code: 'ezr', name: '에스라', abbr: '스', eng: 'ezra', testament: 'OT', chapters: 10 },
  { code: 'neh', name: '느헤미야', abbr: '느', eng: 'nehemiah', testament: 'OT', chapters: 13 },
  { code: 'est', name: '에스더', abbr: '에', eng: 'esther', testament: 'OT', chapters: 10 },
  { code: 'job', name: '욥기', abbr: '욥', eng: 'job', testament: 'OT', chapters: 42 },
  { code: 'psa', name: '시편', abbr: '시', eng: 'psalms', testament: 'OT', chapters: 150 },
  { code: 'pro', name: '잠언', abbr: '잠', eng: 'proverbs', testament: 'OT', chapters: 31 },
  { code: 'ecc', name: '전도서', abbr: '전', eng: 'ecclesiastes', testament: 'OT', chapters: 12 },
  { code: 'sng', name: '아가', abbr: '아', eng: 'songofsolomon', testament: 'OT', chapters: 8 },
  { code: 'isa', name: '이사야', abbr: '사', eng: 'isaiah', testament: 'OT', chapters: 66 },
  { code: 'jer', name: '예레미야', abbr: '렘', eng: 'jeremiah', testament: 'OT', chapters: 52 },
  { code: 'lam', name: '예레미야애가', abbr: '애', eng: 'lamentations', testament: 'OT', chapters: 5 },
  { code: 'ezk', name: '에스겔', abbr: '겔', eng: 'ezekiel', testament: 'OT', chapters: 48 },
  { code: 'dan', name: '다니엘', abbr: '단', eng: 'daniel', testament: 'OT', chapters: 12 },
  { code: 'hos', name: '호세아', abbr: '호', eng: 'hosea', testament: 'OT', chapters: 14 },
  { code: 'jol', name: '요엘', abbr: '욜', eng: 'joel', testament: 'OT', chapters: 3 },
  { code: 'amo', name: '아모스', abbr: '암', eng: 'amos', testament: 'OT', chapters: 9 },
  { code: 'oba', name: '오바댜', abbr: '옵', eng: 'obadiah', testament: 'OT', chapters: 1 },
  { code: 'jon', name: '요나', abbr: '욘', eng: 'jonah', testament: 'OT', chapters: 4 },
  { code: 'mic', name: '미가', abbr: '미', eng: 'micah', testament: 'OT', chapters: 7 },
  { code: 'nam', name: '나훔', abbr: '나', eng: 'nahum', testament: 'OT', chapters: 3 },
  { code: 'hab', name: '하박국', abbr: '합', eng: 'habakkuk', testament: 'OT', chapters: 3 },
  { code: 'zep', name: '스바냐', abbr: '습', eng: 'zephaniah', testament: 'OT', chapters: 3 },
  { code: 'hag', name: '학개', abbr: '학', eng: 'haggai', testament: 'OT', chapters: 2 },
  { code: 'zec', name: '스가랴', abbr: '슥', eng: 'zechariah', testament: 'OT', chapters: 14 },
  { code: 'mal', name: '말라기', abbr: '말', eng: 'malachi', testament: 'OT', chapters: 4 },

  // 신약 27권
  { code: 'mat', name: '마태복음', abbr: '마', eng: 'matthew', testament: 'NT', chapters: 28 },
  { code: 'mrk', name: '마가복음', abbr: '막', eng: 'mark', testament: 'NT', chapters: 16 },
  { code: 'luk', name: '누가복음', abbr: '눅', eng: 'luke', testament: 'NT', chapters: 24 },
  { code: 'jhn', name: '요한복음', abbr: '요', eng: 'john', testament: 'NT', chapters: 21 },
  { code: 'act', name: '사도행전', abbr: '행', eng: 'acts', testament: 'NT', chapters: 28 },
  { code: 'rom', name: '로마서', abbr: '롬', eng: 'romans', testament: 'NT', chapters: 16 },
  { code: '1co', name: '고린도전서', abbr: '고전', eng: '1corinthians', testament: 'NT', chapters: 16 },
  { code: '2co', name: '고린도후서', abbr: '고후', eng: '2corinthians', testament: 'NT', chapters: 13 },
  { code: 'gal', name: '갈라디아서', abbr: '갈', eng: 'galatians', testament: 'NT', chapters: 6 },
  { code: 'eph', name: '에베소서', abbr: '엡', eng: 'ephesians', testament: 'NT', chapters: 6 },
  { code: 'php', name: '빌립보서', abbr: '빌', eng: 'philippians', testament: 'NT', chapters: 4 },
  { code: 'col', name: '골로새서', abbr: '골', eng: 'colossians', testament: 'NT', chapters: 4 },
  { code: '1th', name: '데살로니가전서', abbr: '살전', eng: '1thessalonians', testament: 'NT', chapters: 5 },
  { code: '2th', name: '데살로니가후서', abbr: '살후', eng: '2thessalonians', testament: 'NT', chapters: 3 },
  { code: '1ti', name: '디모데전서', abbr: '딤전', eng: '1timothy', testament: 'NT', chapters: 6 },
  { code: '2ti', name: '디모데후서', abbr: '딤후', eng: '2timothy', testament: 'NT', chapters: 4 },
  { code: 'tit', name: '디도서', abbr: '딛', eng: 'titus', testament: 'NT', chapters: 3 },
  { code: 'phm', name: '빌레몬서', abbr: '몬', eng: 'philemon', testament: 'NT', chapters: 1 },
  { code: 'heb', name: '히브리서', abbr: '히', eng: 'hebrews', testament: 'NT', chapters: 13 },
  { code: 'jas', name: '야고보서', abbr: '약', eng: 'james', testament: 'NT', chapters: 5 },
  { code: '1pe', name: '베드로전서', abbr: '벧전', eng: '1peter', testament: 'NT', chapters: 5 },
  { code: '2pe', name: '베드로후서', abbr: '벧후', eng: '2peter', testament: 'NT', chapters: 3 },
  { code: '1jn', name: '요한일서', abbr: '요일', eng: '1john', testament: 'NT', chapters: 5 },
  { code: '2jn', name: '요한이서', abbr: '요이', eng: '2john', testament: 'NT', chapters: 1 },
  { code: '3jn', name: '요한삼서', abbr: '요삼', eng: '3john', testament: 'NT', chapters: 1 },
  { code: 'jud', name: '유다서', abbr: '유', eng: 'jude', testament: 'NT', chapters: 1 },
  { code: 'rev', name: '요한계시록', abbr: '계', eng: 'revelation', testament: 'NT', chapters: 22 }
];

const BIBLE_VERSIONS = [
  { code: 'gae', name: '개역개정4판', isDefault: true },
  { code: 'han', name: '개역한글', isDefault: false },
  { code: 'saenew', name: '새번역', isDefault: false },
  { code: 'easy', name: '쉬운성경', isDefault: false },
  { code: 'hyun', name: '현대인의성경', isDefault: false },
  { code: 'niv', name: 'NIV (English)', isDefault: false },
  { code: 'hebrew', name: '히브리어(구약)', isDefault: false },
  { code: 'greek', name: '헬라어(신약)', isDefault: false }
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=86400'
};

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  return new Response(JSON.stringify({
    success: true,
    books: BIBLE_BOOKS,
    versions: BIBLE_VERSIONS
  }), {
    status: 200,
    headers: CORS_HEADERS
  });
}

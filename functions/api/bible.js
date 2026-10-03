// Cloudflare Pages Function: /api/bible
// 갓피아(godpia.com) 성경 본문 스크래핑 및 API 제공 프록시

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

const BIBLE_VERSIONS = {
  'gae': '개역개정4판',
  'han': '개역한글',
  'saenew': '새번역',
  'easy': '쉬운성경',
  'hyun': '현대인의성경',
  'niv': 'NIV',
  'hebrew': '히브리어(구약)',
  'greek': '헬라어(신약)'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

// 자연어 검색어 파싱
function parseQuery(query) {
  if (!query || typeof query !== 'string') return null;
  const q = query.trim().replace(/\s+/g, ' ');

  let matchedBook = null;
  let remaining = '';

  // 1. 전체 책 이름 매칭 (긴 이름 우선)
  const sortedByFull = [...BIBLE_BOOKS].sort((a, b) => b.name.length - a.name.length);
  for (const b of sortedByFull) {
    const patterns = [
      new RegExp('^' + b.name + '(?:\\s*([0-9:：\\-~\\s장편절].*)|$)', 'i'),
      new RegExp('^' + b.eng + '(?:\\s*([0-9:：\\-~\\s장편절].*)|$)', 'i')
    ];
    for (const pat of patterns) {
      const m = q.match(pat);
      if (m) {
        matchedBook = b;
        remaining = (m[1] || '').trim();
        break;
      }
    }
    if (matchedBook) break;
  }

  // 2. 약어 매칭
  if (!matchedBook) {
    const sortedByAbbr = [...BIBLE_BOOKS].sort((a, b) => b.abbr.length - a.abbr.length);
    for (const b of sortedByAbbr) {
      const patterns = [
        new RegExp('^' + b.abbr + '(?:\\s*([0-9:：\\-~\\s장편절].*)|$)', 'i'),
        new RegExp('^' + b.code + '(?:\\s*([0-9:：\\-~\\s장편절].*)|$)', 'i')
      ];
      for (const pat of patterns) {
        const m = q.match(pat);
        if (m) {
          matchedBook = b;
          remaining = (m[1] || '').trim();
          break;
        }
      }
      if (matchedBook) break;
    }
  }

  if (!matchedBook) return null;

  if (!remaining) {
    return {
      book: matchedBook,
      chap: 1,
      start: null,
      end: null
    };
  }

  const rem = remaining.replace(/편/g, '장').replace(/절/g, '');

  let chap = null;
  let start = null;
  let end = null;

  // 장 3-5
  const mA = rem.match(/^(\d+)\s*장(?:\s*(\d+))?(?:\s*[-~]\s*(\d+))?$/);
  if (mA) {
    chap = parseInt(mA[1], 10);
    start = mA[2] ? parseInt(mA[2], 10) : null;
    end = mA[3] ? parseInt(mA[3], 10) : (start !== null ? start : null);
  } else {
    // 1:3-5
    const mB = rem.match(/^(\d+)\s*[:：]\s*(\d+)(?:\s*[-~]\s*(\d+))?$/);
    if (mB) {
      chap = parseInt(mB[1], 10);
      start = parseInt(mB[2], 10);
      end = mB[3] ? parseInt(mB[3], 10) : start;
    } else {
      // 1 3-5
      const mC = rem.match(/^(\d+)\s+(\d+)(?:\s*[-~]\s*(\d+))?$/);
      if (mC) {
        chap = parseInt(mC[1], 10);
        start = parseInt(mC[2], 10);
        end = mC[3] ? parseInt(mC[3], 10) : start;
      } else {
        // 단일장 구절 범위: "1-5"
        const mD = rem.match(/^(\d+)\s*[-~]\s*(\d+)$/);
        if (mD) {
          if (matchedBook.chapters === 1) {
            chap = 1;
            start = parseInt(mD[1], 10);
            end = parseInt(mD[2], 10);
          } else {
            chap = parseInt(mD[1], 10);
            start = null;
            end = null;
          }
        } else {
          // 단일 숫자 "1"
          const mE = rem.match(/^(\d+)$/);
          if (mE) {
            if (matchedBook.chapters === 1) {
              chap = 1;
              start = parseInt(mE[1], 10);
              end = start;
            } else {
              chap = parseInt(mE[1], 10);
              start = null;
              end = null;
            }
          }
        }
      }
    }
  }

  if (!chap || isNaN(chap)) chap = 1;

  if (start && end && start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  return {
    book: matchedBook,
    chap,
    start,
    end
  };
}

// 갓피아 HTML 파싱 함수
function parseGodpiaHtml(html) {
  const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  const verses = [];
  let match;

  while ((match = liRegex.exec(html)) !== null) {
    const fullLi = match[0];
    const liInner = match[1];

    let verseNum = null;
    const dataSecMatch = fullLi.match(/dataSec=["'](\d+)["']/i);
    if (dataSecMatch) {
      verseNum = parseInt(dataSecMatch[1], 10);
    } else {
      const noMatch = liInner.match(/<span[^>]*class=["'][^"']*bible-read-no[^"']*["'][^>]*>\s*(\d+)\s*<\/span>/i);
      if (noMatch) {
        verseNum = parseInt(noMatch[1], 10);
      }
    }

    if (verseNum === null) continue;

    // 본문 추출: 절 번호 제거 및 태그 제거
    let text = liInner.replace(/<span[^>]*class=["'][^"']*bible-read-no[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '');
    text = text.replace(/<[^>]+>/g, '');
    text = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (text) {
      verses.push({ verse: verseNum, text });
    }
  }

  return verses;
}

export async function onRequest(context) {
  const { request } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }

  try {
    const url = new URL(request.url);
    let queryParam = url.searchParams.get('query');
    let verParam = url.searchParams.get('ver') || 'gae';
    let volParam = url.searchParams.get('vol');
    let chapParam = url.searchParams.get('chap');
    let startParam = url.searchParams.get('start');
    let endParam = url.searchParams.get('end');

    // POST 본문 지원
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        if (body.query) queryParam = body.query;
        if (body.ver) verParam = body.ver;
        if (body.vol) volParam = body.vol;
        if (body.chap) chapParam = body.chap;
        if (body.start) startParam = body.start;
        if (body.end) endParam = body.end;
      } catch (e) {
        // body parsing error ignored
      }
    }

    let book = null;
    let chap = 1;
    let startVerse = null;
    let endVerse = null;

    if (queryParam) {
      const parsed = parseQuery(queryParam);
      if (!parsed) {
        return new Response(JSON.stringify({
          success: false,
          error: `입력하신 성경구절(${queryParam})을 찾을 수 없습니다. 예: '창세기 1:1', '요한복음 3:16', '시편 23편'`
        }), { status: 400, headers: CORS_HEADERS });
      }
      book = parsed.book;
      chap = parsed.chap;
      startVerse = parsed.start;
      endVerse = parsed.end;
    } else if (volParam) {
      book = BIBLE_BOOKS.find(b => b.code.toLowerCase() === volParam.toLowerCase());
      if (!book) {
        return new Response(JSON.stringify({
          success: false,
          error: `성경 코드(${volParam})가 올바르지 않습니다.`
        }), { status: 400, headers: CORS_HEADERS });
      }
      chap = chapParam ? parseInt(chapParam, 10) : 1;
      startVerse = startParam ? parseInt(startParam, 10) : null;
      endVerse = endParam ? parseInt(endParam, 10) : startVerse;
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: "성경 구절 'query' 또는 'vol', 'chap' 파라미터를 입력해주세요. 예: /api/bible?query=요한복음 3:16"
      }), { status: 400, headers: CORS_HEADERS });
    }

    // 장 유효성 검증
    if (chap < 1 || chap > book.chapters) {
      return new Response(JSON.stringify({
        success: false,
        error: `${book.name}은(는) 1장부터 ${book.chapters}장까지 있습니다. (입력값: ${chap}장)`
      }), { status: 400, headers: CORS_HEADERS });
    }

    const versionKey = BIBLE_VERSIONS[verParam] ? verParam : 'gae';
    const versionName = BIBLE_VERSIONS[versionKey];

    // 갓피아(godpia.com) POST 요청
    const postBody = new URLSearchParams({
      ver: versionKey,
      ver2: '',
      vol: book.code,
      chap: chap.toString(),
      vol2: '',
      chap2: '',
      handwriting: '',
      curUrl: '/read/reading.asp'
    }).toString();

    const godpiaRes = await fetch('https://www.godpia.com/read/reading_body.asp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.godpia.com/read/reading.asp'
      },
      body: postBody
    });

    if (!godpiaRes.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: `갓피아 서버 응답 오류 (HTTP ${godpiaRes.status})`
      }), { status: 502, headers: CORS_HEADERS });
    }

    const html = await godpiaRes.text();
    const allVerses = parseGodpiaHtml(html);

    if (allVerses.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: '해당 장의 성경 본문을 불러오지 못했습니다.'
      }), { status: 404, headers: CORS_HEADERS });
    }

    // 구절 범위 필터링
    let filteredVerses = allVerses;
    if (startVerse !== null) {
      const start = startVerse;
      const end = endVerse !== null ? endVerse : startVerse;
      filteredVerses = allVerses.filter(v => v.verse >= start && v.verse <= end);
    }

    // 구절 참조 표기 (예: 창세기 1:1-5)
    let reference = `${book.name} ${chap}장`;
    if (startVerse !== null) {
      if (endVerse !== null && endVerse !== startVerse) {
        reference = `${book.name} ${chap}:${startVerse}-${endVerse}`;
      } else {
        reference = `${book.name} ${chap}:${startVerse}`;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        reference,
        book: {
          code: book.code,
          name: book.name,
          abbr: book.abbr,
          eng: book.eng,
          testament: book.testament,
          totalChapters: book.chapters
        },
        chapter: chap,
        startVerse,
        endVerse,
        version: {
          code: versionKey,
          name: versionName
        },
        totalVersesInChapter: allVerses.length,
        verses: filteredVerses
      }
    }), { status: 200, headers: CORS_HEADERS });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: `서버 내부 오류: ${err.message}`
    }), { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * Church Bulletin OCR Parser Algorithm (Ultra-Robust Generic Parser v4.0)
 * 이미지 내 빨간 상자로 표시된 10가지 특정 위치 텍스트를 정확하게 핀포인트 추출
 */

class ChurchBulletinParser {
  constructor() {
    this.defaultResult = {
      preacher: '',
      hymn1: '',
      responsiveReading: '',
      hymn2: '',
      offertory: '',
      prayer1: '',
      prayer2: '',
      scriptureText: '',
      scriptureReader1: '',
      scriptureReader2: '',
      sermonTitle: '',
      hymn3_part1: '',
      hymn3_part2: ''
    };
  }

  parse(rawText) {
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
      return { ...this.defaultResult };
    }

    const result = { ...this.defaultResult };

    const lines = rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const fullText = lines.join(' ');

    // 1. 설교자 (상단 인도,설교 옆 텍스트)
    result.preacher = this.extractPreacher(lines, fullText);

    // 2. 찬송 (첫번째 - 상단 첫 찬송가)
    // 4. 찬송 (두번째 - 성시교독 다음 찬송가)
    // 10. 찬송 (세번째 - 설교 후 1부/2부 찬송가)
    const hymns = this.extractHymns(lines, fullText);
    result.hymn1 = hymns.hymn1;
    result.hymn2 = hymns.hymn2;
    result.hymn3_part1 = hymns.hymn3_part1;
    result.hymn3_part2 = hymns.hymn3_part2;

    // 3. 성시교독 (교독문 번호)
    result.responsiveReading = this.extractResponsiveReading(lines, fullText);

    // 5. 봉헌 (1부/2부 봉헌곡)
    result.offertory = this.extractOffertory(lines, fullText);

    // 6. 대표기도자 (1부/2부 장로/집사/권사)
    const prayer = this.extractPrayer(lines, fullText);
    result.prayer1 = prayer.part1;
    result.prayer2 = prayer.part2;

    // 7. 성경봉독 본문 (성경 책, 장, 절)
    result.scriptureText = this.extractScriptureText(lines, fullText);

    // 8. 성경봉독 담당자 (1부/2부 봉독자)
    const readers = this.extractScriptureReaders(lines, fullText);
    result.scriptureReader1 = readers.part1;
    result.scriptureReader2 = readers.part2;

    // 9. 설교 제목 (설교 옆 제목)
    result.sermonTitle = this.extractSermonTitle(lines, fullText);

    return result;
  }

  /** 1. 설교자 (인도자 문구 완전 제거, pure 설교자 이름+직함만) */
  extractPreacher(lines, fullText) {
    const m1 = fullText.match(/(?:인도\s*[\/,]?\s*설교|설교자?)\s*[:\s]*([가-힣]{2,4}\s*(?:목사|전도사|강사|신부|원로목사|담임목사))/i);
    if (m1) return m1[1].trim();

    const m2 = fullText.match(/설교자?\s*[:\s]*([가-힣]{2,4}\s*(?:목사|전도사))/);
    if (m2) return m2[1].trim();

    const matches = [...fullText.matchAll(/([가-힣]{2,4}\s*(?:목사|전도사))/g)];
    for (const m of matches) {
      const idx = m.index;
      const prev = fullText.substring(Math.max(0, idx - 15), idx);
      if (!prev.includes('인도') || prev.includes('인도,설교') || prev.includes('인도/설교')) {
        return m[1].trim();
      }
    }
    return '';
  }

  /** 2, 4, 10. 찬송가 (첫번째, 두번째, 세번째 1부/2부) */
  extractHymns(lines, fullText) {
    const hymns = { hymn1: '', hymn2: '', hymn3_part1: '', hymn3_part2: '' };

    const hymnMatches = [];
    lines.forEach(l => {
      if (/찬\s*송|찬\s*미/.test(l)) {
        const mNum = l.match(/(?:찬송가?|찬미)?\s*([0-9]{1,3}\s*장?)/);
        if (mNum) {
          hymnMatches.push(mNum[1].includes('장') ? `찬송가 ${mNum[1]}` : `찬송가 ${mNum[1]}장`);
        } else {
          const pureTitle = l.replace(/.*찬\s*송(?:가)?\s*\(?[0-9]*부\)?\s*\*?\s*/, '').trim();
          if (pureTitle && pureTitle.length > 1 && !pureTitle.includes('다함께')) {
            hymnMatches.push(pureTitle);
          }
        }
      }
    });

    if (hymnMatches.length > 0) hymns.hymn1 = hymnMatches[0];
    if (hymnMatches.length > 1) hymns.hymn2 = hymnMatches[1];

    const p1 = fullText.match(/1부\s*:\s*([가-힣0-9\s()]{2,15})/);
    const p2 = fullText.match(/2부\s*:\s*(찬송가?\s*[0-9]+장?|[가-힣0-9\s()]{2,15})/);

    if (p1) hymns.hymn3_part1 = p1[1].trim();
    if (p2) hymns.hymn3_part2 = p2[1].trim();

    if (!hymns.hymn3_part1 && hymnMatches.length > 2) hymns.hymn3_part1 = hymnMatches[2];
    if (!hymns.hymn3_part2 && hymnMatches.length > 3) hymns.hymn3_part2 = hymnMatches[3];

    return hymns;
  }

  /** 3. 성시교독 (교독문 번호) */
  extractResponsiveReading(lines, fullText) {
    const m = fullText.match(/(?:성시\s*)?교\s*독\s*문?\s*([0-9]{1,3}\s*번?)/i) ||
              fullText.match(/교\s*독\s*문?\s*([0-9]{1,3})/);
    if (m) {
      const num = m[1].replace(/[^0-9]/g, '');
      return `교독문 ${num}번`;
    }
    return '';
  }

  /** 5. 봉헌 (1부/2부) */
  extractOffertory(lines, fullText) {
    const line = lines.find(l => /봉\s*헌|헌\s*금/.test(l));
    if (line) {
      return line.replace(/^(?:봉\s*헌|헌\s*금)[\s*:]*/, '').trim();
    }
    return '';
  }

  /** 6. 대표기도자 (1부/2부) */
  extractPrayer(lines, fullText) {
    const res = { part1: '', part2: '' };
    const line = lines.find(l => /대\s*표\s*기\s*도|기\s*도/.test(l));
    const target = line || fullText;

    const m1 = target.match(/1부\s*:\s*([가-힣]{2,4}\s*(?:장로|집사|권사|성도))/);
    const m2 = target.match(/2부\s*:\s*([가-힣]{2,4}\s*(?:장로|집사|권사|성도))/);

    if (m1) res.part1 = m1[1].trim();
    if (m2) res.part2 = m2[1].trim();

    if (!res.part1 && !res.part2 && line) {
      const matches = [...line.matchAll(/([가-힣]{2,4}\s*(?:장로|집사|권사))/g)];
      if (matches.length > 0) res.part1 = matches[0][1].trim();
      if (matches.length > 1) res.part2 = matches[1][1].trim();
    }
    return res;
  }

  /** 7. 성경봉독 본문 (성경 구절 패턴) */
  extractScriptureText(lines, fullText) {
    const bBooks = "(?:창세기|출애굽기|레위기|민수기|신명기|여호수아|사사기|룻기|사무엘상|사무엘하|열왕기상|열왕기하|역대상|역대하|에스라|느헤미야|에스더|욥기|시편|잠언|전도서|아가|이사야|예레미야|예레미야애가|에스겔|다니엘|호세아|요엘|아모스|오바디야|요나|미가|나훔|하박국|스바냐|학개|스가랴|말라기|마태복음|마가복음|누가복음|요한복음|사도행전|로마서|고린도전서|고린도후서|갈라디아서|에베소서|빌립보서|골로새서|데살로니가전서|데살로니가후서|디모데전서|디모데후서|디도서|빌레몬서|히브리서|야고보서|베드로전서|베드로후서|요한1서|요한2서|요한3서|유다서|요한계시록|창|출|레|민|신|수|삿|룻|삼상|삼하|왕상|왕하|대상|대하|스|느|에|욥|시|잠|전|아|사|렘|애|겔|단|호|욜|암|옵|욘|믹|나|하|습|학|슥|말|마|막|눅|요|행|롬|고전|고후|갈|엡|빌|골|데전|데후|딤전|딤후|딛|몬|히|야|벧전|벧후|요일|요이|요삼|유|계)";
    const bRegex = new RegExp(`(${bBooks}\\s*[0-9]{1,3}\\s*:\\s*[0-9]{1,3}(?:\\s*[-~]\\s*[0-9]{1,3})?)`, "gi");

    const line = lines.find(l => /성\s*경\s*봉\s*독|본\s*문/.test(l));
    if (line) {
      const m = line.match(bRegex);
      if (m) return m[0].trim();
    }

    const fullM = fullText.match(bRegex);
    if (fullM) return fullM[0].trim();

    return '';
  }

  /** 8. 성경봉독 담당자 (1부/2부) */
  extractScriptureReaders(lines, fullText) {
    const res = { part1: '', part2: '' };
    const line = lines.find(l => /성\s*경\s*봉\s*독/.test(l));
    const target = line || fullText;

    const m1 = target.match(/1부\s*:\s*([가-힣]{2,4}\s*(?:집사|권사|장로|성도))/);
    const m2 = target.match(/2부\s*:\s*([가-힣]{2,4}\s*(?:집사|권사|장로|성도))/);

    if (m1) res.part1 = m1[1].trim();
    if (m2) res.part2 = m2[1].trim();

    if (!res.part1 && !res.part2 && line) {
      const matches = [...line.matchAll(/([가-힣]{2,4}\s*(?:집사|권사|장로))/g)];
      if (matches.length > 0) res.part1 = matches[0][1].trim();
      if (matches.length > 1) res.part2 = matches[1][1].trim();
    }
    return res;
  }

  /** 9. 설교 제목 */
  extractSermonTitle(lines, fullText) {
    const sermonLine = lines.find(l => l.startsWith('설교') || /설\s*교\s+/.test(l));
    if (sermonLine) {
      const cleaned = sermonLine
        .replace(/^설\s*교[\s*:]*/, '')
        .replace(/\(설\s*교\s*자\)/, '')
        .replace(/설\s*교\s*자/, '')
        .trim();

      if (cleaned && !cleaned.includes('목사') && !cleaned.includes('전도사')) {
        return cleaned;
      }
    }

    const idx = lines.findIndex(l => /설\s*교/.test(l));
    if (idx !== -1 && idx + 1 < lines.length) {
      const next = lines[idx + 1];
      if (next && !next.includes('찬송') && !next.includes('목사') && !next.includes('다함께')) {
        return next.trim();
      }
    }
    return '';
  }
}

window.churchParser = new ChurchBulletinParser();

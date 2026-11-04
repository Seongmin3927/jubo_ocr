/**
 * Cloudflare Pages Functions - Cloudflare R2 Storage Client
 * 
 * 찬송가 버킷: dooreteam-resourse (바인딩명: R2_HYMNS)
 * 교독문 버킷: doore-resourse-kyodoke (바인딩명: R2_GYODOK)
 */

/**
 * R2 버킷에서 찬송가 PPT 파일 조회 및 다운로드
 * @param {object} env Cloudflare Functions Environment
 * @param {string} hymnNo 3자리 0패딩 장수 (예: "003", "516")
 */
export async function getHymnFromR2(env, hymnNo) {
  const numInt = parseInt(hymnNo, 10);
  const hymnBucket =
    env.R2_HYMNS ||
    env['dooreteam-resourse'] ||
    env.dooreteam_resourse ||
    env.R2_BUCKET_HYMNS ||
    env.HYMNS;

  const candidateNames = [
    `새찬송가${hymnNo}장_normal_White.ppt`,
    `새찬송가${hymnNo}장_normal_White.pptx`,
    `새찬송가${numInt}장_normal_White.ppt`,
    `새찬송가${numInt}장_normal_White.pptx`,
    `새찬송가${hymnNo}장.ppt`,
    `새찬송가${hymnNo}장.pptx`,
    `새찬송가${numInt}장.ppt`,
    `새찬송가${numInt}장.pptx`,
    `${hymnNo}.ppt`,
    `${hymnNo}.pptx`,
    // 하위 폴더 형태로 업로드되었을 경우 대비
    `5-찬송가 PPT/새찬송가 배경 X - 16.9/새찬송가${hymnNo}장_normal_White.ppt`,
    `5-찬송가 PPT/새찬송가 배경 X - 16.9/새찬송가${hymnNo}장_normal_White.pptx`,
    `5-찬송가 PPT/새찬송가${hymnNo}장_normal_White.ppt`,
    `5-찬송가 PPT/새찬송가${hymnNo}장_normal_White.pptx`,
    `찬송가/새찬송가${hymnNo}장_normal_White.ppt`,
    `찬송가/새찬송가${hymnNo}장_normal_White.pptx`
  ];

  // 1. R2 버킷 바인딩 사용 (우선 순위 1)
  if (hymnBucket && typeof hymnBucket.get === 'function') {
    // 1-A. 후보 파일명 직접 조회
    for (const name of candidateNames) {
      const obj = await hymnBucket.get(name);
      if (obj) {
        const buffer = await obj.arrayBuffer();
        const ext = name.toLowerCase().endsWith('.pptx') ? 'pptx' : 'ppt';
        return {
          buffer,
          fileName: `새찬송가${hymnNo}장_normal_White.${ext}`,
          contentType: ext === 'pptx'
            ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            : 'application/vnd.ms-powerpoint'
        };
      }
    }

    // 1-B. 파일명 규칙이 다를 경우 list를 통해 탐색
    if (typeof hymnBucket.list === 'function') {
      const listed = await hymnBucket.list({ limit: 1000 });
      if (listed && Array.isArray(listed.objects)) {
        const matched = listed.objects.find(o => {
          const k = o.key;
          const lower = k.toLowerCase();
          if (!lower.endsWith('.ppt') && !lower.endsWith('.pptx')) return false;
          return k.includes(`${hymnNo}장`) || k.includes(`${numInt}장`) || k.endsWith(`/${hymnNo}.ppt`) || k.endsWith(`/${hymnNo}.pptx`);
        });

        if (matched) {
          const obj = await hymnBucket.get(matched.key);
          if (obj) {
            const buffer = await obj.arrayBuffer();
            const ext = matched.key.toLowerCase().endsWith('.pptx') ? 'pptx' : 'ppt';
            return {
              buffer,
              fileName: `새찬송가${hymnNo}장_normal_White.${ext}`,
              contentType: ext === 'pptx'
                ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                : 'application/vnd.ms-powerpoint'
            };
          }
        }
      }
    }
  }

  // 2. R2 Public Access URL (r2.dev 또는 커스텀 도메인 환경변수)
  const publicUrl = env.R2_HYMNS_URL || env.R2_HYMNS_PUBLIC_URL || env.R2_PUBLIC_URL;
  if (publicUrl) {
    const base = publicUrl.replace(/\/+$/, '');
    for (const name of candidateNames) {
      try {
        const res = await fetch(`${base}/${encodeURIComponent(name)}`);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          const ext = name.toLowerCase().endsWith('.pptx') ? 'pptx' : 'ppt';
          return {
            buffer,
            fileName: `새찬송가${hymnNo}장_normal_White.${ext}`,
            contentType: ext === 'pptx'
              ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
              : 'application/vnd.ms-powerpoint'
          };
        }
      } catch (e) {}
    }
  }

  return null;
}

/**
 * R2 버킷에서 교독문 ZIP/PPTX 파일 조회 및 다운로드
 * @param {object} env Cloudflare Functions Environment
 * @param {number|string} gyodokNo 교독문 번호 (1~137)
 * @param {string} zipFileName 대상 분할 ZIP 파일명
 */
export async function getGyodokFromR2(env, gyodokNo, zipFileName) {
  const n = parseInt(gyodokNo, 10);
  const gyodokBucket =
    env.R2_GYODOK ||
    env['doore-resourse-kyodoke'] ||
    env.doore_resourse_kyodoke ||
    env.R2_BUCKET_GYODOK ||
    env.GYODOK;

  const candidateZipNames = [
    zipFileName,
    `6-교독문 PPT/${zipFileName}`,
    `교독문/${zipFileName}`,
    `개역개정판 교독문/${zipFileName}`
  ].filter(Boolean);

  // 1. R2 버킷 바인딩 사용 (우선 순위 1)
  if (gyodokBucket && typeof gyodokBucket.get === 'function') {
    // 1-A. 분할 ZIP 파일 직접 조회
    for (const name of candidateZipNames) {
      const obj = await gyodokBucket.get(name);
      if (obj) {
        const buffer = await obj.arrayBuffer();
        return {
          buffer,
          fileName: zipFileName,
          contentType: 'application/zip',
          isZip: true
        };
      }
    }

    // 1-B. 파일명 또는 폴더 구조 탐색
    if (typeof gyodokBucket.list === 'function') {
      const listed = await gyodokBucket.list({ limit: 1000 });
      if (listed && Array.isArray(listed.objects)) {
        // ZIP 파일 매칭 탐색
        const matchedZip = listed.objects.find(o => zipFileName && (o.key.includes(zipFileName) || o.key.endsWith(zipFileName)));
        if (matchedZip) {
          const obj = await gyodokBucket.get(matchedZip.key);
          if (obj) {
            const buffer = await obj.arrayBuffer();
            return {
              buffer,
              fileName: zipFileName,
              contentType: 'application/zip',
              isZip: true
            };
          }
        }

        // 혹시 개별 PPTX 파일로 풀어서 올렸을 경우 매칭 탐색
        const numStr = String(n);
        const numStr3 = numStr.padStart(3, '0');
        const matchedPptx = listed.objects.find(o => {
          const k = o.key.toLowerCase();
          if (!k.endsWith('.pptx') && !k.endsWith('.ppt')) return false;
          return k.includes(`교독문_${numStr}`) || k.includes(`교독문 ${numStr}`) || k.includes(`교독문${numStr}`) || k.includes(`${numStr3}`);
        });

        if (matchedPptx) {
          const obj = await gyodokBucket.get(matchedPptx.key);
          if (obj) {
            const buffer = await obj.arrayBuffer();
            const ext = matchedPptx.key.toLowerCase().endsWith('.ppt') ? 'ppt' : 'pptx';
            return {
              buffer,
              fileName: `교독문_${n}번.${ext}`,
              contentType: ext === 'ppt'
                ? 'application/vnd.ms-powerpoint'
                : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              isZip: false
            };
          }
        }
      }
    }
  }

  // 2. R2 Public Access URL (r2.dev 또는 커스텀 도메인 환경변수)
  const publicUrl = env.R2_GYODOK_URL || env.R2_GYODOK_PUBLIC_URL || env.R2_PUBLIC_URL;
  if (publicUrl) {
    const base = publicUrl.replace(/\/+$/, '');
    for (const name of candidateZipNames) {
      try {
        const res = await fetch(`${base}/${encodeURIComponent(name)}`);
        if (res.ok) {
          const buffer = await res.arrayBuffer();
          return {
            buffer,
            fileName: zipFileName,
            contentType: 'application/zip',
            isZip: true
          };
        }
      } catch (e) {}
    }
  }

  return null;
}

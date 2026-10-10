/**
 * Cloudflare Pages Function - Synology File Station Gyodok (성시교독) ZIP/PPTX Proxy
 * Path: /api/download-gyodok (HTTP GET)
 * Query Param:
 *   - no: 24 (or "24번", "교독문 24번")
 *   - zipOnly: "true" (optional: ZIP 파일 원본 ArrayBuffer 요청 시)
 * 
 * Environment Variables (Set in Cloudflare Pages Dashboard or .dev.vars):
 * - SYNOLOGY_NAS_URL (Default: http://doore2.synology.me:5000)
 * - SYNOLOGY_USERNAME
 * - SYNOLOGY_PASSWORD
 */

// 교독문 번호별 대상 분할 ZIP 파일명 매핑 규칙
export function getGyodokZipFileName(gyodokNo) {
  const n = parseInt(gyodokNo, 10);
  if (isNaN(n) || n < 1 || n > 137) return null;

  if (n >= 1 && n <= 15) return '개역개정판 교독문 1~15.zip';
  if (n >= 16 && n <= 30) return '개역개정판 교독문 16~30.zip';
  if (n >= 31 && n <= 45) return '개역개정판 교독문 31~45.zip';
  if (n >= 46 && n <= 60) return '개역개정판 교독문 46~60.zip';
  if (n >= 61 && n <= 75) return '개역개정판 교독문 61~75.zip';
  if (n >= 76 && n <= 90) return '개역개정판 교독문 76~90.zip';
  if (n >= 91 && n <= 105) return '개역개정판 교독문 91~105.zip';
  if (n >= 106 && n <= 120) {
    // 119~120번은 양쪽 규칙에 걸칠 수 있으나 119~130 또는 106~120 중 유효
    if (n >= 119) return '개역개정판 교독문 119~130.zip';
    return '개역개정판 교독문 106~120.zip';
  }
  if (n >= 121 && n <= 130) return '개역개정판 교독문 119~130.zip';
  if (n >= 131 && n <= 137) return '개역개정판 교독문 131~137(완).zip';

  return null;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const url = new URL(request.url);
    const rawNo = url.searchParams.get('no');
    const zipOnly = url.searchParams.get('zipOnly') === 'true';

    if (!rawNo) {
      return new Response(
        JSON.stringify({ success: false, error: 'no(교독문 번호) 파라미터가 누락되었습니다. (예: ?no=24)' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const numMatch = rawNo.match(/\d+/);
    if (!numMatch) {
      return new Response(
        JSON.stringify({ success: false, error: '유효한 교독문 번호 숫자를 찾을 수 없습니다.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const gyodokNo = parseInt(numMatch[0], 10);
    const zipFileName = getGyodokZipFileName(gyodokNo);

    if (!zipFileName) {
      return new Response(
        JSON.stringify({ success: false, error: `지원 범위를 벗어난 교독문 번호입니다. (1번~137번 지원, 입력값: ${gyodokNo})` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 환경 변수 읽기
    const baseUrl = (env.SYNOLOGY_NAS_URL || 'http://doore2.synology.me:5000').replace(/\/+$/, '');
    const username = env.SYNOLOGY_USERNAME;
    const password = env.SYNOLOGY_PASSWORD;

    if (!username || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '시놀로지 NAS 인증 환경변수(SYNOLOGY_USERNAME, SYNOLOGY_PASSWORD)가 설정되지 않았습니다.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Step A: 시놀로지 FileStation API 로그인 (sid 획득)
    const loginUrl = `${baseUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${encodeURIComponent(username)}&passwd=${encodeURIComponent(password)}&session=FileStation&format=sid`;

    let loginRes;
    try {
      loginRes = await fetch(loginUrl);
    } catch (netErr) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `시놀로지 NAS 서버(${baseUrl}) 연결 실패: ${netErr.message}`,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!loginRes.ok) {
      const errText = await loginRes.text();
      return new Response(
        JSON.stringify({ success: false, error: `시놀로지 NAS 로그인 실패 (HTTP ${loginRes.status}): ${errText}` }),
        { status: loginRes.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.data || !loginData.data.sid) {
      const errCode = loginData.error ? loginData.error.code : '인증 실패';
      return new Response(
        JSON.stringify({ success: false, error: `시놀로지 NAS 로그인 인증 에러 (오류 코드: ${errCode})` }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const sid = loginData.data.sid;

    // Step B: 대상 ZIP 파일 다운로드 요청
    // 기본 저장 경로: /예배 및 방송자료/6-교독문 PPT/{zipFileName}
    const nasFilePath = `/예배 및 방송자료/6-교독문 PPT/${zipFileName}`;
    const downloadUrl = `${baseUrl}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(nasFilePath)}&mode=download&_sid=${encodeURIComponent(sid)}`;

    let downloadRes;
    try {
      downloadRes = await fetch(downloadUrl);
    } catch (fetchErr) {
      await logoutSynology(baseUrl, sid);
      return new Response(
        JSON.stringify({ success: false, error: `교독문 ZIP 다운로드 중 네트워크 에러: ${fetchErr.message}` }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const contentType = downloadRes.headers.get('content-type') || '';
    if (!downloadRes.ok || contentType.includes('application/json') || contentType.includes('text/html')) {
      let errorDetail = `HTTP ${downloadRes.status}`;
      try {
        const json = await downloadRes.json();
        if (json.error) {
          errorDetail += ` (NAS 에러코드: ${json.error.code})`;
        }
      } catch (e) {}

      await logoutSynology(baseUrl, sid);

      return new Response(
        JSON.stringify({
          success: false,
          error: `교독문 분할 ZIP 파일(${zipFileName})이 시놀로지 NAS에 존재하지 않거나 다운로드할 수 없습니다. [${errorDetail}]`,
        }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Step C: ZIP 바이너리 데이터 수집
    const zipBuffer = await downloadRes.arrayBuffer();

    // Step D: 시놀로지 세션 비동기 로그아웃
    logoutSynology(baseUrl, sid).catch(() => {});

    // zipOnly 요청이거나 클라이언트 압축 해제를 위한 ZIP 바이너리 응답
    return new Response(zipBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"; filename*=UTF-8''${encodeURIComponent(zipFileName)}`,
        'X-Target-Gyodok-No': String(gyodokNo),
        'X-Zip-File-Name': encodeURIComponent(zipFileName),
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('[Gyodok Download Proxy Exception]:', error);
    return new Response(
      JSON.stringify({ success: false, error: `서버 예외 발생: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

async function logoutSynology(baseUrl, sid) {
  if (!baseUrl || !sid) return;
  try {
    const logoutUrl = `${baseUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=logout&session=FileStation&_sid=${encodeURIComponent(sid)}`;
    await fetch(logoutUrl);
  } catch (e) {
    console.warn('[Synology Logout Warning]:', e.message);
  }
}

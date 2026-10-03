/**
 * Cloudflare Pages Function - Synology File Station Hymn PPTX Proxy
 * Path: /api/synology/download-hymn (HTTP GET)
 * Query Param: hymnNo=003 (or 3, 050, 191 etc.)
 * 
 * Environment Variables (Set in Cloudflare Pages Dashboard or .dev.vars):
 * - SYNOLOGY_NAS_URL (Default: http://doore2.synology.me:5000)
 * - SYNOLOGY_USERNAME
 * - SYNOLOGY_PASSWORD
 */

export async function onRequestGet(context) {
  const { request, env } = context;

  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const url = new URL(request.url);
    const rawHymnNo = url.searchParams.get('hymnNo');

    if (!rawHymnNo) {
      return new Response(
        JSON.stringify({ success: false, error: 'hymnNo 파라미터가 누락되었습니다. (예: ?hymnNo=003)' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // 0 패딩 3자리 숫자 변환 (예: 3 -> "003", 50 -> "050", 191 -> "191")
    const numOnly = rawHymnNo.replace(/\D/g, '');
    if (!numOnly) {
      return new Response(
        JSON.stringify({ success: false, error: '유효한 찬송가 장수 숫자가 아닙니다.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
    const hymnNo = numOnly.padStart(3, '0');

    // 환경 변수 읽기
    const baseUrl = (env.SYNOLOGY_NAS_URL || 'http://doore2.synology.me:5000').replace(/\/+$/, '');
    const username = env.SYNOLOGY_USERNAME;
    const password = env.SYNOLOGY_PASSWORD;

    if (!username || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '시놀로지 NAS 인증 환경변수(SYNOLOGY_USERNAME, SYNOLOGY_PASSWORD)가 설정되지 않았습니다. Cloudflare Pages 환경변수를 확인해주세요.',
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

    // Step B: 파일 다운로드 요청
    // NAS 저장 경로: /예배 및 방송자료/5-찬송가 PPT/새찬송가 배경 X - 16.9/새찬송가(3자리장수)장_normal_White.ppt
    const nasFilePath = `/예배 및 방송자료/5-찬송가 PPT/새찬송가 배경 X - 16.9/새찬송가${hymnNo}장_normal_White.ppt`;
    const downloadUrl = `${baseUrl}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(nasFilePath)}&mode=download&_sid=${encodeURIComponent(sid)}`;

    let downloadRes;
    try {
      downloadRes = await fetch(downloadUrl);
    } catch (fetchErr) {
      await logoutSynology(baseUrl, sid);
      return new Response(
        JSON.stringify({ success: false, error: `시놀로지 파일 다운로드 중 네트워크 에러: ${fetchErr.message}` }),
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
          error: `찬송가 ${parseInt(hymnNo, 10)}장(새찬송가${hymnNo}장_normal_White.ppt) 파일이 시놀로지 NAS에 존재하지 않거나 다운로드할 수 없습니다. [${errorDetail}]`
        }),
        { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Step C: PPT 바이너리 데이터 수집
    const pptBuffer = await downloadRes.arrayBuffer();

    // Step D: 시놀로지 세션 로그아웃 (비동기 완료)
    logoutSynology(baseUrl, sid).catch(() => {});

    const pptFileName = `새찬송가${hymnNo}장_normal_White.ppt`;

    return new Response(pptBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.ms-powerpoint',
        'Content-Disposition': `attachment; filename="${pptFileName}"; filename*=UTF-8''${encodeURIComponent(pptFileName)}`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('[Synology Download Proxy Exception]:', error);
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

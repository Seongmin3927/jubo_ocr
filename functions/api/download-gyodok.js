/**
 * Cloudflare Pages Function - Synology File Station Gyodok (성시교독) ZIP/PPTX Proxy
 * Path: /api/download-gyodok (HTTP GET)
 * Query Param:
 *   - no: 24 (or "24번", "교독문 24번")
 *   - zipOnly: "true" (optional: ZIP 파일 원본 ArrayBuffer 요청 시)
 * 
 * Environment Variables (Set in Cloudflare Pages Dashboard or .dev.vars):
 * - SYNOLOGY_NAS_URL (Default: https://doore2.synology.me:35001)
 * - SYNOLOGY_USERNAME
 * - SYNOLOGY_PASSWORD
 */

import { downloadSynologyFile, SynologyAuthError } from './_synology.js';

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

    // 대상 ZIP 파일 NAS 저장 경로: /예배 및 방송자료/6-교독문 PPT/{zipFileName}
    const nasFilePath = `/예배 및 방송자료/6-교독문 PPT/${zipFileName}`;

    // 공통 시놀로지 클라이언트를 통해 다운로드 (세션 재사용 및 락아웃 보호)
    const zipBuffer = await downloadSynologyFile(env, nasFilePath);

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
    console.error('[Synology Gyodok Download Proxy Exception]:', error);

    const isAuth = error.isAuthFailure || error instanceof SynologyAuthError;
    const status = isAuth ? 401 : (error.message.includes('존재하지 않습니다') ? 404 : 500);

    return new Response(
      JSON.stringify({
        success: false,
        isAuthFailure: !!isAuth,
        error: error.message
      }),
      { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
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

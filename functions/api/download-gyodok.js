/**
 * Cloudflare Pages Function - Gyodok (성시교독) ZIP/PPTX Proxy
 * Path: /api/download-gyodok (HTTP GET)
 * Query Param:
 *   - no: 24 (or "24번", "교독문 24번")
 * 
 * Storage Sources:
 * 1. Cloudflare R2 Bucket (doore-resourse-kyodoke) - 우선 순위
 * 2. Synology File Station NAS (Fallback)
 */

import { getGyodokFromR2 } from './_r2.js';
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

    // ========================================================
    // 1. Cloudflare R2 버킷(doore-resourse-kyodoke)에서 우선 다운로드
    // ========================================================
    try {
      const r2Result = await getGyodokFromR2(env, gyodokNo, zipFileName);
      if (r2Result && r2Result.buffer) {
        return new Response(r2Result.buffer, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': r2Result.contentType,
            'Content-Disposition': `attachment; filename="${r2Result.fileName}"; filename*=UTF-8''${encodeURIComponent(r2Result.fileName)}`,
            'X-Target-Gyodok-No': String(gyodokNo),
            'X-Zip-File-Name': encodeURIComponent(r2Result.fileName),
            'Cache-Control': 'public, max-age=86400',
            'X-Storage-Source': 'Cloudflare-R2',
          },
        });
      }
    } catch (r2Err) {
      console.warn('[R2 Gyodok Download Warning / Fallback to NAS]:', r2Err.message);
    }

    // ========================================================
    // 2. R2 미설정 또는 파일 부재 시 시놀로지 NAS 폴백 (기존 호환성 유지)
    // ========================================================
    if (env.SYNOLOGY_USERNAME && env.SYNOLOGY_PASSWORD) {
      const nasFilePath = `/예배 및 방송자료/6-교독문 PPT/${zipFileName}`;
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
          'X-Storage-Source': 'Synology-NAS',
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: `교독문 ${gyodokNo}번 파일을 R2 스토리지(doore-resourse-kyodoke)에서 찾을 수 없습니다. 버킷 업로드 상태를 확인해주세요.`
      }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('[Gyodok Download Exception]:', error);

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

/**
 * Cloudflare Pages Function - Hymn PPTX Proxy
 * Path: /api/synology/download-hymn (HTTP GET)
 * Query Param: hymnNo=003 (or 3, 050, 191 etc.)
 * 
 * Storage Sources:
 * 1. Cloudflare R2 Bucket (dooreteam-resourse) - 우선 순위
 * 2. Synology File Station NAS (Fallback)
 */

import { getHymnFromR2 } from '../_r2.js';
import { downloadSynologyFile, SynologyAuthError } from '../_synology.js';

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

    // ========================================================
    // 1. Cloudflare R2 버킷(dooreteam-resourse)에서 우선 다운로드
    // ========================================================
    try {
      const r2Result = await getHymnFromR2(env, hymnNo);
      if (r2Result && r2Result.buffer) {
        return new Response(r2Result.buffer, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': r2Result.contentType,
            'Content-Disposition': `attachment; filename="${r2Result.fileName}"; filename*=UTF-8''${encodeURIComponent(r2Result.fileName)}`,
            'Cache-Control': 'public, max-age=86400',
            'X-Storage-Source': 'Cloudflare-R2',
          },
        });
      }
    } catch (r2Err) {
      console.warn('[R2 Hymn Download Warning / Fallback to NAS]:', r2Err.message);
    }

    // ========================================================
    // 2. R2 미설정 또는 파일 부재 시 시놀로지 NAS 폴백 (기존 호환성 유지)
    // ========================================================
    if (env.SYNOLOGY_USERNAME && env.SYNOLOGY_PASSWORD) {
      const nasFilePath = `/예배 및 방송자료/5-찬송가 PPT/새찬송가 배경 X - 16.9/새찬송가${hymnNo}장_normal_White.ppt`;
      const pptBuffer = await downloadSynologyFile(env, nasFilePath);
      const pptFileName = `새찬송가${hymnNo}장_normal_White.ppt`;

      return new Response(pptBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.ms-powerpoint',
          'Content-Disposition': `attachment; filename="${pptFileName}"; filename*=UTF-8''${encodeURIComponent(pptFileName)}`,
          'Cache-Control': 'no-cache',
          'X-Storage-Source': 'Synology-NAS',
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: `찬송가 ${parseInt(hymnNo, 10)}장 파일을 R2 스토리지(dooreteam-resourse)에서 찾을 수 없습니다. 버킷 업로드 상태를 확인해주세요.`
      }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('[Hymn Download Exception]:', error);

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

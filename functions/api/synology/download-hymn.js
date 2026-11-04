/**
 * Cloudflare Pages Function - Synology File Station Hymn PPTX Proxy
 * Path: /api/synology/download-hymn (HTTP GET)
 * Query Param: hymnNo=003 (or 3, 050, 191 etc.)
 * 
 * Environment Variables (Set in Cloudflare Pages Dashboard or .dev.vars):
 * - SYNOLOGY_NAS_URL (Default: https://doore2.synology.me:35001)
 * - SYNOLOGY_USERNAME
 * - SYNOLOGY_PASSWORD
 */

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

    // NAS 저장 경로: /예배 및 방송자료/5-찬송가 PPT/새찬송가 배경 X - 16.9/새찬송가(3자리장수)장_normal_White.ppt
    const nasFilePath = `/예배 및 방송자료/5-찬송가 PPT/새찬송가 배경 X - 16.9/새찬송가${hymnNo}장_normal_White.ppt`;

    // 공통 시놀로지 클라이언트를 통해 다운로드 (세션 재사용 및 락아웃 보호)
    const pptBuffer = await downloadSynologyFile(env, nasFilePath);

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
    console.error('[Synology Hymn Download Proxy Exception]:', error);

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

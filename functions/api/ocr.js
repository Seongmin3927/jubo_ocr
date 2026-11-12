/**
 * Cloudflare Pages Function - Naver CLOVA OCR Proxy
 * Path: /api/ocr (HTTP POST)
 * 
 * Client sends: { imageBase64: "data:image/png;base64,...", format: "png" }
 * Function reads env: CLOVA_OCR_INVOKE_URL, CLOVA_OCR_SECRET_KEY
 */

import { checkRateLimit, getCorsHeaders, handleCorsPreflight } from './_security.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. IP 기반 요청 빈도 제한 (Rate Limiting) - 분당 최대 10회
  const rateLimitRes = checkRateLimit(request, { limit: 10, windowMs: 60 * 1000, apiName: 'ocr' });
  if (rateLimitRes) return rateLimitRes;

  // 2. Strict CORS 헤더 생성
  const corsHeaders = getCorsHeaders(request);

  try {
    const invokeUrl = env.CLOVA_OCR_INVOKE_URL;
    const secretKey = env.CLOVA_OCR_SECRET_KEY;

    if (!invokeUrl || !secretKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'CLOVA OCR 환경변수(CLOVA_OCR_INVOKE_URL, CLOVA_OCR_SECRET_KEY)가 설정되지 않았습니다.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const body = await request.json();
    const { imageBase64, format } = body;

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'imageBase64 데이터가 필요합니다.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Base64 순수 데이터 추출 (data:image/png;base64, 헤더가 있는 경우 제거)
    const cleanBase64 = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const fileFormat = format || 'png';

    // Naver CLOVA OCR API Payload
    const payload = {
      images: [
        {
          format: fileFormat,
          name: 'bulletin_image',
          data: cleanBase64,
        },
      ],
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      version: 'V2',
    };

    // CLOVA OCR API 요청 전송
    const clovaResponse = await fetch(invokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OCR-SECRET': secretKey,
      },
      body: JSON.stringify(payload),
    });

    if (!clovaResponse.ok) {
      const errorText = await clovaResponse.text();
      return new Response(
        JSON.stringify({
          success: false,
          error: `CLOVA OCR API 오류 (${clovaResponse.status}): ${errorText}`,
        }),
        { status: clovaResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const clovaData = await clovaResponse.json();

    // CLOVA OCR 응답에서 필드 텍스트 조합
    let extractedText = '';
    if (clovaData.images && clovaData.images[0] && clovaData.images[0].fields) {
      const fields = clovaData.images[0].fields;

      // 위치(lineBreak)를 고려하여 텍스트 합성
      let lineText = '';
      fields.forEach((field) => {
        lineText += field.inferText + (field.lineBreak ? '\n' : ' ');
      });
      extractedText = lineText.trim();
    }

    return new Response(
      JSON.stringify({
        success: true,
        text: extractedText,
        raw: clovaData,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || '서버 내부 오류가 발생했습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

export async function onRequestOptions(context) {
  return handleCorsPreflight(context.request);
}

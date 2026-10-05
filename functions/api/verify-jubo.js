/**
 * Cloudflare Pages Function - Gemini API 주보 사전 검증 (Jubo Verifier)
 * Path: /api/verify-jubo (HTTP POST)
 * 
 * Client sends: FormData with 'file' (Image File)
 * Function reads env: GEMINI_API_KEY
 * Model: gemini-1.5-flash
 * Output schema: { is_jubo: boolean, reason: string }
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const apiKey = env.GEMINI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          is_jubo: false,
          reason: 'Cloudflare 환경변수(GEMINI_API_KEY)가 설정되지 않았습니다.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let file = null;
    let cleanBase64 = null;
    let mimeType = 'image/jpeg';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      file = formData.get('file');

      if (!file || typeof file === 'string') {
        return new Response(
          JSON.stringify({
            is_jubo: false,
            reason: '검증할 이미지 파일(FormData file)이 필요합니다.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      mimeType = file.type || '';
      if (!mimeType || mimeType === 'application/octet-stream') {
        const name = (file.name || '').toLowerCase();
        if (name.endsWith('.png')) mimeType = 'image/png';
        else if (name.endsWith('.webp')) mimeType = 'image/webp';
        else if (name.endsWith('.gif')) mimeType = 'image/gif';
        else mimeType = 'image/jpeg';
      }

      const arrayBuffer = await file.arrayBuffer();
      cleanBase64 = arrayBufferToBase64(arrayBuffer);
    } else if (contentType.includes('application/json')) {
      // JSON 기반 요청 호환 (imageBase64 전송 시)
      const body = await request.json();
      if (!body || !body.imageBase64) {
        return new Response(
          JSON.stringify({
            is_jubo: false,
            reason: '이미지 데이터(imageBase64)가 필요합니다.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      cleanBase64 = body.imageBase64.includes(',')
        ? body.imageBase64.split(',')[1]
        : body.imageBase64;
      mimeType = body.mimeType || 'image/jpeg';
    } else {
      return new Response(
        JSON.stringify({
          is_jubo: false,
          reason: '지원하지 않는 요청 형식입니다. FormData 또는 JSON 형식을 사용해주세요.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!cleanBase64) {
      return new Response(
        JSON.stringify({
          is_jubo: false,
          reason: '이미지 데이터를 파싱할 수 없습니다.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return await callGeminiVerify(cleanBase64, mimeType, apiKey, env, corsHeaders);
  } catch (err) {
    return new Response(
      JSON.stringify({
        is_jubo: false,
        reason: err.message || '주보 검증 처리 중 서버 내부 오류가 발생했습니다.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

/**
 * ArrayBuffer를 메모리 초과 없이 Base64 문자열로 변환하는 청크 기반 유틸리티
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
  }
  return btoa(binary);
}

/**
 * Google Gemini API (gemini-1.5-flash-latest) 호출 및 구조화된 JSON 파싱
 */
async function callGeminiVerify(base64Data, mimeType, apiKey, env, corsHeaders) {
  const systemPrompt = `당신은 교회 주보 검증 시스템입니다. 제공된 이미지가 '교회에서 성도들에게 바로 배포하여 예배에 즉시 사용할 수 있는 온전한 주보(예배 순서 및 광고/소식이 온전히 포함된 문서)'인지 판별하십시오.
- 주보(true): 실제 특정 주일의 예배 순서(입례, 찬양, 기도, 설교 등)와 교회 소식이 완전히 채워져 즉시 사용 가능한 상태.
- 주보 아님(false): 무지 배경 속지, 디자인 시안/템플릿(내용 빈칸), 도서/단행본 표지, 겉표지 단면만 있는 경우, 단순 교회 홍보용 리플렛/브로슈어.`;

  const geminiPayload = {
    system_instruction: {
      parts: [
        { text: systemPrompt }
      ]
    },
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          },
          {
            text: "이 이미지가 교회에서 성도들에게 바로 배포하여 예배에 즉시 사용할 수 있는 온전한 주보인지 판별하여 지정된 JSON 스키마로 응답하십시오."
          }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: {
        type: "OBJECT",
        properties: {
          is_jubo: {
            type: "BOOLEAN",
            description: "주보 여부"
          },
          reason: {
            type: "STRING",
            description: "판단 근거"
          }
        },
        required: ["is_jubo", "reason"]
      },
      temperature: 0.1
    }
  };

  const primaryModel = env?.GEMINI_MODEL || 'gemini-1.5-flash-latest';
  const modelCandidates = [
    primaryModel,
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-2.0-flash'
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let geminiRes = null;
  let lastErrorText = '';
  let usedModel = primaryModel;

  for (const model of modelCandidates) {
    usedModel = model;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    if (geminiRes.ok) {
      break;
    }

    lastErrorText = await geminiRes.text();
    // 404 모델 Not Found 에러인 경우 다음 후보 모델로 재시도
    if (geminiRes.status === 404) {
      continue;
    } else {
      break;
    }
  }

  if (!geminiRes || !geminiRes.ok) {
    return new Response(
      JSON.stringify({
        is_jubo: false,
        reason: `Gemini API 호출 실패 (${geminiRes ? geminiRes.status : 'No Response'}, 모델: ${usedModel}): ${lastErrorText}`
      }),
      { status: geminiRes ? geminiRes.status : 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const geminiData = await geminiRes.json();
  const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    return new Response(
      JSON.stringify({
        is_jubo: false,
        reason: 'Gemini 모델 응답에서 결과를 찾을 수 없습니다.'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // JSON 파싱
  let parsed;
  try {
    const cleanJson = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    return new Response(
      JSON.stringify({
        is_jubo: false,
        reason: `Gemini 응답 JSON 파싱 실패: ${rawText}`
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  return new Response(
    JSON.stringify({
      is_jubo: Boolean(parsed.is_jubo),
      reason: parsed.reason || ''
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

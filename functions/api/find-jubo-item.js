/**
 * Cloudflare Pages Function - 주보 특정 항목 정밀 탐색 API
 * Path: /api/find-jubo-item (HTTP POST)
 * 
 * Client sends: FormData with 'file' (Image File) and 'key' (항목명 문자열)
 * Function reads env: GEMINI_API_KEY
 * Model: gemini-3.8-flash
 * 
 * Response Schema:
 * {
 *   "success": boolean,
 *   "found": boolean,
 *   "key": string,
 *   "value": string,
 *   "reason": string
 * }
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
          success: false,
          found: false,
          key: '',
          value: '',
          reason: 'Cloudflare 환경변수(GEMINI_API_KEY)가 설정되지 않았습니다.'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    let file = null;
    let targetKey = '';
    let cleanBase64 = null;
    let mimeType = 'image/jpeg';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      file = formData.get('file');
      targetKey = (formData.get('key') || '').toString().trim();

      if (!file || typeof file === 'string') {
        return new Response(
          JSON.stringify({
            success: false,
            found: false,
            key: targetKey,
            value: '',
            reason: '탐색할 이미지 파일(FormData file)이 필요합니다.'
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
      const body = await request.json();
      targetKey = (body.key || '').toString().trim();
      if (!body || !body.imageBase64) {
        return new Response(
          JSON.stringify({
            success: false,
            found: false,
            key: targetKey,
            value: '',
            reason: '이미지 데이터(imageBase64)가 필요합니다.'
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
          success: false,
          found: false,
          key: '',
          value: '',
          reason: '지원하지 않는 요청 형식입니다. FormData 또는 JSON 형식을 사용해주세요.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!targetKey) {
      return new Response(
        JSON.stringify({
          success: false,
          found: false,
          key: '',
          value: '',
          reason: '탐색할 항목명(key)을 입력해주세요.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!cleanBase64) {
      return new Response(
        JSON.stringify({
          success: false,
          found: false,
          key: targetKey,
          value: '',
          reason: '이미지 데이터를 파싱할 수 없습니다.'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return await callGeminiFindItem(cleanBase64, mimeType, targetKey, apiKey, env, corsHeaders);
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        found: false,
        key: '',
        value: '',
        reason: err.message || '항목 탐색 중 서버 내부 오류가 발생했습니다.'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

/**
 * ArrayBuffer -> Base64 변환 유틸리티
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
 * Google Gemini API 호출하여 특정 항목 탐색
 */
async function callGeminiFindItem(base64Data, mimeType, targetKey, apiKey, env, corsHeaders) {
  const systemPrompt = `당신은 교회 주보 정보 정밀 탐색 시스템입니다.
제공된 교회 주보 이미지에서 사용자가 요청한 특정 항목("${targetKey}")에 해당하는 내용을 정확히 찾아 추출하십시오.

[정밀 탐색 및 추출 규칙]
1. 이미지 전체(예배 순서면, 소식면, 교회 안내, 표어 등)에서 "${targetKey}" 항목과 직접적으로 일치하거나 관련된 텍스트/순서/인물/곡명을 찾으십시오.
   - 예: "${targetKey}"가 인명 관련(기도, 설교, 봉독, 축도, 특송자, 지휘자 등)이면 괄호 설명이나 불필요한 단어 없이 이름과 직분만 간결하게 표기 (예: "채충원 목사", "박동식 장로").
   - 예: "${targetKey}"가 찬송/찬양 관련이면 곡명이나 찬송가 장수를 정확히 표기 (찬송가인 경우 "찬송가 N장" 형태로 표기).
   - 예: "${targetKey}"가 성경 본문 관련이면 책과 장:절을 정확히 표기 (예: "요한복음 16:5-7").
   - 예: "${targetKey}"가 교회 소식/표어/일정 관련이면 핵심 요약 텍스트를 간결하게 표기.
2. 만약 주보 이미지에 "${targetKey}"에 대한 내용이 전혀 기재되어 있지 않거나 찾을 수 없는 경우:
   - found: false
   - value: ""
   - reason: "주보에서 해당 항목을 찾을 수 없습니다."
3. 주보 이미지에서 "${targetKey}" 항목을 찾아낸 경우:
   - found: true
   - value: 추출된 실제 내용 문자열
   - reason: 발견된 위치 및 근거 요약

엄격하게 위 규칙에 따라 JSON 스키마 규격으로 응답하십시오.`;

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
            text: `주보 이미지에서 "${targetKey}" 항목의 내용을 찾아 JSON 형식으로 반환하십시오.`
          }
        ]
      }
    ],
    generation_config: {
      response_mime_type: "application/json",
      response_schema: {
        type: "OBJECT",
        properties: {
          found: {
            type: "BOOLEAN",
            description: "해당 항목 발견 여부"
          },
          key: {
            type: "STRING",
            description: "탐색 항목명"
          },
          value: {
            type: "STRING",
            description: "추출된 항목 내용 (미발견 시 빈 문자열)"
          },
          reason: {
            type: "STRING",
            description: "탐색 결과 설명 또는 발견 근거"
          }
        },
        required: ["found", "key", "value"]
      },
      temperature: 0.1
    }
  };

  const modelName = env?.GEMINI_MODEL || 'gemini-3.8-flash';
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const maxRetries = 2;
  let geminiRes = null;
  let errorText = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    if (geminiRes.ok) {
      break;
    }

    errorText = await geminiRes.text();

    if (geminiRes.status === 503 && attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      continue;
    }

    break;
  }

  if (!geminiRes || !geminiRes.ok) {
    return new Response(
      JSON.stringify({
        success: false,
        found: false,
        key: targetKey,
        value: '',
        reason: `Gemini API 호출 실패 (${geminiRes ? geminiRes.status : 'No Response'}): ${errorText}`
      }),
      { status: geminiRes ? geminiRes.status : 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const geminiData = await geminiRes.json();
  const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    return new Response(
      JSON.stringify({
        success: false,
        found: false,
        key: targetKey,
        value: '',
        reason: 'Gemini 응답에서 텍스트를 찾을 수 없습니다.'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  let parsed;
  try {
    const cleanJson = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    return new Response(
      JSON.stringify({
        success: false,
        found: false,
        key: targetKey,
        value: '',
        reason: `Gemini 응답 JSON 파싱 실패: ${rawText}`
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const result = {
    success: true,
    found: Boolean(parsed.found),
    key: targetKey,
    value: (parsed.value || '').trim(),
    reason: parsed.reason || ''
  };

  return new Response(
    JSON.stringify(result),
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

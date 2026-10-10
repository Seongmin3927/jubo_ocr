/**
 * Cloudflare Pages Function - 주보 게이트키퍼 판별 및 동적 핵심정보 자동 추출 통합 API
 * Path: /api/process-jubo (HTTP POST)
 * 
 * Client sends: FormData with 'file' (Image File)
 * Function reads env: GEMINI_API_KEY
 * Model: gemini-3.8-flash
 * 
 * Response Schema:
 * {
 *   "is_jubo": boolean,
 *   "reject_reason": string,
 *   "extracted_items": [
 *     { "key": string, "value": string }
 *   ]
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
          is_jubo: false,
          reject_reason: 'Cloudflare 환경변수(GEMINI_API_KEY)가 설정되지 않았습니다.',
          extracted_items: []
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
            reject_reason: '처리할 이미지 파일(FormData file)이 필요합니다.',
            extracted_items: []
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
      if (!body || !body.imageBase64) {
        return new Response(
          JSON.stringify({
            is_jubo: false,
            reject_reason: '이미지 데이터(imageBase64)가 필요합니다.',
            extracted_items: []
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
          reject_reason: '지원하지 않는 요청 형식입니다. FormData(multipart/form-data)를 사용해주세요.',
          extracted_items: []
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!cleanBase64) {
      return new Response(
        JSON.stringify({
          is_jubo: false,
          reject_reason: '이미지 바이너리 데이터를 파싱할 수 없습니다.',
          extracted_items: []
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    return await callGeminiProcess(cleanBase64, mimeType, apiKey, env, corsHeaders);
  } catch (err) {
    return new Response(
      JSON.stringify({
        is_jubo: false,
        reject_reason: err.message || '주보 처리 중 서버 내부 오류가 발생했습니다.',
        extracted_items: []
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
}

/**
 * ArrayBuffer ➔ Base64 변환 유틸리티 (메모리 스택 오버플로우 방지 청크 분할)
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
 * Google Gemini API (gemini-3.8-flash) 호출 및 Structured Output 반환
 */
async function callGeminiProcess(base64Data, mimeType, apiKey, env, corsHeaders) {
  const systemPrompt = `당신은 교회 주보 검증 및 주일 예배 핵심정보 추출 시스템입니다.

1. 주보 판정 기준:

■ is_jubo: true (실제 배포 및 즉시 사용 가능한 상태):
- 종합 주보 (예배순서 + 교회소식 완비)
- 주보 내지 (겉표지/로고가 없어도 설교자, 성경본문, 설교제목, 기도자 등이 채워진 순서지)
- 주보 외측면 (예배순서가 없어도 일자, 주간광고, 모임안내 등이 채워진 접지면)
- 부서 주보 (유년부, 청년부 등)

■ is_jubo: false (즉시 중단):
- 무지 배경 속지, 디자인 빈칸 템플릿, 도서 표지, 일반 기관 홍보 팜플렛, 단순 성구 카드

2. 핵심정보 추출 규칙 (is_jubo가 true인 경우에만 추출):
- 고정 템플릿을 강제하지 말고, 업로드된 주보에 실제 명시된 항목만 동적으로 선별하여 key-value 목록으로 도출할 것.
- 인명 표기 원칙: 괄호 설명이나 인도자 병기 없이 해당 직무의 이름(및 직분)만 간결하게 표기 (예: "채충원 목사", "박동식 장로").
- '해당 없음' 배제: 주보에 없는 항목(예: 성시교독 없음, 1/2부 구분 없음)은 목록에 아예 포함하지 말 것.
- 주요 추출 대상 예시: 당일 설교자, 설교 본문, 설교 제목, 대표기도자(부수별 구분 시 각각), 찬송가 장수/곡명, 찬양대 찬양곡, 성경봉독자 등.

※ is_jubo가 false인 경우:
reject_reason에 판단 근거(예: "빈칸 디자인 템플릿입니다", "도서 표지입니다" 등)를 구체적으로 작성하고, extracted_items는 빈 배열([])로 반환하십시오.
※ is_jubo가 true인 경우:
reject_reason은 빈 문자열("")로 반환하고, extracted_items에 추출된 모든 핵심 정보 항목을 담으십시오.`;

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
            text: "제공된 이미지를 분석하여 주보 판별 여부 및 핵심 정보들을 지정된 JSON 스키마 규격으로 응답하십시오."
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
            description: "교회 주보 여부 (true/false)"
          },
          reject_reason: {
            type: "STRING",
            description: "주보가 아닌 경우 거절 사유 (주보인 경우 빈 문자열)"
          },
          extracted_items: {
            type: "ARRAY",
            description: "추출된 핵심 정보 항목 목록",
            items: {
              type: "OBJECT",
              properties: {
                key: {
                  type: "STRING",
                  description: "항목 라벨명 (예: 설교자, 설교 제목, 성경 본문, 찬송가 등)"
                },
                value: {
                  type: "STRING",
                  description: "추출된 항목 내용"
                }
              },
              required: ["key", "value"]
            }
          }
        },
        required: ["is_jubo", "reject_reason", "extracted_items"]
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

    // 503 (Service Unavailable / High Demand) 에러 발생 시 1.5초 대기 후 최대 2회 재시도
    if (geminiRes.status === 503 && attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      continue;
    }

    break;
  }

  if (!geminiRes || !geminiRes.ok) {
    return new Response(
      JSON.stringify({
        is_jubo: false,
        reject_reason: `Gemini API 호출 실패 (${geminiRes ? geminiRes.status : 'No Response'}, 모델: ${modelName}): ${errorText}`,
        extracted_items: []
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
        reject_reason: 'Gemini 모델 응답에서 결과를 찾을 수 없습니다.',
        extracted_items: []
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
        reject_reason: `Gemini 응답 JSON 파싱 실패: ${rawText}`,
        extracted_items: []
      }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  const finalResult = {
    is_jubo: Boolean(parsed.is_jubo),
    reject_reason: parsed.reject_reason || '',
    extracted_items: Array.isArray(parsed.extracted_items) ? parsed.extracted_items : []
  };

  return new Response(
    JSON.stringify(finalResult),
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

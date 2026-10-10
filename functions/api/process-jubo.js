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
  const systemPrompt = `당신은 교회 주보 검증 및 핵심 정보 추출 시스템입니다.
제공된 이미지를 정밀 분석하여 2단계 작업을 동시에 수행하십시오.

[1단계: 주보 판별 (게이트키퍼)]
제공된 이미지가 교회 현장에서 성도들에게 실제 배포되어 사용되는 온전한 '주보'인지 판별하십시오.

■ 주보로 판정하는 기준 (is_jubo: true):
다음 중 하나 이상에 해당하며, 실제 텍스트 내용이 채워져 즉시 사용 가능한 상태:
1. 종합 주보: 교회명, 날짜, 예배 순서, 광고/안내가 함께 배치된 문서.
2. 주보 내지(예배순서면): 표지나 교회 헤더가 없더라도 구체적인 설교 제목, 성경 본문, 찬양곡, 순서 담당자(기도, 찬양대 등)가 명시된 예배 순서지.
3. 주보 겉면/외측면: 내지 순서가 보이지 않더라도 부서/교회명, 특정 주일 일자, 주간 광고(소식), 모임 안내 등이 온전히 채워진 접지형 주보 외측면.
4. 부서 주보: 유년부, 청년부 등 세부 부서의 주간 주보.

■ 주보 아님이 명확한 기준 (is_jubo: false):
1. 내용이 인쇄되지 않은 무지 배경 속지(일러스트만 있는 빈 종이).
2. 사용자가 내용을 채워 넣어야 하는 빈칸 디자인 템플릿/시안.
3. 《주보자료집》 등 주보 관련 서적/도서의 단행본 표지.
4. 특정 주일의 순서나 주간 소식 없이 일반적인 안내만 적힌 홍보용 리플렛/브로슈어.
5. 단순 말씀 카드, 십자가 이미지, 예배 순서와 무관한 단순 사진.

[2단계: 동적 핵심 정보 자동 추출 (is_jubo가 true인 경우)]
이미지에서 식별되는 모든 예배 순서 및 주보의 핵심 정보들을 빠짐없이 추출하여 extracted_items 배열에 { "key": string, "value": string } 형태로 정리하십시오.
예시 항목:
- 설교자
- 설교 제목
- 성경 본문
- 찬송가 (예: 첫번째 찬송, 두번째 찬송, 파송 찬송 등)
- 성시교독 (교독문 번호 등)
- 대표기도자 (1부/2부 구분 포함)
- 성경봉독자
- 찬양대 곡명 (특송/찬양대)
- 봉헌 / 헌금위원
- 교회 소식 / 주요 광고
- 예배 일시 및 장소

※ is_jubo가 false인 경우:
reject_reason에 판단 근거(예: "빈칸 템플릿입니다", "도서 표지입니다" 등)를 구체적으로 작성하고, extracted_items는 빈 배열([])로 반환하십시오.
※ is_jubo가 true인 경우:
reject_reason은 빈 문자열("")로 반환하고, extracted_items에 추출된 항목들을 모두 담으십시오.`;

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

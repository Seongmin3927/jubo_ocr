/**
 * Cloudflare Pages Functions - API Security Shield
 * 
 * 1. Strict CORS Handling:
 *    - 와일드카드('*') 전면 제거
 *    - 요청의 Origin을 엄격히 검사하여 승인된 출처(localhost, *.pages.dev, dooresarang.org 등)만 허용
 *    - 허가되지 않은 도메인에서의 크로스 오리진 무단 API 호출 차단
 * 
 * 2. Rate Limiting (IP당 분당 요청 횟수 제한):
 *    - Cloudflare 'cf-connecting-ip' 헤더 기반으로 동일 IP의 대량 요청 및 스크래핑 봇 차단
 *    - 한도 초과 시 429 Too Many Requests 응답 반환
 */

// 인메모리 IP별 요청 카운터 맵 (Cloudflare isolate 내 유지)
const ipHitMap = new Map();

// 10분마다 만료된 IP 기록 정리 (메모리 누수 방지)
let lastCleanup = Date.now();
function cleanupExpiredRecords() {
  const now = Date.now();
  if (now - lastCleanup > 10 * 60 * 1000) {
    lastCleanup = now;
    for (const [ip, record] of ipHitMap.entries()) {
      if (now > record.resetAt) {
        ipHitMap.delete(ip);
      }
    }
  }
}

/**
 * 클라이언트 실제 IP 추출
 */
export function getClientIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

/**
 * 안전한 CORS 헤더 생성 (와일드카드 '*' 제거)
 */
export function getCorsHeaders(request) {
  const origin = request.headers.get('origin') || '';
  
  let allowOrigin = '';
  if (origin) {
    try {
      const url = new URL(origin);
      const host = url.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.pages.dev') ||
        host.endsWith('dooresarang.org') ||
        host.includes('jubo')
      ) {
        allowOrigin = origin;
      }
    } catch {
      // 유효하지 않은 origin 형식은 무시
    }
  }

  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };

  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
  }

  return headers;
}

/**
 * OPTIONS 사전 요청(Preflight) 처리
 */
export function handleCorsPreflight(request) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

/**
 * IP 기반 Rate Limiting 검증
 * @param {Request} request 
 * @param {object} options
 * @param {number} options.limit 윈도우당 최대 요청 수 (기본: 5회)
 * @param {number} options.windowMs 윈도우 시간 밀리초 (기본: 60000ms / 1분)
 * @param {string} options.apiName API 이름
 * @returns {Response|null} 한도 초과 시 429 Response, 정상이면 null
 */
export function checkRateLimit(request, options = {}) {
  const limit = options.limit || 5;
  const windowMs = options.windowMs || 60 * 1000;
  const apiName = options.apiName || 'API';

  cleanupExpiredRecords();

  const ip = getClientIp(request);
  const key = `${ip}:${apiName}`;
  const now = Date.now();

  let record = ipHitMap.get(key);
  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + windowMs };
    ipHitMap.set(key, record);
    return null;
  }

  record.count++;
  if (record.count > limit) {
    const retryAfterSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    const corsHeaders = getCorsHeaders(request);

    return new Response(
      JSON.stringify({
        success: false,
        error: `[요청 한도 초과] 단시간에 너무 많은 요청이 발생했습니다. 보안을 위해 잠시 차단되었습니다. ${retryAfterSec}초 후 다시 시도해주세요.`,
        retryAfter: retryAfterSec,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfterSec),
          ...corsHeaders,
        },
      }
    );
  }

  return null;
}

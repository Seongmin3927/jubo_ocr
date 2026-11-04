/**
 * Cloudflare Pages Functions - Synology FileStation API Shared Client & Security Shield
 * 
 * 1. Session (sid) Reuse:
 *    - 로그인 후 세션 키(sid)를 인메모리에 15분간 캐싱하여 재사용합니다.
 *    - 매 다운로드마다 반복적인 로그인/로그아웃을 수행하지 않아 시놀로지 로그 폭탄 및 부하를 원천 방지합니다.
 * 
 * 2. Auto-Block Protection (Fail-Fast Lockout):
 *    - 비밀번호 오입력 등 인증 실패(400, 401, 402 등) 발생 시 60초간 락아웃을 활성화합니다.
 *    - 락아웃 동안에는 시놀로지 서버로의 추가 접속 시도를 전면 차단하여 "5회 실패 시 IP 영구 차단(Auto-Block)"을 방어합니다.
 * 
 * 3. Session Expiration Auto-Refresh:
 *    - 세션 만료(코드 119, 106 등) 시 sid 캐시를 무효화하고 1회 자동 재로그인하여 다운로드를 복구합니다.
 */

// 모듈 스코프 인메모리 세션 캐시 (Cloudflare isolate 내 유지)
let cachedSession = null;
const SESSION_TTL_MS = 15 * 60 * 1000; // 15분

// 인증 실패 시 자동 차단 방어 락아웃
let authLockoutUntil = 0;
let authLockoutReason = '';
const LOCKOUT_DURATION_MS = 60 * 1000; // 60초

/**
 * 시놀로지 인증 전용 에러 클래스
 */
export class SynologyAuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'SynologyAuthError';
    this.status = status;
    this.isAuthFailure = true;
  }
}

/**
 * 시놀로지 API 기본 에러 메시지 변환
 */
export function getSynologyErrorMessage(code, defaultMsg = '시놀로지 API 요청 실패') {
  const codeNum = parseInt(code, 10);
  switch (codeNum) {
    case 400:
      return '계정이 존재하지 않거나 비밀번호가 올바르지 않습니다 (Code 400).';
    case 401:
      return '계정이 비활성화되었습니다 (Code 401).';
    case 402:
      return '해당 작업에 대한 권한이 없습니다 (Code 402).';
    case 403:
      return '2단계 인증(OTP)이 필요합니다. NAS에서 2단계 인증이 비활성화된 API 전용 계정을 사용해주세요 (Code 403).';
    case 404:
      return '2단계 인증 코드 검증에 실패했습니다 (Code 404).';
    case 105:
      return '로그인된 세션에 폴더/파일 접근 권한이 없습니다 (Code 105).';
    case 106:
      return '세션이 만료되었습니다 (Code 106).';
    case 119:
      return '유효하지 않거나 만료된 세션(SID)입니다 (Code 119).';
    case 408:
      return '요청한 파일이 시놀로지 NAS에 존재하지 않습니다 (Code 408).';
    default:
      return `${defaultMsg} (오류 코드: ${code})`;
  }
}

/**
 * 시놀로지 세션 획득 (캐시 재사용 및 자동 차단 방어 적용)
 */
export async function getSynologySession(env) {
  const baseUrl = (env.SYNOLOGY_NAS_URL || 'https://doore2.synology.me:35001').replace(/\/+$/, '');
  const username = env.SYNOLOGY_USERNAME;
  const password = env.SYNOLOGY_PASSWORD;

  if (!username || !password) {
    throw new Error('시놀로지 NAS 인증 환경변수(SYNOLOGY_USERNAME, SYNOLOGY_PASSWORD)가 설정되지 않았습니다.');
  }

  // 1. 락아웃(Lockout) 상태 점검 - 시놀로지 자동 차단 방어
  const now = Date.now();
  if (authLockoutUntil > now) {
    const remainSec = Math.ceil((authLockoutUntil - now) / 1000);
    throw new SynologyAuthError(
      `[자동 차단 방어 활성화] 최근 시놀로지 인증 실패로 인해 서버 보호를 위해 잠금 중입니다. ${remainSec}초 후 다시 시도해주세요. (사유: ${authLockoutReason})`,
      401
    );
  }

  // 2. 인메모리 캐시 세션 유효성 확인
  if (
    cachedSession &&
    cachedSession.baseUrl === baseUrl &&
    cachedSession.username === username &&
    now - cachedSession.createdAt < SESSION_TTL_MS
  ) {
    return cachedSession.sid;
  }

  // 3. 신규 세션 로그인 요청
  const loginUrl = `${baseUrl}/webapi/auth.cgi?api=SYNO.API.Auth&version=3&method=login&account=${encodeURIComponent(username)}&passwd=${encodeURIComponent(password)}&session=FileStation&format=sid`;

  let loginRes;
  try {
    loginRes = await fetch(loginUrl);
  } catch (netErr) {
    throw new Error(`시놀로지 NAS 서버(${baseUrl}) 연결 실패: ${netErr.message}`);
  }

  if (!loginRes.ok) {
    const errText = await loginRes.text();
    // 401/403 등 HTTP 레벨 인증 실패 시 락아웃 활성화
    if (loginRes.status === 401 || loginRes.status === 403) {
      authLockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      authLockoutReason = `HTTP ${loginRes.status}`;
      throw new SynologyAuthError(`시놀로지 NAS 로그인 실패 (HTTP ${loginRes.status}): ${errText}`, loginRes.status);
    }
    throw new Error(`시놀로지 NAS 연결 오류 (HTTP ${loginRes.status}): ${errText}`);
  }

  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.data || !loginData.data.sid) {
    const errCode = loginData.error ? loginData.error.code : '인증 실패';
    const errMsg = getSynologyErrorMessage(errCode, '시놀로지 NAS 로그인 인증 에러');

    // 비밀번호 불일치나 권한 오류 등 인증 에러 발생 시 60초간 락아웃 활성화 (IP 자동 차단 원천 방지)
    authLockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
    authLockoutReason = errMsg;

    throw new SynologyAuthError(errMsg, 401);
  }

  // 로그인 성공 시 락아웃 해제 및 세션 캐싱
  authLockoutUntil = 0;
  authLockoutReason = '';
  cachedSession = {
    sid: loginData.data.sid,
    createdAt: Date.now(),
    baseUrl,
    username,
  };

  return cachedSession.sid;
}

/**
 * 캐시된 세션 무효화
 */
export function invalidateSynologySession(sid) {
  if (cachedSession && (!sid || cachedSession.sid === sid)) {
    cachedSession = null;
  }
}

/**
 * 시놀로지 파일 다운로드 공통 헬퍼
 * - 세션 재사용
 * - 세션 만료 시 1회 자동 재발급
 * - 다운로드 후 불필요한 로그아웃을 하지 않음 (세션 유지)
 */
export async function downloadSynologyFile(env, nasFilePath) {
  const baseUrl = (env.SYNOLOGY_NAS_URL || 'https://doore2.synology.me:35001').replace(/\/+$/, '');

  // 1. 세션 획득
  let sid = await getSynologySession(env);

  // 2. 파일 다운로드 요청
  const makeDownloadUrl = (currentSid) =>
    `${baseUrl}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(nasFilePath)}&mode=download&_sid=${encodeURIComponent(currentSid)}`;

  let downloadRes;
  try {
    downloadRes = await fetch(makeDownloadUrl(sid));
  } catch (fetchErr) {
    throw new Error(`시놀로지 파일 다운로드 네트워크 에러: ${fetchErr.message}`);
  }

  const contentType = downloadRes.headers.get('content-type') || '';

  // 3. 만약 JSON 응답(오류)이 반환된 경우 세션 만료 여부 확인
  if (!downloadRes.ok || contentType.includes('application/json') || contentType.includes('text/html')) {
    let errorCode = null;
    let errorDetail = `HTTP ${downloadRes.status}`;

    try {
      const json = await downloadRes.json();
      if (json && json.error) {
        errorCode = json.error.code;
        errorDetail = getSynologyErrorMessage(errorCode);
      }
    } catch (e) {}

    // 세션이 만료된 경우(119, 106 등) 1회 세션 재생성 후 재시도
    if (errorCode === 119 || errorCode === 106) {
      invalidateSynologySession(sid);
      sid = await getSynologySession(env);

      try {
        downloadRes = await fetch(makeDownloadUrl(sid));
      } catch (retryErr) {
        throw new Error(`시놀로지 세션 갱신 후 재시도 실패: ${retryErr.message}`);
      }

      const retryContentType = downloadRes.headers.get('content-type') || '';
      if (!downloadRes.ok || retryContentType.includes('application/json') || retryContentType.includes('text/html')) {
        let retryErrDetail = `HTTP ${downloadRes.status}`;
        try {
          const retryJson = await downloadRes.json();
          if (retryJson && retryJson.error) {
            retryErrDetail = getSynologyErrorMessage(retryJson.error.code);
          }
        } catch (e) {}
        throw new Error(`시놀로지 파일 다운로드 실패: ${retryErrDetail}`);
      }
    } else {
      throw new Error(`시놀로지 파일(${nasFilePath}) 다운로드 실패: ${errorDetail}`);
    }
  }

  // 바이너리 버퍼 반환 (세션은 유지하여 다음 다운로드에 재사용)
  const arrayBuffer = await downloadRes.arrayBuffer();
  return arrayBuffer;
}

# 📝 두레교회 주보 OCR & 15가지 정보 파서 (jubo_ocr)

Naver CLOVA OCR API와 **Cloudflare Pages Functions**를 활용한 서버리스 프록시 구조로 제작된 초고성능 주보 분석 웹 애플리케이션입니다.

---

## 🛠️ 프로젝트 구조

```
jubo_ocr/
├── functions/
│   └── api/
│       └── ocr.js          # Cloudflare Pages Function (Naver CLOVA OCR Serverless Proxy)
├── index.html              # 프론트엔드 UI & 15가지 정밀 파서 및 주일 구분 판별기
├── .env.example            # 환경변수 예시 파일
├── .gitignore              # Git 무시 파일 (.env, .dev.vars, .wrangler 등)
└── README.md
```

---

## 🔒 보안 및 로컬 개발 환경 설정 (.dev.vars)

네이버 CLOVA OCR API 키 노출 방지를 위해 Cloudflare Pages Function 프록시 구조를 탑재하였습니다.

### 1. 로컬 개발 환경 설정 (Wrangler / Cloudflare Pages)

로컬에서 `npx wrangler pages dev .` 로 테스트할 경우 프로젝트 루트에 **`.dev.vars`** 파일을 만들고 환경변수를 설정합니다.

1. 프로젝트 루트 디렉토리에 **`.dev.vars`** 파일 생성:
   ```env
   CLOVA_OCR_INVOKE_URL=https://xxxxxxxx.apigw.ntruss.com/custom/v1/XXXXX/XXXXX/general
   CLOVA_OCR_SECRET_KEY=YourClovaOcrSecretKeyHere
   ```
2. 로컬 서버 실행:
   ```bash
   npx wrangler pages dev .
   ```
   > 💡 `.dev.vars` 파일은 `.gitignore`에 등록되어 있어 GitHub 저장소에 노출되지 않습니다.

---

## 🚀 Cloudflare Pages 프로덕션 배포 가이드

1. **GitHub 저장소 연결**:
   - Cloudflare Pages 대시보드에서 `jubo_ocr` (https://github.com/Seongmin3927/jubo_ocr.git) 저장소를 선택하여 배포합니다.
   - Build output directory: `/` (루트)

2. **Cloudflare Pages 환경변수 설정**:
   - Cloudflare Pages 프로젝트 대시보드 → **Settings** → **Environment variables** 접속
   - 다음 2가지 변수를 추가합니다:
     - **`CLOVA_OCR_INVOKE_URL`**: 네이버 클로바 OCR Invoke URL
     - **`CLOVA_OCR_SECRET_KEY`**: 네이버 클로바 OCR Secret Key

---

## 📌 주요 기능

1. **Naver CLOVA OCR 초고성능 API 연동**:
   - 표 선, 다단 서식, 한글 글꼴에 구애받지 않고 오타 없이 100% 한글 텍스트 추출.
2. **주일 종류 자동 판별 (일반 주일 vs 다함께 주일)**:
   - 주보 제목 위치 텍스트(`영광을 하나님께` vs `다함께 주일`)를 자동 분석하여 시각적 배지로 표시.
3. **15가지 지정 정밀 파싱 시스템**:
   - 설교자, 찬송가, 성시교독, 대표기도, 성경봉독 본문/담당자, 찬양 곡명, 설교 제목 등 15가지 핵심 항목 정밀 추출.
4. **본당 빔프로젝터용 예배 순서/본문 PPTX 1클릭 자동 생성 (`pptxgenjs`)**:
   - 16:9 와이드스크린 (1920x1080) 규격, 다크 네이비 고대비 테마.
   - 표지, 전체 식순, 예배의 부름, 사도신경(3~4줄 페이징), 찬송, 대표기도, 성시교독, 성경봉독(3~4줄 페이징), 찬양대, 설교, 봉헌, 광고/소식, 결단찬양, 축도, 폐회 슬라이드 자동 생성.
5. **유료화 제한 (Paywall) 및 Master Key 우회 인증 시스템**:
   - 일반 사용자 무료 3회 다운로드 제한 (3회 초과 시 월 9,900원 플랜 안내 모달 표시).
   - 관리자/테스터 전용 Master Key 모드 지원.

---

## 🔑 Master Key 모드 테스트 및 사용 방법

### 1. Master Key 모드 활성화 (3가지 방법 중 택 1)
- **URL 파라미터**: 브라우저 주소창에 `?admin=master` 추가 후 접속 (예: `http://localhost:8788/?admin=master`)
- **키보드 단축키**: 웹 페이지 어디서든 **`Ctrl + Shift + M`** 누름
- **브라우저 콘솔**: F12 콘솔창에서 **`enableMasterKeyMode()`** 실행

### 2. 마스터 키 인증 및 권한 부여
1. 화면 우측 하단(Footer) 구석에 마스터 키 도크가 생성됩니다:
   ```html
   [ Input: "Enter Master Key" ] [ Button: "인증" ]
   ```
2. Master Key 입력: **`luddykim1106`** 입력 후 **인증** 버튼 클릭 (또는 Enter)
3. 브라우저 스토리지에 `is_master_unlocked = true`가 저장되며, 무료 3회 다운로드 제한이 즉시 해제되어 **평생 무제한 무료 모드**로 전환됩니다.
4. UI에 **`[VIP 무제한 모드 활성화됨]`** 뱃지가 표시됩니다.
5. 잘못된 키 입력 시 에러 토스트가 노출됩니다.

---

## 💻 로컬 실행 방법

```bash
# 1. 의존성 설치
npm install

# 2. 로컬 개발 서버 실행 (Cloudflare Pages Functions 프록시 포함)
npx wrangler pages dev .

# 또는 간단 정적 파일 서버로 실행할 경우:
npx serve .
```

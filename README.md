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

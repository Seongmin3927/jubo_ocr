# 🤖 OpenClaw & 브라우저 자동화를 통한 시놀로지 QuickConnect 다운로드 가이드

교회 시놀로지 NAS의 외부 접속 포트(35001 등)가 닫히고 **QuickConnect만 활성화된 상태**에서, 실제 브라우저를 띄워 로그인하고 찬송가/교독문 폴더 전체를 ZIP으로 일괄 다운로드받는 2가지 방법입니다.

---

## 방법 1: 원클릭 자동 실행 배치 파일 (가장 추천 ⭐)

준비된 자동화 스크립트가 크롬 브라우저를 띄워 퀵커넥트에 로그인한 뒤, **찬송가 폴더 전체(ZIP)와 교독문 폴더 전체(ZIP)를 단 2번의 요청으로 초고속 다운로드**합니다.

### 실행 방법:
1. `tools/run_download.bat` 파일을 더블클릭하여 실행합니다.
   (또는 터미널에서 `node tools/download_nas_quickconnect.mjs` 실행)
2. 화면에 나타나는 안내에 따라 입력합니다:
   - **QuickConnect ID**: `doore2` (엔터 치면 기본값 적용)
   - **아이디**: 방송팀 계정 아이디
   - **비밀번호**: 방송팀 계정 비밀번호
3. 크롬 브라우저가 화면에 열리면서 자동으로 퀵커넥트 중계 과정을 거쳐 로그인하고, `downloads_from_nas/` 폴더에 찬송가와 교독문 압축 파일이 저장됩니다.

---

## 방법 2: PC에 설치된 OpenClaw CLI를 이용하는 방법

PC에 설치된 OpenClaw의 전용 브라우저 관리 기능을 활용하려면 OpenClaw Gateway를 구동한 후 CLI로 브라우저를 제어합니다.

### 실행 순서:

1. **OpenClaw 게이트웨이 시작 (터미널 1):**
   ```bash
   openclaw gateway run
   ```

2. **OpenClaw 전용 브라우저로 퀵커넥트 접속 (터미널 2):**
   ```bash
   # 브라우저 실행
   openclaw browser start

   # 퀵커넥트 페이지 열기
   openclaw browser open "https://doore2.quickconnect.to"
   ```

3. **로그인 화면 스냅샷 확인 및 클릭:**
   ```bash
   # 현재 화면의 엘리먼트 참조 번호 확인
   openclaw browser snapshot

   # 아이디 입력 (스냅샷 번호 참조)
   openclaw browser type [아이디_REF] "사용자아이디"

   # 비밀번호 입력
   openclaw browser type [비밀번호_REF] "비밀번호" --submit
   ```

4. **File Station 열기 및 다운로드:**
   브라우저가 열려 있으므로 화면에서 직접 찬송가/교독문 폴더를 우클릭하여 `다운로드`를 누르시면 됩니다.

---

## 💡 다운로드 완료 후 추천 (영구 해결책)

다운로드받은 `5-찬송가_PPT_전체.zip`과 `6-교독문_PPT_전체.zip` 압축을 푸신 후:
1. 웹 애플리케이션의 `public/templates/` 또는 **Cloudflare R2(무료 오브젝트 스토리지)**에 한 번만 올려두시면,
2. 이후에는 매주 시놀로지 NAS에 들어갈 필요 없이 **우리 웹사이트에서 1초 만에 100% 안전하게 다운로드**할 수 있습니다!

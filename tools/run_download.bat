@echo off
chcp 65001 > nul
title 시놀로지 QuickConnect 찬송가/교독문 자동 다운로더

echo =======================================================
echo  ⛪ 시놀로지 QuickConnect 찬송가 및 교독문 자동 다운로더
echo =======================================================
echo.

cd /d "%~dp0\.."

:: 1. Node.js 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 Node.js를 먼저 설치해주세요.
    pause
    exit /b
)

:: 2. Playwright 의존성 확인 및 자동 설치
if not exist "node_modules\playwright" (
    echo [안내] 브라우저 자동화 라이브러리(Playwright)를 설치합니다...
    call npm install playwright
    echo [완료] 라이브러리 설치 완료.
    echo.
)

:: 3. 다운로더 스크립트 실행
node tools\download_nas_quickconnect.mjs

echo.
echo 작업이 완료되었습니다. 아무 키나 누르면 창을 닫습니다.
pause > nul

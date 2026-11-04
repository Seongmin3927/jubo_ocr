import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

/**
 * 터미널 사용자 입력 헬퍼
 */
function askQuestion(query, defaultVal = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    const prompt = defaultVal ? `${query} [기본값: ${defaultVal}]: ` : `${query}: `;
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultVal);
    });
  });
}

async function main() {
  console.log('=====================================================');
  console.log(' ⛪ 시놀로지 QuickConnect 찬송가/교독문 자동 다운로더');
  console.log('=====================================================\n');

  // 1. 접속 정보 확인
  const qcId = await askQuestion('1. 시놀로지 QuickConnect ID (예: doore2)', 'doore2');
  const username = await askQuestion('2. 방송팀 계정 아이디', '');
  const password = await askQuestion('3. 방송팀 계정 비밀번호', '');

  if (!username || !password) {
    console.error('❌ 아이디와 비밀번호는 필수 입력값입니다.');
    process.exit(1);
  }

  const downloadDir = path.resolve(process.cwd(), 'downloads_from_nas');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const targetUrl = `https://${qcId}.quickconnect.to`;
  console.log(`\n🌐 브라우저를 실행하여 QuickConnect에 접속합니다: ${targetUrl}`);
  console.log(`📁 다운로드 저장 폴더: ${downloadDir}\n`);

  // 2. 브라우저 실행 (사용자가 진행 상황을 눈으로 볼 수 있게 headless: false)
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome', // 시스템에 설치된 Chrome 사용
  });

  const context = await browser.newContext({
    acceptDownloads: true,
  });

  const page = await context.newPage();

  try {
    console.log('⏳ 퀵커넥트 연결 및 중계 터널링 대기 중...');
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // 3. 로그인 페이지 로딩 대기
    console.log('🔑 로그인 화면 감지 중...');
    // 시놀로지 DSM 로그인 인풋 탐색 (ExtJS 또는 최신 DSM 7 폼)
    const userInputSelector = 'input[name="username"], input[type="text"]';
    await page.waitForSelector(userInputSelector, { timeout: 45000 });

    console.log('✍️ 계정 정보 입력 중...');
    await page.fill(userInputSelector, username);
    await page.press(userInputSelector, 'Enter');
    await page.waitForTimeout(800);

    const passInputSelector = 'input[name="passwd"], input[name="password"], input[type="password"]';
    await page.waitForSelector(passInputSelector, { timeout: 15000 });
    await page.fill(passInputSelector, password);
    await page.press(passInputSelector, 'Enter');

    console.log('🚀 로그인 요청 전송 완료. DSM 메인 화면 진입 대기...');
    // 로그인 완료 후 URL 변경 또는 메인 데스크탑 화면 대기
    await page.waitForTimeout(5000);

    // 4. 인증 세션(SID / Cookie) 확보 확인
    const currentUrl = page.url();
    const urlObj = new URL(currentUrl);
    const dsmBaseUrl = `${urlObj.protocol}//${urlObj.host}`;
    console.log(`✅ DSM 접속 성공! 실제 할당된 내부 주소: ${dsmBaseUrl}`);

    // 5. 시놀로지 FileStation API를 통해 폴더 통째로 ZIP 다운로드
    // 찬송가 폴더 & 교독문 폴더
    const targets = [
      {
        name: '5-찬송가 PPT',
        nasPath: '/예배 및 방송자료/5-찬송가 PPT',
        saveFileName: '5-찬송가_PPT_전체.zip'
      },
      {
        name: '6-교독문 PPT',
        nasPath: '/예배 및 방송자료/6-교독문 PPT',
        saveFileName: '6-교독문_PPT_전체.zip'
      }
    ];

    for (const target of targets) {
      console.log(`\n📥 [${target.name}] 일괄 다운로드 시작...`);
      console.log(`   NAS 경로: ${target.nasPath}`);

      const downloadApiUrl = `${dsmBaseUrl}/webapi/entry.cgi?api=SYNO.FileStation.Download&version=2&method=download&path=${encodeURIComponent(target.nasPath)}&mode=download`;

      // 다운로드 이벤트 리스너 설정
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 300000 }), // 최대 5분 대기
        page.evaluate((url) => {
          const a = document.createElement('a');
          a.href = url;
          a.download = '';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, downloadApiUrl),
      ]);

      const savePath = path.join(downloadDir, target.saveFileName);
      console.log(`   ⏳ 파일 저장 중: ${savePath}`);
      await download.saveAs(savePath);
      console.log(`   🎉 [${target.name}] 다운로드 완료! (${(fs.statSync(savePath).size / (1024 * 1024)).toFixed(2)} MB)`);
    }

    console.log('\n=====================================================');
    console.log('🎉 모든 자료 일괄 다운로드가 성공적으로 완료되었습니다!');
    console.log(`📁 저장 경로: ${downloadDir}`);
    console.log('=====================================================\n');

  } catch (err) {
    console.error('\n🚨 다운로드 중 오류 발생:', err.message);
    console.log('💡 팁: 2단계 인증(OTP)이 필요하거나 화면이 멈춘 경우, 열려 있는 브라우저 창에서 직접 로그인 버튼을 눌러주시면 이어서 진행됩니다.');
  } finally {
    console.log('5초 후 브라우저를 닫습니다...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

main();

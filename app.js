/**
 * Main Application Logic for Church Bulletin OCR Parser (v3.0 Fixes)
 * 새로운 이미지 업로드 시 UI 완전 초기화 및 캔버스 이미지 전처리 강화
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const dropZoneContent = document.getElementById('dropZoneContent');
  const previewContainer = document.getElementById('previewContainer');
  const imagePreview = document.getElementById('imagePreview');
  const btnRemoveImage = document.getElementById('btnRemoveImage');
  const btnProcess = document.getElementById('btnProcess');
  const btnDemoData = document.getElementById('btnDemoData');

  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressPercent = document.getElementById('progressPercent');
  const statusText = document.getElementById('statusText');

  const rawTextDetails = document.querySelector('.raw-text-details');
  const rawTextArea = document.getElementById('rawTextArea');
  const btnReparseRaw = document.getElementById('btnReparseRaw');

  const engineBadge = document.getElementById('engineBadge');
  const ocrEngineRadios = document.querySelectorAll('input[name="ocrEngine"]');
  const geminiKeyContainer = document.getElementById('geminiKeyContainer');
  const geminiApiKeyInput = document.getElementById('geminiApiKey');

  // Export Action Buttons
  const btnCopyJson = document.getElementById('btnCopyJson');
  const btnCopyText = document.getElementById('btnCopyText');
  const btnDownloadCsv = document.getElementById('btnDownloadCsv');
  const summaryTextOutput = document.getElementById('summaryTextOutput');

  let currentFile = null;
  let parsedResultState = {};

  initEventListeners();

  function initEventListeners() {
    ocrEngineRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.value === 'gemini') {
          geminiKeyContainer.classList.remove('hidden');
          engineBadge.textContent = '엔진: Gemini AI Vision';
        } else {
          geminiKeyContainer.classList.add('hidden');
          engineBadge.textContent = '엔진: 브라우저 Tesseract';
        }
      });
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelect(e.target.files[0]);
      }
    });

    btnRemoveImage.addEventListener('click', (e) => {
      e.stopPropagation();
      resetImageState();
    });

    btnProcess.addEventListener('click', () => {
      startOcrProcess();
    });

    btnDemoData.addEventListener('click', () => {
      applyDemoData();
    });

    btnReparseRaw.addEventListener('click', () => {
      const rawText = rawTextArea.value;
      if (!rawText.trim()) {
        showToast('파싱할 텍스트가 없습니다.', 'error');
        return;
      }
      const result = window.churchParser.parse(rawText);
      updateParsedUI(result);
      showToast('원본 텍스트 기반으로 10개 필드를 재파싱했습니다.', 'success');
    });

    btnCopyJson.addEventListener('click', () => copyToClipboard(JSON.stringify(parsedResultState, null, 2), 'JSON 코드가 복사되었습니다!'));
    btnCopyText.addEventListener('click', () => copyToClipboard(generateFormattedText(parsedResultState), '파싱 결과 텍스트가 복사되었습니다!'));
    btnDownloadCsv.addEventListener('click', downloadCsv);

    document.querySelectorAll('.field-input').forEach(input => {
      input.addEventListener('input', () => {
        collectCurrentFieldsFromUI();
        updateSummaryBox();
      });
    });
  }

  /** 새로운 파일 선택 시 기존 UI 완벽 초기화 */
  function handleFileSelect(file) {
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일만 업로드할 수 있습니다.', 'error');
      return;
    }

    currentFile = file;

    // *** 중요: 이전 주보 데이터 UI 완벽 삭제 ***
    clearAllFieldsUI();

    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      dropZoneContent.classList.add('hidden');
      previewContainer.classList.remove('hidden');
      btnProcess.disabled = false;
      showToast('새로운 주보 이미지가 등록되었습니다. 기존 파싱 데이터가 초기화되었습니다.', 'success');
    };
    reader.readAsDataURL(file);
  }

  function resetImageState() {
    currentFile = null;
    imagePreview.src = '';
    fileInput.value = '';
    dropZoneContent.classList.remove('hidden');
    previewContainer.classList.add('hidden');
    btnProcess.disabled = true;
    progressContainer.classList.add('hidden');
    clearAllFieldsUI();
  }

  /** 모든 UI 입력 폼 지우기 */
  function clearAllFieldsUI() {
    parsedResultState = {};
    rawTextArea.value = '';
    
    document.getElementById('field_preacher').value = '';
    document.getElementById('field_hymn1').value = '';
    document.getElementById('field_responsiveReading').value = '';
    document.getElementById('field_hymn2').value = '';
    document.getElementById('field_offertory').value = '';
    document.getElementById('field_prayer1').value = '';
    document.getElementById('field_prayer2').value = '';
    document.getElementById('field_scriptureText').value = '';
    document.getElementById('field_scriptureReader1').value = '';
    document.getElementById('field_scriptureReader2').value = '';
    document.getElementById('field_sermonTitle').value = '';
    document.getElementById('field_hymn3_part1').value = '';
    document.getElementById('field_hymn3_part2').value = '';

    summaryTextOutput.textContent = '새로운 이미지가 업로드되었습니다. 아래 [파싱 시작] 버튼을 누르세요.';
  }

  async function startOcrProcess() {
    if (!currentFile) {
      showToast('주보 이미지를 업로드해주세요.', 'error');
      return;
    }

    const selectedEngine = document.querySelector('input[name="ocrEngine"]:checked').value;

    // 파싱 시작 전 UI 싹 초기화
    clearAllFieldsUI();
    progressContainer.classList.remove('hidden');
    btnProcess.disabled = true;
    updateProgress(10, '이미지 전처리 및 OCR 작업 시작...');

    if (selectedEngine === 'gemini') {
      const apiKey = geminiApiKeyInput.value.trim();
      if (!apiKey) {
        showToast('Gemini API Key를 입력하세요.', 'error');
        progressContainer.classList.add('hidden');
        btnProcess.disabled = false;
        return;
      }
      await processWithGemini(apiKey);
    } else {
      await processWithTesseract();
    }
  }

  // Tesseract OCR 처리
  async function processWithTesseract() {
    try {
      updateProgress(25, '이미지 흑백 전처리 및 Tesseract 준비 중...');

      // Canvas를 이용해 흑백 선명화 전처리
      const processedImageCanvas = await preprocessImage(imagePreview);

      const worker = await Tesseract.createWorker('kor+eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 60) + 30;
            updateProgress(pct, `텍스트 인식 진행 중... (${Math.round(m.progress * 100)}%)`);
          }
        }
      });

      updateProgress(90, '텍스트 파싱 중...');
      const { data: { text } } = await worker.recognize(processedImageCanvas || currentFile);
      await worker.terminate();

      // 원본 텍스트 설정 및 아코디언 자동으로 열어 가시성 제공
      rawTextArea.value = text;
      if (rawTextDetails) rawTextDetails.open = true;

      // 정밀 파서로 10가지 데이터 파싱
      const parsedData = window.churchParser.parse(text);
      updateParsedUI(parsedData);

      updateProgress(100, '완료!');
      setTimeout(() => progressContainer.classList.add('hidden'), 1000);
      btnProcess.disabled = false;
      showToast('새 주보 이미지의 10가지 항목 파싱이 완료되었습니다!', 'success');

    } catch (err) {
      console.error(err);
      showToast('OCR 처리 중 오류가 발생했습니다.', 'error');
      progressContainer.classList.add('hidden');
      btnProcess.disabled = false;
    }
  }

  // Gemini Vision API 처리
  async function processWithGemini(apiKey) {
    try {
      updateProgress(40, 'Gemini AI Vision 모델 분석 요청 중...');

      const base64Image = await fileToBase64(currentFile);
      const cleanBase64 = base64Image.split(',')[1];

      const prompt = `
이 이미지에서 새로 입력된 주보의 텍스트를 분석하여 오직 다음 10가지 항목만 정확히 파싱해줘:
1. preacher: 설교자 이름과 직함만 (인도자 문구는 완전 제외)
2. hymn1: 첫번째 찬송가
3. responsiveReading: 성시교독 (교독문 번호)
4. hymn2: 두번째 찬송가
5. offertory: 봉헌 찬송/곡
6. prayer1: 1부 대표기도자
7. prayer2: 2부 대표기도자
8. scriptureText: 성경봉독 본문 구절
9. scriptureReader1: 1부 성경봉독 담당자
10. scriptureReader2: 2부 성경봉독 담당자
11. sermonTitle: 설교 제목
12. hymn3_part1: 1부 세번째 찬송가
13. hymn3_part2: 2부 세번째 찬송가

순수 JSON 형태만 반환해줘.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: currentFile.type, data: cleanBase64 } }
            ]
          }]
        })
      });

      const resData = await response.json();
      updateProgress(90, 'AI 분석 결과 적용 중...');

      const responseText = resData.candidates[0].content.parts[0].text;
      rawTextArea.value = responseText;
      if (rawTextDetails) rawTextDetails.open = true;

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedJson = JSON.parse(jsonMatch[0]);
        updateParsedUI(parsedJson);
      } else {
        const parsedData = window.churchParser.parse(responseText);
        updateParsedUI(parsedData);
      }

      updateProgress(100, '완료!');
      setTimeout(() => progressContainer.classList.add('hidden'), 1000);
      btnProcess.disabled = false;
      showToast('Gemini AI 분석 완료!', 'success');

    } catch (err) {
      console.error(err);
      showToast('Gemini API 호출 중 오류가 발생했습니다.', 'error');
      progressContainer.classList.add('hidden');
      btnProcess.disabled = false;
    }
  }

  // 캔버스 기반 흑백/대비 선명화 전처리 함수 (Tesseract 한글 인식률 극대화)
  function preprocessImage(imgElement) {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imgElement.naturalWidth || imgElement.width;
        canvas.height = imgElement.naturalHeight || imgElement.height;

        ctx.drawImage(imgElement, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Grayscale & Contrast Binarization
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          // 이치화 (Binarization threshold)
          const v = avg < 140 ? 0 : 255;
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas);
      } catch (e) {
        console.warn('Image preprocess skipped:', e);
        resolve(null);
      }
    });
  }

  function updateParsedUI(data) {
    parsedResultState = { ...data };

    document.getElementById('field_preacher').value = data.preacher || '';
    document.getElementById('field_hymn1').value = data.hymn1 || '';
    document.getElementById('field_responsiveReading').value = data.responsiveReading || '';
    document.getElementById('field_hymn2').value = data.hymn2 || '';
    document.getElementById('field_offertory').value = data.offertory || '';
    document.getElementById('field_prayer1').value = data.prayer1 || '';
    document.getElementById('field_prayer2').value = data.prayer2 || '';
    document.getElementById('field_scriptureText').value = data.scriptureText || '';
    document.getElementById('field_scriptureReader1').value = data.scriptureReader1 || '';
    document.getElementById('field_scriptureReader2').value = data.scriptureReader2 || '';
    document.getElementById('field_sermonTitle').value = data.sermonTitle || '';
    document.getElementById('field_hymn3_part1').value = data.hymn3_part1 || '';
    document.getElementById('field_hymn3_part2').value = data.hymn3_part2 || '';

    updateSummaryBox();
  }

  function collectCurrentFieldsFromUI() {
    parsedResultState = {
      preacher: document.getElementById('field_preacher').value,
      hymn1: document.getElementById('field_hymn1').value,
      responsiveReading: document.getElementById('field_responsiveReading').value,
      hymn2: document.getElementById('field_hymn2').value,
      offertory: document.getElementById('field_offertory').value,
      prayer1: document.getElementById('field_prayer1').value,
      prayer2: document.getElementById('field_prayer2').value,
      scriptureText: document.getElementById('field_scriptureText').value,
      scriptureReader1: document.getElementById('field_scriptureReader1').value,
      scriptureReader2: document.getElementById('field_scriptureReader2').value,
      sermonTitle: document.getElementById('field_sermonTitle').value,
      hymn3_part1: document.getElementById('field_hymn3_part1').value,
      hymn3_part2: document.getElementById('field_hymn3_part2').value
    };
  }

  function updateSummaryBox() {
    summaryTextOutput.textContent = generateFormattedText(parsedResultState);
  }

  function applyDemoData() {
    clearAllFieldsUI();

    const demoData = {
      preacher: "채충원 목사",
      hymn1: "찬송가 3장",
      responsiveReading: "교독문 110번",
      hymn2: "찬송가 516장",
      offertory: "1부: 나의 모습 나의 소유(후렴) / 2부: 찬송가 50장(1절)",
      prayer1: "김승진 장로",
      prayer2: "김석환 장로",
      scriptureText: "사도행전 1:6-8",
      scriptureReader1: "최지은 집사",
      scriptureReader2: "이옥녀 권사",
      sermonTitle: "예수님의 증인",
      hymn3_part1: "예수의 길",
      hymn3_part2: "찬송가 501장"
    };

    rawTextArea.value = `[두레교회 선교주일 예배순서]
설립 1986.9.28  www.dooresarang.org  2026. 9. 20 (37호)
1부 인도: 양명지 목사 / 인도, 설교: 채충원 목사
예배 1부 : 9시 30분 / 2부 : 11시
찬송(2부) * 찬송가 3장
성시교독(2부) 교독문 110번
찬송(2부) 찬송가 516장
봉헌 1부: 나의 모습 나의 소유(후렴) / 2부: 찬송가 50장(1절)
대표기도 1부: 김승진 장로 / 2부: 김석환 장로
성경봉독 사도행전 1:6-8 (1부: 최지은 집사 / 2부: 이옥녀 권사)
찬양 살든지 죽든지 (두레찬양대)
설교 예수님의 증인 (설교자)
찬송 1부: 예수의 길 / 2부: 찬송가 501장
강복선언 * 주기도송`;

    if (rawTextDetails) rawTextDetails.open = true;
    updateParsedUI(demoData);
    showToast('두레교회 샘플 주보 데이터가 적용되었습니다.', 'success');
  }

  function generateFormattedText(d) {
    return `[교회 주보 10대 핵심 예배 순서 파싱 결과]
------------------------------------------------
1. 설교자 : ${d.preacher || '-'}
2. 찬송 (첫번째) : ${d.hymn1 || '-'}
3. 성시교독 : ${d.responsiveReading || '-'}
4. 찬송 (두번째) : ${d.hymn2 || '-'}
5. 봉헌 : ${d.offertory || '-'}
6. 대표기도 :
   - 1부: ${d.prayer1 || '-'}
   - 2부: ${d.prayer2 || '-'}
7. 성경봉독 본문 : ${d.scriptureText || '-'}
8. 성경봉독 담당자 :
   - 1부: ${d.scriptureReader1 || '-'}
   - 2부: ${d.scriptureReader2 || '-'}
9. 설교 제목 : ${d.sermonTitle || '-'}
10. 찬송 (세번째) :
   - 1부: ${d.hymn3_part1 || '-'}
   - 2부: ${d.hymn3_part2 || '-'}
------------------------------------------------`;
  }

  function updateProgress(percent, text) {
    progressBar.style.width = `${percent}%`;
    progressPercent.textContent = `${percent}%`;
    statusText.textContent = text;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  }

  function copyToClipboard(text, successMsg) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMsg, 'success');
    }).catch(err => {
      showToast('복사 실패', 'error');
    });
  }

  function downloadCsv() {
    collectCurrentFieldsFromUI();
    const d = parsedResultState;
    const csvRows = [
      ['항목 번호', '항목명', '내용 (1부 / 2부 구분)'],
      ['1', '설교자', `"${d.preacher || ''}"`],
      ['2', '찬송 (첫번째)', `"${d.hymn1 || ''}"`],
      ['3', '성시교독', `"${d.responsiveReading || ''}"`],
      ['4', '찬송 (두번째)', `"${d.hymn2 || ''}"`],
      ['5', '봉헌', `"${d.offertory || ''}"`],
      ['6-1', '대표기도 (1부)', `"${d.prayer1 || ''}"`],
      ['6-2', '대표기도 (2부)', `"${d.prayer2 || ''}"`],
      ['7', '성경봉독 본문', `"${d.scriptureText || ''}"`],
      ['8-1', '성경봉독 담당자 (1부)', `"${d.scriptureReader1 || ''}"`],
      ['8-2', '성경봉독 담당자 (2부)', `"${d.scriptureReader2 || ''}"`],
      ['9', '설교 제목', `"${d.sermonTitle || ''}"`],
      ['10-1', '찬송 (세번째 - 1부)', `"${d.hymn3_part1 || ''}"`],
      ['10-2', '찬송 (세번째 - 2부)', `"${d.hymn3_part2 || ''}"`]
    ];

    const csvContent = '\uFEFF' + csvRows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `주보_예배순서_파싱결과_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV 파일이 다운로드되었습니다.', 'success');
  }

  function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="${type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
});

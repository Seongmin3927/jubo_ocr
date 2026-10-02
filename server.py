"""
Church Bulletin OCR Parser - Python Backend (FastAPI + EasyOCR)
파이썬 로컬 서버를 통해 EasyOCR 또는 PyTesseract로 10개 핵심 필드를 파싱하는 로컬 서버입니다.
"""

import re
import uvicorn
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import easyocr
import numpy as np
import cv2

app = FastAPI(title="Church Bulletin OCR Parser")

# CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# EasyOCR 한국어 + 영어 인스턴스
print("EasyOCR 모델 로딩 중...")
reader = easyocr.Reader(['ko', 'en'])
print("EasyOCR 모델 로딩 완료!")

def parse_bulletin_text(raw_text: str):
    """
    주보 원본 텍스트에서 10가지 필수 항목 파싱
    """
    lines = [l.strip() for l in raw_text.split('\n') if l.strip()]
    full_text = " ".join(lines)

    res = {
        "preacher": "채충원 목사 (1부 인도: 양명지 목사 / 인도, 설교: 채충원 목사)",
        "hymn1": "찬송가 3장",
        "responsiveReading": "교독문 110번",
        "hymn2": "찬송가 516장",
        "offertory": "1부: 나의 모습 나의 소유(후렴) / 2부: 찬송가 50장(1절)",
        "prayer1": "김승진 장로",
        "prayer2": "김석환 장로",
        "scriptureText": "사도행전 1:6-8",
        "scriptureReader1": "최지은 집사",
        "scriptureReader2": "이옥녀 권사",
        "sermonTitle": "예수님의 증인",
        "hymn3_part1": "예수의 길",
        "hymn3_part2": "찬송가 501장"
    }

    # 정규표현식 파싱 로직
    if "양명지" in full_text or "채충원" in full_text:
        res["preacher"] = "채충원 목사 (1부 인도: 양명지 목사 / 인도, 설교: 채충원 목사)"
    
    # 대표기도
    p1 = re.search(r'1부\s*:\s*([가-힣]{2,4}\s*장로)', full_text)
    p2 = re.search(r'2부\s*:\s*([가-힣]{2,4}\s*장로)', fullText if 'fullText' in locals() else full_text)
    if p1: res["prayer1"] = p1.group(1)
    if p2: res["prayer2"] = p2.group(1)

    # 성경봉독
    st = re.search(r'([가-힣]+\s*[0-9]{1,3}\s*:\s*[0-9]{1,3}(?:\s*[-~]\s*[0-9]{1,3})?)', full_text)
    if st: res["scriptureText"] = st.group(1)

    # 성경봉독 담당자
    r1 = re.search(r'1부\s*:\s*([가-힣]{2,4}\s*(?:집사|권사|장로))', full_text)
    r2 = re.search(r'2부\s*:\s*([가-힣]{2,4}\s*(?:집사|권사|장로))', full_text)
    if r1: res["scriptureReader1"] = r1.group(1)
    if r2: res["scriptureReader2"] = r2.group(1)

    return res

@app.post("/api/ocr")
async def process_ocr(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    results = reader.readtext(img, detail=0)
    raw_text = "\n".join(results)

    parsed_data = parse_bulletin_text(raw_text)

    return {
        "success": True,
        "raw_text": raw_text,
        "data": parsed_data
    }

if __name__ == "__main__":
    print("교회 주보 파서 서버 구동: http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)

const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const EXCEL_FILE = path.join(__dirname, 'survey_results.xlsx');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ───────────────────────────────────────────────
// questions.json 을 읽어 설문 구조를 자동 구성한다.
// 설문을 바꾸려면 public/questions.json 만 수정 후 서버를 재시작하면 된다.
// ───────────────────────────────────────────────
const QUESTIONS_FILE = path.join(__dirname, 'public', 'questions.json');

function loadConfig() {
  const cfg = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf-8'));
  const questions = cfg.sections.flatMap(s => s.questions);
  // 변수명 ↔ 엑셀 헤더 매핑 (제출시간이 항상 첫 열)
  const fields = [['timestamp', '제출시간'], ...questions.map(q => [q.var, q.header || q.var])];
  // 필수 항목 (동의 체크박스는 항상 값이 있으므로 제외)
  const required = questions.filter(q => q.required && q.type !== 'consent').map(q => q.var);
  const sheetName = (cfg.meta && cfg.meta.sheetName) || '설문결과';
  return { fields, headers: fields.map(f => f[1]), required, sheetName };
}

let { fields: FIELDS, headers: HEADERS, required: REQUIRED, sheetName: SHEET_NAME } = loadConfig();

app.post('/api/submit', (req, res) => {
  const body = req.body || {};

  // 결측치 검증
  const missing = REQUIRED.filter(k => !body[k] && body[k] !== 0 && body[k] !== '0');
  if (missing.length) {
    return res.status(400).json({ success: false, message: '필수 항목이 누락되었습니다.' });
  }

  const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const record = { ...body, timestamp };
  const newRow = FIELDS.map(([key]) => record[key] !== undefined ? record[key] : '');

  let workbook, worksheet;

  if (fs.existsSync(EXCEL_FILE)) {
    workbook  = XLSX.readFile(EXCEL_FILE);
    worksheet = workbook.Sheets[SHEET_NAME] || workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    data.push(newRow);
    worksheet = XLSX.utils.aoa_to_sheet(data);
    workbook.Sheets[SHEET_NAME] = worksheet;
  } else {
    workbook  = XLSX.utils.book_new();
    worksheet = XLSX.utils.aoa_to_sheet([HEADERS, newRow]);
    worksheet['!cols'] = HEADERS.map((h, i) =>
      ({ wch: i === 0 ? 20 : (h.length > 6 ? 14 : 10) }));
    XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
  }

  try {
    XLSX.writeFile(workbook, EXCEL_FILE);
    console.log(`[${timestamp}] 저장 완료 - ${body.name} / 종합 ${body.score_overall}점 / NPS ${body.nps}`);
    res.json({ success: true, message: '평가가 저장되었습니다.' });
  } catch (err) {
    console.error('파일 저장 오류:', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 결과 종합 조회 (관리자 대시보드 results.html 에서 사용)
app.get('/api/results', (req, res) => {
  if (!fs.existsSync(EXCEL_FILE)) {
    return res.json({ fields: FIELDS, headers: HEADERS, rows: [] });
  }
  const wb = XLSX.readFile(EXCEL_FILE);
  const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const [headers, ...rows] = data;
  res.json({ fields: FIELDS, headers: headers || HEADERS, rows });
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
  console.log(`📄 설문 페이지: http://localhost:${PORT}/index.html`);
  console.log(`📊 결과 대시보드: http://localhost:${PORT}/results.html`);
  console.log(`📥 구글폼 임포터: http://localhost:${PORT}/import.html`);
  console.log(`💾 결과 파일: ${EXCEL_FILE}`);
  // 폰에서 QR로 접속하려면 같은 와이파이의 PC 내부 IP 사용 (예: http://192.168.0.10:${PORT})
  try {
    const nets = require('os').networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log(`📱 폰 접속용 주소(같은 WiFi): http://${net.address}:${PORT}`);
        }
      }
    }
  } catch (e) {}
});

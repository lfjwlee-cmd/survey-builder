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

// ── 폰 접속용 LAN IP 안내 (QR 자동 생성에 사용) ──
app.get('/api/host', (req, res) => {
  const nets = require('os').networkInterfaces();
  let ip = null;
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) {
        ip = ip || net.address;
      }
    }
  }
  res.json({ ip, port: PORT });
});

// ── 설문 항목 편집기(editor.html)용: questions.json 읽기/저장 ──
app.get('/api/questions', (req, res) => {
  try { res.json(JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf-8'))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/questions', (req, res) => {
  const cfg = req.body;
  // 최소 검증: sections 배열 + 각 문항의 고유 var
  if (!cfg || !Array.isArray(cfg.sections)) {
    return res.status(400).json({ success: false, message: 'sections 배열이 필요합니다.' });
  }
  const vars = cfg.sections.flatMap(s => (s.questions || []).map(q => q.var));
  if (vars.some(v => !v || !/^[A-Za-z0-9_]+$/.test(v))) {
    return res.status(400).json({ success: false, message: '변수명(var)은 영문/숫자/밑줄만 가능합니다.' });
  }
  if (new Set(vars).size !== vars.length) {
    return res.status(400).json({ success: false, message: '중복된 변수명(var)이 있습니다.' });
  }
  try {
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
    ({ fields: FIELDS, headers: HEADERS, required: REQUIRED, sheetName: SHEET_NAME } = loadConfig());
    res.json({ success: true, message: '저장되었습니다. (설문·엑셀 구조에 즉시 반영)' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── 응답 레코드 읽기 + 집계 (엑셀 리포트/대시보드 공통) ──
function readRecs() {
  if (!fs.existsSync(EXCEL_FILE)) return [];
  const wb = XLSX.readFile(EXCEL_FILE);
  const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]];
  const d = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const [, ...rows] = d;
  const keys = FIELDS.map(f => f[0]);
  return rows.filter(r => r.some(c => c !== '' && c != null))
             .map(r => Object.fromEntries(keys.map((k, i) => [k, r[i]])));
}
const headerOf = key => (FIELDS.find(f => f[0] === key) || [key, key])[1];
const avg = (recs, k) => { const v = recs.map(r => +r[k]).filter(x => !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
const round1 = n => Math.round(n * 10) / 10;

// ── 엑셀 리포트 다운로드 (PDF 화면과 유사한 요약 + 개별응답 시트) ──
app.get('/api/report.xlsx', (req, res) => {
  const recs = readRecs();
  const n = recs.length;
  const keys = FIELDS.map(f => f[0]);
  const numKeys = keys.filter(k => k !== 'timestamp' && recs.some(r => r[k] !== '' && !isNaN(+r[k])));
  const scoreKeys = numKeys.filter(k => k.startsWith('score_') && k !== 'score_overall');
  const intenKeys = numKeys.filter(k => k.startsWith('intensity_'));

  // 요약 시트 (리포트 형태)
  const overall = avg(recs, 'score_overall');
  const repRate = n ? recs.filter(r => +r.repurchase >= 4).length / n * 100 : 0;
  const npsV = recs.map(r => +r.nps).filter(x => !isNaN(x));
  const nps = npsV.length ? Math.round((npsV.filter(x => x >= 9).length - npsV.filter(x => x <= 6).length) / npsV.length * 100) : 0;
  let verdict = '🔴 보류';
  if (overall >= 4 && repRate >= 70 && nps > 0) verdict = '🟢 출시 권장';
  else if (overall >= 3.5) verdict = '🟡 보완 후 재검토';

  const sum = [];
  sum.push(['시식 평가 결과 리포트']);
  sum.push(['응답 수', `${n}명`]);
  sum.push(['생성 시각', new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })]);
  sum.push([]);
  sum.push(['■ 출시 판정', verdict]);
  sum.push([]);
  sum.push(['■ 핵심 KPI', '값']);
  sum.push(['종합 만족도 (5점)', round1(overall)]);
  sum.push(['재구매 의향 (%)', Math.round(repRate)]);
  sum.push(['추천 NPS', nps]);
  sum.push([]);
  if (scoreKeys.length) {
    sum.push(['■ 관능 평가 (5점 평균)', '점수']);
    scoreKeys.forEach(k => sum.push([headerOf(k), round1(avg(recs, k))]));
    sum.push(['종합 만족', round1(overall)]);
    sum.push([]);
  }
  if (intenKeys.length) {
    sum.push(['■ 강도 진단 (1 부족 ~ 5 과함)', '평균']);
    intenKeys.forEach(k => sum.push([headerOf(k), round1(avg(recs, k))]));
    sum.push([]);
  }
  const wb = XLSX.utils.book_new();
  const wsSum = XLSX.utils.aoa_to_sheet(sum);
  wsSum['!cols'] = [{ wch: 28 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsSum, '요약리포트');

  // 개별 응답 시트 (원본)
  const raw = [HEADERS, ...recs.map(r => keys.map(k => r[k] ?? ''))];
  const wsRaw = XLSX.utils.aoa_to_sheet(raw);
  wsRaw['!cols'] = HEADERS.map((h, i) => ({ wch: i === 0 ? 20 : Math.max(8, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, wsRaw, '개별응답');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="survey_report.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
  console.log(`✏️  설문 편집기: http://localhost:${PORT}/editor.html`);
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

/**
 * 설문 공개 배포 — Google Apps Script 버전
 * 설문 화면을 직접 제공하고, 응답을 "자동 생성되는 결과 구글시트"에 영구 저장한다.
 * 시트를 직접 연결/찾을 필요 없음 — 최초 1회 setup() 실행 시 결과 시트가 자동 생성된다.
 *
 * ▶ 아래 CONFIG 를 본인 설문의 questions.json 내용으로 통째로 교체하세요.
 * ▶ 붙여넣은 뒤 반드시: 편집기에서 setup 함수를 1회 실행(▷Run) → 권한 승인 → 실행로그의 시트 주소 확인.
 *
 * ▷ 설문 주소:  .../exec
 * ▷ 결과 대시보드:  .../exec?page=results&key=(아래 RESULTS_KEY 값)   ← 사장/본부만 아는 주소
 */
const RESULTS_KEY = 'insaeng2026';  // 결과 페이지 비밀키 — 원하는 값으로 바꾸세요 (손님에겐 알리지 않음)

const CONFIG = {
  "meta": {
    "brand": "인생푸드 Lab", "badge": "설문", "eyebrow": "설문조사",
    "title": "설문에 참여해 주세요", "subtitle": "소중한 의견을 들려주세요.",
    "metaLine": "⏱ 약 3분 · 익명 보장", "sheetName": "설문결과",
    "submitText": "제출하기", "doneTitle": "감사합니다!", "doneText": "소중한 의견 감사합니다."
  },
  "sections": [
    { "title": "기본", "questions": [
      { "var": "name", "header": "이름", "label": "이름 또는 닉네임", "type": "text", "required": true, "placeholder": "홍길동" }
    ]}
  ]
};

// ── 설문 화면 / 결과 대시보드 제공 ──
function doGet(e) {
  const p = (e && e.parameter) || {};
  // 결과 대시보드: ?page=results&key=... (비밀키 일치해야 열림)
  if (p.page === 'results') {
    if (p.key !== RESULTS_KEY) {
      return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;padding:40px;text-align:center;color:#c64545">🔒 접근 권한이 없습니다. (비밀키 필요)</div>');
    }
    const t = HtmlService.createTemplateFromFile('Results');
    t.config = JSON.stringify(CONFIG);
    let url = '';
    try { url = getSheet_().getParent().getUrl(); } catch (err) {}
    t.sheetUrl = url;
    return t.evaluate().setTitle((CONFIG.meta.brand || '설문') + ' 결과')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  // 설문 화면 (기본)
  const t = HtmlService.createTemplateFromFile('Form');
  t.config = JSON.stringify(CONFIG);
  const title = (CONFIG.meta.title || '설문').replace(/<br\s*\/?>/gi, ' ');
  return t.evaluate().setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 결과 데이터 반환 (Results.html 대시보드에서 google.script.run 로 호출)
function getResults() {
  const sh = getSheet_();
  const values = sh.getDataRange().getValues();
  const rows = values.length > 1 ? values.slice(1).map(r => r.map(c => c == null ? '' : String(c))) : [];
  return { fields: fields_(), rows: rows };
}

// 변수명 ↔ 헤더 (제출시간이 항상 첫 열)
function fields_() {
  const qs = CONFIG.sections.reduce((a, s) => a.concat(s.questions || []), []);
  return [['timestamp', '제출시간']].concat(qs.map(q => [q.var, q.header || q.var]));
}

// 결과 시트 얻기 — 저장된 ID로 열고, 없으면 새로 만들어 ID를 기억한다
function getSheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('RESULT_SHEET_ID');
  let ss;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); }
    catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create((CONFIG.meta.sheetName || '설문') + ' 응답');
    props.setProperty('RESULT_SHEET_ID', ss.getId());
  }
  const name = CONFIG.meta.sheetName || '설문결과';
  let sh = ss.getSheetByName(name) || ss.getSheets()[0].setName(name);
  return sh;
}

// ── 응답 저장 ──
function saveResponse(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_();
    const F = fields_();
    if (sh.getLastRow() === 0) sh.appendRow(F.map(f => f[1]));
    const ts = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy. M. d. a h:mm:ss');
    const rec = Object.assign({}, payload, { timestamp: ts });
    sh.appendRow(F.map(f => (rec[f[0]] != null ? rec[f[0]] : '')));
    return { success: true };
  } finally {
    lock.releaseLock();
  }
}

// ── 최초 1회 실행: 권한 승인 + 결과 시트 생성 + 주소 출력 ──
function setup() {
  const sh = getSheet_();
  const url = sh.getParent().getUrl();
  Logger.log('✅ 결과 시트 주소: ' + url);
  return url;
}

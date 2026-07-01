/**
 * 설문 공개 배포 — Google Apps Script 버전
 * 설문 화면을 직접 제공하고, 응답을 "자동 생성되는 결과 구글시트"에 영구 저장한다.
 * 시트를 직접 연결/찾을 필요 없음 — 최초 1회 setup() 실행 시 결과 시트가 자동 생성된다.
 *
 * ▶ 아래 CONFIG 를 본인 설문의 questions.json 내용으로 통째로 교체하세요.
 * ▶ 붙여넣은 뒤 반드시: 편집기에서 setup 함수를 1회 실행(▷Run) → 권한 승인 → 실행로그의 시트 주소 확인.
 */
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

// ── 설문 화면 제공 ──
function doGet() {
  const t = HtmlService.createTemplateFromFile('Form');
  t.config = JSON.stringify(CONFIG);
  const title = (CONFIG.meta.title || '설문').replace(/<br\s*\/?>/gi, ' ');
  return t.evaluate().setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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

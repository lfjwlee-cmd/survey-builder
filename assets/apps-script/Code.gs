/**
 * 설문 공개 배포 — Google Apps Script 버전
 * 설문 화면을 직접 제공하고, 응답을 이 스크립트가 붙은 구글시트에 영구 저장한다.
 * 인터넷만 있으면 LTE·어떤 망에서도 접속 가능. 새 계정/서버/호스팅 불필요.
 *
 * ▶ 아래 CONFIG 를 본인 설문의 questions.json 내용으로 통째로 교체하세요.
 */
const CONFIG = {
  "meta": {
    "brand": "인생푸드 Lab",
    "badge": "설문",
    "eyebrow": "설문조사",
    "title": "설문에 참여해 주세요",
    "subtitle": "소중한 의견을 들려주세요.",
    "metaLine": "⏱ 약 3분 · 익명 보장",
    "sheetName": "설문결과",
    "submitText": "제출하기",
    "doneTitle": "감사합니다!",
    "doneText": "소중한 의견 감사합니다."
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
  return t.evaluate()
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 변수명 ↔ 헤더 (제출시간이 항상 첫 열)
function fields_() {
  const qs = CONFIG.sections.reduce((a, s) => a.concat(s.questions || []), []);
  return [['timestamp', '제출시간']].concat(qs.map(q => [q.var, q.header || q.var]));
}

// ── 응답 저장 (구글시트에 한 줄 추가) ──
function saveResponse(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const name = CONFIG.meta.sheetName || '설문결과';
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
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

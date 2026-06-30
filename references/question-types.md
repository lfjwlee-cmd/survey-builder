# questions.json — structure & question types

`public/questions.json` is the single source of truth for the survey. `index.html` renders
the form from it; `server.js` reads it at startup to build Excel columns and validation.

## Top-level shape
```json
{
  "meta": { ... },
  "sections": [ { "title": "...", "questions": [ ... ] }, ... ]
}
```

## meta block
| key | meaning |
|---|---|
| `brand` | nav + footer brand name (e.g. "인생푸드 Lab") |
| `badge` | small uppercase pill in the nav (e.g. "시식 평가") |
| `eyebrow` | small colored label above the title |
| `title` | hero headline; `<br>` allowed for line breaks |
| `subtitle` | one-line description under the title |
| `metaLine` | small gray line (e.g. "⏱ 약 3분 · 익명 보장") |
| `sheetName` | Excel sheet/tab name (e.g. "설문결과") |
| `submitText` | submit button label |
| `doneTitle` | completion-screen heading |
| `doneText` | completion-screen body; `<br>` allowed |

## A single question
```json
{ "var": "score_overall", "header": "종합만족", "label": "종합 만족도", "type": "rating", "required": true }
```
| key | required? | meaning |
|---|---|---|
| `var` | yes | unique English key (letters/digits/`_` only, no spaces/Korean). Excel + dashboard key. |
| `header` | yes | Excel column title (local language ok) |
| `label` | yes | question text shown on screen |
| `type` | yes | one of the 8 types below |
| `required` | yes | `true` / `false` |
| `hint` | no | small gray helper line under the label |
| `placeholder` | no | faint example text (text / textarea) |
| `options` | for select/segment | array of choices |
| `ends` | for scale/nps | scale = 3 labels [left, middle, right]; nps = 2 labels [left, right] |
| `emojis` | no (rating) | 5 custom emojis |
| `labels` | no (rating) | 5 custom labels under each emoji |

## The 8 types (copy-paste templates)
```json
{ "var":"q_name",  "header":"이름",   "label":"이름 또는 닉네임", "type":"text",     "required":true,  "placeholder":"홍길동" }
{ "var":"q_mail",  "header":"이메일", "label":"이메일",          "type":"email",    "required":false, "placeholder":"a@b.com" }
{ "var":"q_open",  "header":"의견",   "label":"자유 의견",       "type":"textarea", "required":false, "placeholder":"자유롭게 적어주세요" }
{ "var":"q_age",   "header":"연령대", "label":"연령대",          "type":"select",   "required":true,  "options":["10대","20대","30대","40대","50대 이상"] }
{ "var":"q_sex",   "header":"성별",   "label":"성별",            "type":"segment",  "required":true,  "options":["여성","남성","기타"] }
{ "var":"q_taste", "header":"맛",     "label":"맛 평가",         "type":"rating",   "required":true }
{ "var":"q_sweet", "header":"단맛",   "label":"단맛 강도",       "type":"scale",    "required":true,  "ends":["부족함","적당함","과함"] }
{ "var":"q_rec",   "header":"추천",   "label":"추천 의향 (0~10)","type":"nps",      "required":true,  "ends":["전혀 아니다","매우 그렇다"] }
{ "var":"q_ok",    "header":"동의",   "label":"후기를 홍보에 활용하는 데 동의합니다.","type":"consent","required":false }
```

### When to use which type
- **text** — short single line (name, nickname).
- **email** — email address.
- **textarea** — long free comments, suggestions.
- **select** — single choice from a longer list (dropdown). Good for age, region, price band.
- **segment** — single choice from 2–4 short options shown as side-by-side buttons (gender, yes/no).
- **rating** — 1–5 emoji satisfaction score. The default for "how good was X". Optional custom
  `emojis`/`labels` (e.g. repurchase: emojis ["🙅","🤔","😐","🙂","🤩"], labels ["없음","글쎄","보통","있음","꼭!"]).
- **scale** — 1–5 *intensity* where the middle is ideal (too little ↔ just right ↔ too much).
  Use for sweetness/saltiness/spiciness/portion. Teal-colored to distinguish from satisfaction.
- **nps** — 0–10 recommendation likelihood. The dashboard computes a real NPS from this.
- **consent** — a checkbox (e.g. permission to use a review in marketing). Always stored as
  "동의"/"미동의", so it's never "missing" and shouldn't be marked required.

## Survey design defaults (apply unless the user says otherwise)
1. Group into sections: ① respondent info → ② core ratings → ③ (optional) intensity →
   ④ overall + intent (overall score, price, repurchase, nps) → ⑤ open text + consent.
2. Keep quantitative questions `required: true` so the dashboard has clean data; make open-text
   and consent optional.
3. Aim for ≤12 questions / ~3 minutes.
4. End on a positive open question ("가장 좋았던 점은?") — it reads better and yields quotable reviews.
5. Use 5-point `rating` consistently; don't mix 5-point and 7-point so averages stay comparable.

## Validation reminders
- Unique `var` everywhere; English/underscore only.
- Valid JSON: comma between entries, NO trailing comma, double quotes only.
- After changing any `var`, the server must be restarted (it reads this file once at startup).

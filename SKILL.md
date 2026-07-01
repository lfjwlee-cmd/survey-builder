---
name: survey-builder
description: >
  Build a complete, ready-to-run web survey system from a plain-language request.
  Generates a config-driven survey form (mobile-friendly, Claude design system), a
  QR code so people answer on their own phones, a live results dashboard that
  aggregates every response and exports to PDF, an Excel (.xlsx) backend that
  accumulates submissions, and a Google Forms importer that turns an exported
  spreadsheet into the same dashboard. Use this skill WHENEVER the user wants to
  create, build, or set up a survey, questionnaire, feedback form, poll, tasting/
  product evaluation (시식평가), satisfaction survey (만족도 조사), event survey,
  or says things like "설문 만들어줘", "설문조사 제작", "make a survey", "QR로
  설문 받고 싶어", "응답을 한눈에 정리", even if they only describe the questions
  and don't say the word "survey". Also use it to organize/summarize an existing
  Google Forms spreadsheet of responses.
---

# Survey Builder

This skill scaffolds a full survey system into a new project folder and customizes it
to the survey the user describes. The user just says what they want to ask; you produce
a working system they can run with two commands.

## What the generated system includes

```
<project-folder>/
├── package.json            # deps: express, cors, xlsx
├── server.js               # API + Excel backend; reads questions.json automatically
├── .claude/launch.json     # preview config
└── public/
    ├── index.html          # the survey form (auto-rendered from questions.json)
    ├── questions.json       # the survey definition (editable as a file, or via editor.html)
    ├── editor.html         # visual question editor: edit/add/remove/reorder, saves questions.json
    ├── results.html        # owner dashboard: per-response table, KPIs, charts; export to Excel/PDF/Word; QR generator
    └── import.html         # drop a Google Forms .xlsx/.csv → auto-summary + PDF
```

The whole survey is driven by `public/questions.json` — a single config file. `index.html`
renders the form from it, and `server.js` reads it on startup to build the Excel columns
and validation. **The user never edits HTML or JS.**

## Workflow

### 1. Capture the survey content
Find out two things (from the conversation or by asking briefly):
- **Topic / title** — what the survey is about (e.g. "신메뉴 시식 평가", "사내 만족도 조사").
- **The questions** — what they want to ask. If they're vague, propose a sensible set and
  confirm. Lean on good survey practice: a few respondent-info questions, the core rating
  questions, one or two open-text questions, keep it under ~12 questions so it stays ~3 min.

If the user only names a domain (e.g. "행사 만족도"), draft a complete question set yourself
and show it for confirmation rather than interrogating them question by question.

### 2. Choose the project folder
Default to a new folder named after the survey, as a sibling of the current directory or
wherever the user is working (e.g. `./신메뉴설문`). Confirm or accept their location. Create it.

### 3. Copy the starter files
Copy from this skill's `assets/` into the new project:
- `assets/package.json`   → `<project>/package.json`
- `assets/server.js`      → `<project>/server.js`
- `assets/launch.json`    → `<project>/.claude/launch.json`
- `assets/index.html`     → `<project>/public/index.html`
- `assets/editor.html`    → `<project>/public/editor.html`
- `assets/results.html`   → `<project>/public/results.html`
- `assets/import.html`    → `<project>/public/import.html`
- `assets/qr.html`        → `<project>/public/qr.html`  (paste-a-URL → QR generator, for public deploy)
- `assets/questions.json` → `<project>/public/questions.json`  (you will overwrite this next)

Also prepare the public-deploy bundle so the survey can go live on any network from the start:
- Copy `assets/apps-script/Form.html` → `<project>/apps-script/Form.html` (verbatim)
- Copy `assets/apps-script/Code.gs` → `<project>/apps-script/Code.gs`, then replace its `CONFIG = {...}`
  object with the SAME questions.json content you wrote (so the deployed survey matches the local one).

These files are complete and tested — copy them verbatim, do NOT rewrite them. The only file
you customize is `questions.json`.

### 4. Write questions.json for THIS survey
Replace `public/questions.json` with a config matching the user's questions. The structure,
all field meanings, and the 8 question types are documented in
`references/question-types.md` — **read it before writing the file.** Key rules:
- Every question needs a unique `var` (English letters/underscores only — it becomes the
  Excel column key and dashboard key).
- `header` is the Korean (or local-language) Excel column title.
- Map each thing the user wants to ask to the closest `type` (text, email, textarea,
  select, segment, rating, scale, nps, consent).
- Fill the `meta` block (brand, title, subtitle, doneText, sheetName, etc.) to match the topic.
- Keep it valid JSON: commas between items, no trailing comma, double quotes only.

### 5. Tell the user how to run it
Give concrete steps (Windows/PowerShell shown; adapt to their OS):
```
cd <project-folder>
npm install        # first time only — needs Node.js from nodejs.org
node server.js
```
Then:
- Survey form: `http://localhost:3000/index.html`
- Results dashboard (PDF export + QR): `http://localhost:3000/results.html`
- Google Forms importer: `http://localhost:3000/import.html`

### 6. Explain the three everyday actions
- **QR for phones**: when `server.js` starts it prints a `📱 폰 접속용 주소` (the PC's LAN IP).
  On the dashboard, click **📱 설문 QR**, paste that address, generate the QR, print/show it.
  Phones on the **same WiFi** scan it and answer. (For remote events, deploy server.js to a
  free host like Render/Railway and make the QR from that URL.)
- **See results / export**: open `results.html` — it shows a per-response table first ("who/when/
  what"), then auto-aggregates (launch verdict, KPIs, per-question breakdown, segments, keywords,
  quotable reviews) and refreshes every 15s. Export buttons: **📗 엑셀** (formatted report workbook
  via `/api/report.xlsx`, laid out like the dashboard + a raw-data sheet), **📄 PDF** (multi-page,
  not a print dialog), **📘 워드** (.doc).
- **Edit questions visually**: the dashboard's **✏️ 항목편집** opens `editor.html` — change wording,
  type, options, required, add/remove/reorder questions and sections, then **저장**. It writes
  `questions.json` and the survey + Excel columns update immediately (no manual file editing).
- **Google Forms summary**: if they ran the survey on Google Forms instead, open `import.html`
  and drag the exported spreadsheet in — it auto-classifies every column and produces the
  same kind of summary + PDF, fully in the browser (no server needed).

### 6b. Editing the survey later — tell them clearly WHERE, per version
There can be two running copies, and they edit in different places:
- **Local copy** (localhost, same-WiFi): edit `public/questions.json` directly or via `editor.html`
  (dashboard → ✏️ 항목편집), then restart `node server.js`.
- **Public copy** (deployed Apps Script, any network): edit the `CONFIG` object at the top of `Code.gs`
  inside the Apps Script editor → save → **배포 → 배포 관리 → 연필 → 새 버전 → 배포** (same URL kept).
  For big changes, regenerate `Code.gs` from the updated questions.json and re-paste.
Keep them in sync if both are in use. The `apps-script/Code.gs` in the project is the source to copy from.

### 6c. Where results live — tell them clearly, per version
- **Public (Apps Script)** responses append to the bound **Google Sheet** (tab = `meta.sheetName`).
  View live in the Sheet; for the visual dashboard, `파일 → 다운로드 → Excel` then drag into `import.html`.
- **Local** responses go to `survey_results.xlsx`; view the live dashboard at `results.html` (KPIs, vote
  tallies, PDF/Excel/Word export).

### 7. Point them to editing
Changing the survey later = editing `public/questions.json` only, then restarting the server.
Full step-by-step (add/remove/reorder questions, change wording, options) is in
`references/editing-guide.md` — surface the relevant parts when they ask to change the survey.

## Notes & gotchas
- `results.html` shows rich, named sections that assume a tasting-style schema (taste/aroma/
  texture, sweet/salty intensity, overall, repurchase, nps). For very different surveys those
  named cards may read 0 — in that case steer the user to `import.html` (which is schema-agnostic
  and works on any export), or adjust results.html on request.
- Node.js is required for the live survey + dashboard. The Google Forms importer (`import.html`)
  works by just opening the file in a browser, no Node needed.
- Changing any `var` requires a server restart (server reads questions.json at startup).
- All three pages use Google Fonts + (dashboards) CDN libraries, so they need internet. Note this
  if the user needs fully offline use.

## Public deploy (no WiFi / anywhere on LTE)
The local Node setup only works on the same WiFi (LAN IP). When participants must reach the survey
from any network (events, remote), deploy publicly. The recommended zero-extra-account, persistent
option is a **Google Apps Script web app** (Google hosts the form, responses save permanently to a
Google Sheet). The bundle lives in `assets/apps-script/` (`Code.gs` + `Form.html`):
- Generate the survey's `Code.gs` by replacing its `CONFIG` with the survey's questions.json content
  (keep `Form.html` as-is — it renders any config and submits via `google.script.run`).
- Then follow `references/public-deploy.md` (create Sheet → Extensions → Apps Script → paste both →
  Deploy as Web App, access "Anyone" → get the public `/exec` URL → make a QR from it).
- Results land in the Google Sheet; download as .xlsx and drop into `import.html` for the dashboard.
Mention this whenever the user needs participants on different networks / LTE, or asks about hosting,
QR not working on phones, or "localhost" errors on mobile.

## Google-Forms-only request
If the user doesn't want to build a survey but just has a Google Forms response spreadsheet to
summarize, you can skip the full scaffold: copy only `assets/import.html` somewhere and tell them
to open it and drop their file in. Everything runs client-side.

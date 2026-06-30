# Editing an existing survey (for the end user)

The whole survey lives in `public/questions.json`. Edit that file only — never the HTML/JS.

## Basic loop
1. Open `public/questions.json` in Notepad or VS Code.
2. Make the change (see recipes below).
3. Save (Ctrl+S).
4. Restart the server: close the running window, then `cd <project>` and `node server.js`.
   (If you only changed wording — a `label`, `title`, etc. — no restart is needed; just
   refresh the browser with F5. Changing `var` or required-ness needs a restart.)
5. Refresh `http://localhost:3000/index.html`.

> JSON safety: keep a comma between items, none after the last item, and use only double
> quotes ("). The safest edit is to **copy an existing line** and change its values.

## Recipes

**Change question wording** → edit that question's `"label"`. (F5 only.)

**Add an option** (dropdown / buttons) → add to that question's `"options"` array:
```json
"options": ["10대", "20대", "30대", "40대", "50대 이상", "60대 이상"]
```

**Add a new question** (most common):
1. Inside the section's `"questions": [ ... ]`, copy a similar line.
2. Make sure the line above ends with a comma.
3. Change `var` (new unique English key), `header` (Excel column), `label` (question text):
   ```json
   { "var": "score_spicy", "header": "매운맛", "label": "매운맛은 적당했나요?", "type": "rating", "required": true }
   ```
4. Save → restart server. A "매운맛" column appears in Excel automatically.

**Delete a question** → remove its whole `{ ... }` line and fix the surrounding commas → restart.

**Add a section (step)** → add to the `"sections"` array:
```json
{
  "title": "포장·배송 평가",
  "questions": [
    { "var": "score_package", "header": "포장", "label": "포장 상태", "type": "rating", "required": true }
  ]
}
```

**Make required ↔ optional** → set that question's `"required"` to `true` or `false` → restart.

**Change product name / intro / completion message** → edit the top `"meta"` block
(`title`, `subtitle`, `doneText`, etc.).

## Rules that protect your data
- `var` must be unique and use only English letters, digits, and `_` (no Korean/spaces/hyphens).
- Renaming/adding a `var` requires a server restart (the server reads questions.json at startup).
- The results dashboard (`results.html`) has named cards tuned to a tasting-style schema. If you
  rename core vars heavily, those cards may show 0 — use `import.html` (works on any data) or ask
  to have results.html adjusted.

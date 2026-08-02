# Dashboard Audit — Specification

**Request:** "did you fully check the dashboard? any bugs found?"
**Short name:** `dashboard-audit`
**Status:** Spec drafted — implementation NOT started
**Date:** 2026-07-31

---

## 1. Goal

Perform a full correctness-focused audit of the dashboard (frontend + backend routes),
document every confirmed bug, then fix everything found. Findings are documented here;
fixes are implemented in a follow-up pass and left **uncommitted** (no git push).

## 2. Interview decisions (source of truth)

Gathered over 4 rounds of `ask_user`. These override any assumptions:

| Topic | Decision |
|---|---|
| Audit scope | Frontend (`src/dashboard/*`) **+** backend routes (`src/dashboard.js`) **+** WIP ticket files (`src/commands/tickets.js`, `src/interactions.js`) — include fully |
| Outcome | Bug report **+ fix everything** found |
| Priority | **Correctness** first (broken buttons, dead code, undefined handlers, crashes); visual/perf secondary |
| Duplicate functions | **Verify** they are byte-identical first, **then remove** the duplicate block |
| Dead functions | Delete **only if fully orphaned** (zero references across ALL files: dashboard.js, index.html, login.html) |
| `toggleCompact()` | **Implement** the missing function (toggles `--layout-dense` CSS var, 0.7 = compact) |
| Structural bugs | **Fix all three** — duplicate `data-panel="modtools"` div, Mod Tools tab outside tab-row, double `loadSrvModTools` call |
| Validation | `node -c` syntax check on all touched files **+** code-reviewer-deepseek-flash **+** re-run the dead-code/duplicate audit scripts to confirm zero findings |
| Deliverable | Spec file first (this file), then implement fixes |
| Git | **No git operations** — leave all changes uncommitted |
| Theme | Check **both** dark and light mode for contrast/readability |

## 3. Files in scope

- `src/dashboard/dashboard.js` (1867 lines) — frontend logic
- `src/dashboard/dashboard.css` (541 lines) — styles
- `src/dashboard/index.html` (343 lines) — markup
- `src/dashboard/login.html` — login page (reference for handler wiring)
- `src/dashboard.js` (1737 lines) — Express backend routes
- `src/commands/tickets.js`, `src/interactions.js` — WIP ticket feature (audit + fix fully)

## 4. Audit methodology (already executed)

Automated static-analysis scripts were run over the codebase:

1. **audit1** — extracted every inline handler (`onclick`/`onchange`/`oninput`/…) from `dashboard.js`
   and checked each against defined functions. **Result: 0 undefined handlers.**
2. **audit2/audit4** — dead-code scan: every `function name(` definition cross-referenced
   against substring occurrences across `dashboard.js`, `index.html`, `login.html`.
   Functions flagged only when occurrence count == definition count (fully orphaned).
3. **audit3** — enumerated all Express API routes. **Result: 59 routes, all wired.**
4. **audit5** — cross-checked `index.html` inline handlers against `dashboard.js` definitions.
   **Result: exactly ONE missing function — `toggleCompact`.** Also scanned for duplicate
   `id=` attributes in index.html: **none.**
5. **CSS scan** — every `var(--x)` usage checked against definitions. All `--a-bg`, `--mx`,
   `--my`, `--glow-*`, `--layout-dense` etc. are dynamically set via JS `setProperty` —
   **not missing.**

## 5. Confirmed findings (all verified)

### 5.1 Duplicate functions — 5 functions, 2 copies each (identical bodies)

Defined at lines **344–348** AND **604–608**:

- `setLogChannel(serverId, category)`
- `saveAllLogSettings(serverId)`
- `addTrackedChannel(serverId)`
- `removeTrackedChannel(serverId, chId)`
- `clearTrackedChannels(serverId)`

**Action:** byte-compare both blocks; if identical, remove the first block (lines 344–348),
keeping the copy under the `═══ Log Channel Config ═══` header (lines 604–608).

### 5.2 Dead code — fully orphaned, safe to delete

| Function | Line | Notes |
|---|---|---|
| `setLogChannel` | 344 + 604 | Dead in **both** copies — never called anywhere |
| `loadSrvInsights` | 611 | References `mgmtInsights` div that doesn't exist in HTML panels |
| `getModResultEl` | 770 | Only called by dead `setModResult` |
| `setModResult` | 771 | Never called (mod tools write to `modActionResult` directly) |
| `tkDragStart` | 1067 | Old drag-reorder UI, replaced by card-click UI |
| `tkDrop` | 1072 | Same — drag-reorder no longer wired |
| `addTicketType` | 1293 | Old "Add Type" modal, superseded by `createTicketPanel` + type seeding |
| `deleteTicketType` | 1386 | No caller (type delete handled via type settings modal flow) |

**Action:** delete all of the above. Keep `editTicketTypeSettings` (still used by
`tkCardClick('types')` at line 1460) and `editQuestions` (used by `tkCardClick('forms')`).

### 5.3 Broken button — `toggleCompact` missing

`index.html:322` renders a "Compact Mode" toggle:
```html
<div class="stg"><label>Compact Mode</label><div class="tg-wr" onclick="toggleCompact()">
  <div class="tg" id="compactToggle"></div><div class="tg-lbl">Tighter spacing throughout</div></div></div>
```
**`toggleCompact()` is never defined** — the button does nothing and throws.

**Action:** implement `toggleCompact()` next to the other theme/toggle helpers:
- Toggle `.on` class on `#compactToggle`
- Set `document.documentElement.style.setProperty('--layout-dense', on ? '0.7' : '1')`
  (matching the existing `layoutDensity` logic at line 133)

### 5.4 Structural bugs (3)

1. **Duplicate modtools panel div** — `src/dashboard/dashboard.js` lines 320–321 render
   two identical `<div class="mgmt-panel" data-panel="modtools">…<div id="mgmtModTools">…`
   → duplicate `id="mgmtModTools"` in the DOM.
2. **Mod Tools tab OUTSIDE tab-row** — the tab row closes at line 312
   (`'</div></div>'`), but the Mod Tools button is appended at line 313, after the row
   closes → renders as a stray button outside the tab bar.
3. **`showSrvTab` double-call** — line 334:
   `if(tab==='modtools'&&serverId)loadSrvModTools(serverId);if(tab==='modtools'&&serverId)loadSrvModTools(serverId)`
   → `loadSrvModTools` invoked twice per tab switch.

**Action:** remove duplicate div; move Mod Tools button inside the tab-row; collapse the
double call to one.

### 5.5 Clean (verified, no action needed)

- All inline handlers in `dashboard.js` and `index.html` map to defined functions (except `toggleCompact`).
- All 59 Express API routes are wired with `requireAuth`.
- No duplicate `id=` in `index.html`.
- No undefined CSS variables.
- `--bg-card` now defined (previous fix), dark-mode contrast vars already bumped.

## 6. Implementation plan (follow-up pass, not yet run)

1. Remove duplicate function block (lines 344–348) after byte-verify.
2. Delete fully-orphaned dead functions (§5.2).
3. Implement `toggleCompact()` (§5.3).
4. Fix structural bugs (§5.4).
5. Re-run audit scripts → expect **zero** findings for duplicates/dead code/undefined handlers.
6. `node -c` syntax check on every touched file.
7. Spawn `code-reviewer-deepseek-flash` for review; address feedback.
8. **Do NOT commit or push** (user decision).

## 7. Constraints & guardrails

- Only delete code that the automated scans prove orphaned (occurrence count == definition count).
- No new frameworks, no build steps — stay vanilla JS/innerHTML, matching existing style.
- Reuse existing `requireAuth` middleware and `global.broadcastDashboard()` for any new routes.
- Do not rename or restructure existing panel/type data — UI/lifecycle only.
- Report any destructive operation (file overwrite, schema change) before running it.
- WIP ticket files are in-scope; audit and fix them fully, but preserve their feature intent.

## 8. Open questions (resolved → see §2)

- Spec file location: repo root (default, user was unsure).
- Contrast theme priority: both dark and light equally.
- Git: no push — leave changes working-tree only.

---

## Appendix: audit scripts

Reusable scripts were written to `/tmp/audit1.js` … `/tmp/audit5.js` during the audit.
Re-run them after fixes to confirm a clean bill of health:
- `audit1.js` — dashboard.js inline handlers vs definitions
- `audit2.js` — dead-function scan
- `audit3.js` — Express route inventory
- `audit4.js` — dead/duplicate scan incl. index.html + login.html
- `audit5.js` — index.html handlers vs definitions + duplicate ids

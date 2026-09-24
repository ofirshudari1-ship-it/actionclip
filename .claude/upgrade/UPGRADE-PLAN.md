# TapAct Settings Window — Upgrade Plan

Scope: `desktop-agent/src/settings/{settings.html,settings.js,settings.css,preload.js}`
plus one narrowly-justified exception: the Settings `BrowserWindow` dimensions in
`desktop-agent/src/main.js` (not business logic — it's the window chrome for the
same screen this upgrade targets, and it is the literal cause of the user's "too
small" complaint; no other line in main.js was touched).

User complaint (verbatim, Hebrew): "מסך ההגדרות קטן מידי ולא מותאם לא נוח
לשימוש לא מובן מה לעשות ואיך לעשות" — window too small, not responsive, not
comfortable to use, unclear what/how to do things.

## Root cause (S0 finding)

`main.js` created the Settings `BrowserWindow` at **720×760, min 640×600**.
With a fixed 220px sidebar, that left ~460px of usable content width for a
layout that includes 3-column preference grids and (as of the previous round)
an inlined clipboard-history list with a search bar, filter chips, and a
scrollable item list. Every panel was fighting for space in a window sized
for a much simpler settings screen than the one that now exists.

## Sprints

### S1 — Window sizing + responsive layout (contract: window ≥ 1000px wide by
default, sidebar scales instead of fixed-width, content column doesn't
stretch unreadably wide, switching tabs doesn't leave stale scroll position)
- `main.js`: Settings window 720×760 (min 640×600) → **1040×780 (min 860×620)**.
- `settings.css`: sidebar column `clamp(200px, 20vw, 260px)` instead of fixed
  `220px`; `.tab-panel` capped to `max-width: 760px` (900px for the
  clipboard-history tab, which is a scannable list, not a form) so content
  doesn't stretch edge-to-edge at the new width; clipboard-history panel
  height raised from `min(58vh,620px)` to `min(60vh,680px)`.
- `settings.js`: reset `.content` scroll position on every tab switch (all
  tabs share one scroll container; without this a new tab could open
  mid-scroll from the previous tab's position — part of what read as
  "confusing").
- Status: **done**, verified via offscreen-render screenshots (before/after),
  124/124 tests pass.

### S2 — Display density option (contract: a density toggle exists in
Settings ▸ מראה ושפה, switching it visibly tightens spacing on list-heavy
tabs without shrinking tap targets, persists across window reopen)
- Inspired by the actionclip.app research (competitor's density/theme
  options) — TapAct's own tabs are list-heavy (templates, tags, custom
  rules, clipboard/lead history), so a density option pays for itself here
  even without the rest of that competitor's feature set.
- `settings.html`: new `#densitySeg` segmented control next to the existing
  language/theme ones. Hebrew copy ("צפיפות תצוגה" / "נוח" / "קומפקטי")
  produced via the `hebrew-copywriting` skill, not hand-written.
- `settings.js`: `applyAppDensity()` + localStorage read/write (a per-machine
  display preference, kept out of the `settings:save-settings` IPC path/
  store.js schema on purpose — no main-process change needed).
- `settings.css`: `[data-density="compact"]` tightens panel/list/card padding
  on list-heavy tabs.
- Status: **done**, verified via screenshot (compact density, tags tab).

### S3 — Per-action grouping, drag-reorder, pin-to-top (deferred, `[needs-human]`)
The actionclip.app-inspired per-action enable/disable + drag-to-reorder +
"pin frequent actions" + clearer category grouping was explicitly requested
as UX inspiration. **Not implemented in this round** — it would mean new
data model concepts (ordering/pinning state per detector or per custom
rule) that reach past pure UI/layout into what the Settings ▸ סוגי זיהוי /
כללים מותאמים אישית tabs actually persist, which is outside "don't touch
business logic" for a single sprint at this size. Flagged as the top
recommended next step below, scoped as its own future sprint with its own
contract once someone confirms the data-model change is wanted.

### S4 — Build, version bump, release
- Bump `desktop-agent/package.json` version (real UX rebuild, not a patch).
- `npm test` (124/124) before build.
- `npm run dist` (NSIS installer) — **not executed on this machine** per the
  hard rule against running the built .exe; build itself (electron-builder)
  does not launch the app, only packages it, so `npm run dist` is safe to
  run, but see `[needs-human]` in the report for what's outstanding here.

## Verification method

Real Electron `BrowserWindow` with `offscreen: true`, loading the actual
`settings.html`/`settings.js`/`preload.js` against the actual
`src/lib/store.js` (electron-store backed, isolated temp `userData` dir) with
seeded sample data (templates, clipboard history, tag rules). Captured with
`webContents.capturePage()` → PNG. A second run point the same script at the
pre-upgrade files extracted via `git show master:...` to render an honest
"before" at the old 720×760 size, using the same store/data. No installer
`.exe` was built-and-run for this; screenshots are the evidence.

Screenshots: `.claude/upgrade/screenshots/before/` and `/after/`.

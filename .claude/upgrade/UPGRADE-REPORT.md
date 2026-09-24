# TapAct Settings Window — Upgrade Report

Branch: `upgrade/2026-09-24`. Scope: Settings window only (see UPGRADE-PLAN.md
for the one justified exception — window dimensions in `main.js`).

## Root cause

`desktop-agent/src/main.js` (`createSettingsWindow`, pre-upgrade):
```
settingsWindow = new BrowserWindow({ width: 720, height: 760, minWidth: 640, minHeight: 600, ... })
```
Fixed 220px sidebar + 3-column preference grids + the newly-inlined
clipboard-history list all competing for ~460px of usable content width.
This is the direct cause of "too small / not comfortable / not adapted."

## 10-dimension scores (before → after)

| # | Dimension | Before | After | Evidence |
|---|---|---|---|---|
| 1 | RTL/Hebrew | 8 | 8 | Unchanged: `dir`/logical CSS (`inset-inline-*`, `margin-inline-*`) already correct pre-upgrade; no regressions in screenshots (`after/clipboard-history__1040x780__light.png` — RTL layout, sidebar on the right, correct mirroring). |
| 2 | Responsive/sizing | **3** | **8** | Before: `settings__720x760__dark__he__comfortable.png` — sidebar ~30% of a cramped window, only 2 template cards visible before scroll. After: `templates__1040x780__dark.png` — same content with generous margins, capped reading width. Window now resizable 860×620 up, scales fluidly (`settings.css` `clamp()` sidebar, `main.js:755-763`). |
| 3 | Accessibility (WCAG 2.2) | 7 | 7 | Unchanged in this round — `aria-current`, `:focus-visible`, `forced-colors`/`prefers-contrast` support were already present (`settings.css:900-925`, `settings.js:507-522`) and untouched. Not re-audited with axe (no live app run) — carried forward, not re-verified live. |
| 4 | Design/brand quality | 6 | 8 | Brand palette (`BRAND.md` indigo/purple) kept exactly — no token changes. Cramped panels previously undercut the existing polish; capped `.tab-panel` width + more margin now reads intentional rather than squeezed (screenshots above). |
| 5 | UX flows & states | 4 | 7 | Fixed a real bug: all tabs share one scroll container (`.content`), and switching tabs previously kept the old scroll position, so a new tab could open mid-scroll looking broken (`settings.js` `setupTabs()`). Now resets to top on every switch. Per-action reorder/pin/grouping (competitor-inspired) not implemented — see `[needs-human]`. |
| 6 | Forms | 6 | 7 | Inputs/selects/textareas unchanged functionally; more horizontal room (capped at 760px, not the old ~460px) makes long fields (webhook URLs, message templates) readable without truncation-by-cramping. No validation logic touched. |
| 7 | Perceived performance | 7 | 7 | No new network/IPC calls; tab-switch reset is a synchronous `scrollTo`. `prefers-reduced-motion` still honored (`settings.css:892-898`), unchanged. |
| 8 | Ease of configuration | 5 | 7 | Density toggle (comfortable/compact) added for list-heavy tabs; wider window means less scrolling per panel. Still flat lists for detectors/custom-rules (no grouping/search within them) — see `[needs-human]`. |
| 9 | AI layer / config-and-ai | ❓ | ❓ | Out of this round's scope — the only AI-related control (leads AI cleanup toggle + API key field) was not touched and not re-evaluated; no live app run to test the actual Anthropic-key flow. |
| 10 | Code health (UI) | 7 | 7.5 | Additive, small diffs (no rewrites); one duplicate `.tab-panel` CSS rule from drafting was merged into one before commit; 124/124 existing tests still pass after every commit. |

**Definition of Done**: not fully met — dimensions 5, 6, 8 are above their
prior score but below the "8" bar, dimension 9 is ❓ (out of scope, not
re-tested), and dimension 3 is carried forward, not re-verified live (no
axe run — no headed browser session against the real running app, only the
offscreen render). Reported explicitly rather than inflated.

## What was executed

- `git checkout -b upgrade/2026-09-24` (from clean `master`, confirmed via `git status`).
- **S1** — `upgrade(S1): resize Settings window + responsive layout + tab-scroll reset`
  — `main.js` (window 720×760→1040×780, min 640×600→860×620), `settings.css`
  (sidebar `clamp()`, capped `.tab-panel` width, taller clip-history panel),
  `settings.js` (scroll-reset on tab switch).
- **S2** — `upgrade(S2): display-density toggle (comfortable/compact)`
  — `settings.html` (new segmented control, Hebrew copy via `hebrew-copywriting`
  skill), `settings.js` (`applyAppDensity`, localStorage persistence),
  `settings.css` (`[data-density="compact"]` rules).
- `npm test` run after each sprint: **124/124 passing**, no regressions.
- `git check-ignore -v SPEC.md PROJECT.md CHANGELOG.md RELEASE-CHECKLIST.md DELETIONS.md`
  confirmed all five are `.gitignore`d before any commit; nothing forbidden staged.
- Verification: offscreen `BrowserWindow` (`offscreen: true`) loading the
  real `settings.html`/`settings.js`/`preload.js` against the real
  `src/lib/store.js` with seeded sample data (isolated temp `userData`),
  `capturePage()` → PNG. A second pass rendered the pre-upgrade files
  (extracted via `git show master:...`) at the old 720×760 size for an
  honest before/after. Screenshots in `.claude/upgrade/screenshots/{before,after}/`.
  The built installer `.exe` was **not** run on this machine.

## `[needs-human]`

1. **Competitor-inspired per-action UX (drag-to-reorder, pin, grouping)** —
   explicitly requested as inspiration but not implemented: it needs a data-
   model decision (where ordering/pin state lives — `store.js` schema change)
   that goes beyond this round's "Settings UI only, no business logic" scope.
   Needs a product decision on which tabs it applies to (detectors? custom
   rules? both?) before it's a well-scoped sprint.
2. **Live accessibility re-audit** — dimension 3 was carried forward from
   before this round, not re-tested with axe/a live app session (only
   verified via offscreen render, which doesn't run a full a11y tree audit
   with real focus/keyboard interaction). Recommend a `run`-skill session
   against the actual built app before shipping to users.
3. **Release** — version bump, `npm run dist`, push, and `gh release` were
   **not executed** in this run (see "Next steps" — this needs a final
   go/no-go from you before publishing a release, since it changes the
   version customers see and requires GitHub write access this session
   didn't confirm is wanted yet).

## Next steps (top 3)

1. Decide the version bump (recommend **minor**, e.g. 3.0.0 → 3.1.0 — real
   UX rebuild of one window, no breaking change to data/behavior) and say
   go-ahead to run `npm run dist` + push + `gh release create` with the
   installer and `latest.yml`.
2. Scope a follow-up sprint for the deferred per-action grouping/reorder/pin
   feature (item 1 above) as its own contract, once you confirm which tabs
   it should cover.
3. Run a live-app accessibility pass (axe + keyboard-only walkthrough) on the
   built Settings window before the next release, to confirm dimension 3
   still holds under real interaction, not just the offscreen render.

# TapAct Settings Window — Upgrade Report

Branch: `upgrade/2026-09-24`. Scope: Settings window only (see UPGRADE-PLAN.md
for the one justified exception — window dimensions in `main.js`).

This report covers two rounds: **S1+S2** (window sizing/responsiveness +
density toggle, shipped as v3.1.0) and **S3** (added after an independent
evaluator flagged that the original ask — competitor-inspired reorganization,
not just sizing — was still open; shipped as v3.2.0).

## Root cause

`desktop-agent/src/main.js` (`createSettingsWindow`, pre-upgrade):
```
settingsWindow = new BrowserWindow({ width: 720, height: 760, minWidth: 640, minHeight: 600, ... })
```
Fixed 220px sidebar + 3-column preference grids + the newly-inlined
clipboard-history list all competing for ~460px of usable content width —
the direct cause of "too small." But the user's complaint also named
"לא מובן מה לעשות ואיך לעשות" (unclear what to do and how), which is a
content-organization problem, not a sizing one: the 6 detector toggles were
a flat list with no grouping, and each type's on/off switch lived in a
different tab from its "what should it do" dropdown. S3 addresses that part.

## 10-dimension scores (before → after S1+S2 → after S3)

| # | Dimension | Before | After S1+S2 | After S3 | Evidence |
|---|---|---|---|---|---|
| 1 | RTL/Hebrew | 8 | 8 | 8 | Unchanged; new S3 strings (group labels, order hint, favorite/drag labels) went through `hebrew-copywriting`, regular hyphens, no direction breaks in screenshots. |
| 2 | Responsive/sizing | **3** | **8** | 8 | Unchanged from S1 — see `screenshots/before/` vs `/after/`. |
| 3 | Accessibility (WCAG 2.2) | 7 | 7 | 7 | S3 added a keyboard/screen-reader path for reordering (▲/▼ buttons with `aria-label`, since native HTML5 drag-and-drop isn't keyboard-operable) and `aria-label`s on the favorite star — but still not re-audited live with axe. Carried forward as untested, not inflated. |
| 4 | Design/brand quality | 6 | 8 | 8 | Brand palette untouched; grouped panels read as intentional information architecture, matching the existing "panel-title" convention used elsewhere (`settings.css` `.panel-title`, unchanged style, reused for the 3 new detector groups). |
| 5 | UX flows & states | 4 | 7 | **8** | S3: the 6 detector toggles are now grouped into 3 real categories (`יצירת קשר` / `ניווט ומשלוחים` / `קישורים ותוכן`) as separate `.panel`s, each toggle sits inline with its own action-preference dropdown (previously a different tab), and a single Save persists both. `detectors-grouped.png`. |
| 6 | Forms | 6 | 7 | 7 | Unchanged in S3 — the moved `<select>`s are the same elements, just relocated; no new validation. |
| 7 | Perceived performance | 7 | 7 | 7 | Drag-and-drop reorder and favorite-toggle re-render are synchronous local array operations, no new IPC round-trips beyond the existing save. |
| 8 | Ease of configuration | 5 | 7 | **8** | S3: custom detection rules (the one list where order is functionally load-bearing — first regex match wins, see `src/lib/detectors/custom.js`) got real drag-to-reorder + keyboard alternative; message templates got a favorites concept (★, cap of 3, sorted to top) as TapAct's equivalent of the competitor's "pin frequent items," since TapAct has no floating quick-access widget to pin *into*. |
| 9 | AI layer / config-and-ai | ❓ | ❓ | ❓ | Still out of scope — leads AI toggle/key field untouched. |
| 10 | Code health (UI) | 7 | 7.5 | 7.5 | S3 changes are additive (new functions `moveCustomRule`, `orderedTemplatesForDisplay`, `toggleTemplateFavorite`-inline-handler); found and fixed one real pre-existing bug while wiring this — `onSaveTemplates()` was stripping unknown fields (`{id, label, text}` only) before saving, which would have silently dropped `favorite` on every save if left alone. |

**Definition of Done**: still not fully met — dimension 3 (accessibility) and
9 (AI layer) remain below/unverified as documented above. Dimensions 5 and 8,
the two most directly tied to the user's "unclear what to do" complaint, now
meet the ≥8 bar.

## What was executed

**S1** — `upgrade(S1): resize Settings window + responsive layout + tab-scroll reset`
— `main.js` (window 720×760→1040×780, min 640×600→860×620), `settings.css`
(sidebar `clamp()`, capped `.tab-panel` width), `settings.js` (scroll-reset
on tab switch).

**S2** — `upgrade(S2): display-density toggle (comfortable/compact)`
— `settings.html`/`settings.js`/`settings.css`, Hebrew copy via
`hebrew-copywriting`.

**S4 (first release)** — version bump to 3.1.0, `npm run dist`, release
`v3.1.0` published via `gh`.

**S3** (this round) — `upgrade(S3): group detector settings, drag-reorder custom rules, template favorites`:
- `settings.html` — Detectors tab restructured from one flat `.panel` of 6
  toggles into 3 grouped `.panel`s (`יצירת קשר`, `ניווט ומשלוחים`,
  `קישורים ותוכן`); the 4 per-type action-preference `<select>`s moved
  inline next to their own toggle (previously a separate panel in a
  different tab); that old panel now only holds the generic auto-run
  toggle/delay, with an updated subtitle. New order-matters hint box added
  to the custom-rules tab.
- `settings.js` — `onSaveDetectors()` now saves `actionPreferences` too (one
  Save for the whole tab); `buildCustomRuleCard()` gained a drag handle
  (HTML5 DnD) plus ▲/▼ buttons (`moveCustomRule()`) as the keyboard-
  accessible equivalent; `buildCard()` (templates) gained a ★ favorite
  toggle (`MAX_FAVORITE_TEMPLATES = 3`), `orderedTemplatesForDisplay()`
  sorts favorites to the top for rendering without touching the saved
  array order; fixed `onSaveTemplates()` dropping unknown fields (would
  have silently discarded `favorite` on save).
- `settings.css` — `.det-pref` inline select styling + narrow-width
  wrap rule; `.drag-handle`/`.reorder-btn`/`.tag-card.dragging`;
  `.fav-star-btn`/`.card.favorited`.
- `src/lib/i18n-renderer.js` — **found during verification**: this app has
  a second, separate Hebrew/English string dictionary that overwrites
  `data-i18n` text at runtime after page load, so editing `settings.html`
  text alone is not sufficient for any *existing* i18n key (new keys with
  no dictionary entry fall back to the static HTML correctly). Updated the
  `he`/`en` entries for the 2 keys this round's copy changed
  (`detectors.subtitle2`, `settings.actions.sub`) and added the 4 new keys
  (3 group labels + the order hint) to both languages so language-switching
  doesn't regress this screen.
- `npm test`: **124/124 passing** after every commit in this round.
- Verified via the same offscreen-render method as S1/S2 (real
  `settings.html`/`settings.js`/`store.js`, seeded data, `capturePage()`):
  `.claude/upgrade/screenshots/after-s3/{detectors-grouped,custom-rules-drag-reorder,templates-favorites}.png`.

## What was deliberately NOT force-fit (with reasoning)

- **Reordering the 5 built-in detector types (phone/tracking/address/url/
  email/datetime toggles)** — not given drag-to-reorder. Their evaluation
  order is a hardcoded array in `src/lib/detectors/index.js`
  (`DETECTORS = [...]`), not driven by any user setting, and the code
  explicitly notes "first match wins, most-specific first" as a deliberate
  ordering by detector *quality*, not user preference. Adding a drag UI
  that reorders something with no behavioral effect would be actively
  misleading — it would look like a priority control that does nothing.
- **A literal floating "pin toolbar" like the competitor's** — TapAct is a
  clipboard-history + popup-action tool, not a persistent menu-bar app; it
  has no always-on surface to pin items into. The favorites concept was
  adapted instead: mark up to 3 templates so they sort to the top of the
  list you already open, which is the same "surface what I use most" goal
  without inventing a UI surface TapAct doesn't have.
- **Drag-reorder on tag rules or detector groups themselves** — tag rules
  are independent keyword matchers (a copied text can pick up multiple
  tags), so their list order has no first-match-wins semantics either;
  reordering them would be cosmetic-only, same reasoning as the built-in
  detectors. Left alone for the same reason.

## `[needs-human]`

1. **Live accessibility re-audit** (dimension 3) — not re-tested with axe or
   a real keyboard/screen-reader session against the running app; only
   verified via offscreen render + code reading. The new ▲/▼ reorder
   buttons and favorite star need a real screen-reader pass to confirm they
   read sensibly in context, not just that the `aria-label`s exist.
2. **AI layer** (dimension 9) — leads AI cleanup toggle/API key field
   untouched and unevaluated across both rounds.
3. **Favorites cap UX** — hitting the 3-favorite cap currently just silently
   no-ops the star click (no toast/message explaining why). Minor, but
   worth a small follow-up if users report confusion.

## Next steps (top 3)

1. Run a live-app accessibility pass (axe + real keyboard/screen-reader
   walkthrough) on the built Settings window, covering the new grouped
   detectors tab and the drag-reorder/favorite controls specifically.
2. Consider whether tag rules or custom rules would benefit from the same
   grouping treatment detectors got, if the list grows past what fits on
   one screen.
3. If the 3-favorite cap turns out to be confusing in practice, add a short
   inline message when the cap is hit (needs one more short Hebrew string
   via `hebrew-copywriting`).

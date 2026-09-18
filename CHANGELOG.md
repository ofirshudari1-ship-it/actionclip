# Changelog

## 2.5.6 (desktop agent) - 2026-09-18 — Real automatic updates via electron-updater

The desktop agent now checks GitHub Releases for a newer build and updates
itself — no more manually re-downloading the installer for routine updates:

- **electron-updater wired in.** `desktop-agent/src/main.js` calls
  `autoUpdater.checkForUpdatesAndNotify()` a few seconds after the tray/
  clipboard watcher start up (non-blocking, background). The
  `build.publish` config in `desktop-agent/package.json` points at the
  public `ofirshudari1-ship-it/actionclip` GitHub repo, which is where
  electron-builder now also uploads `latest.yml` alongside each release
  build — that file is what electron-updater reads to know a newer
  version exists.
- **`artifactName` fixed** to `ActionClip-Setup-${version}.exe` (it was
  previously a fixed `ActionClip-Setup.exe` with no version token, which
  didn't match `build.ps1`'s expectation and would have collided across
  releases).
- **Download happens automatically**, and when it finishes a native
  "Restart Now / Later" dialog offers to install immediately; if the user
  picks Later, the update installs automatically on the next normal quit
  (`autoInstallOnAppQuit`).
- **Fails quietly.** No internet connection, GitHub unreachable, or any
  other update error is logged to the existing `actionclip.log` file and
  otherwise ignored — it never blocks startup or crashes the tray app.
- Dev/unpackaged runs (`app.isPackaged === false`) skip the update check
  entirely.
- No other app behavior touched — single-instance lock, tray, and
  clipboard-watcher startup are unchanged.

## 2.5.3 (desktop agent) - 2026-09-17 — Welcome/finish pages actually render + brand-colored primary button

Installer-only pass, no app code touched. Found a real, pre-existing bug
while implementing this: `build-resources/installer.nsh`'s `customWelcomePage`
and `customFinishPage` macros defined `MUI_WELCOMEPAGE_TITLE`/`TEXT` and
`MUI_FINISHPAGE_TITLE`/`TEXT` (plus the "launch on finish" checkbox) but
never called `!insertmacro MUI_PAGE_WELCOME` / `MUI_PAGE_FINISH` — Modern UI
2 only inserts those pages when the macro explicitly does that insert, so
despite the bilingual `LangString` copy already being written, **no welcome
page and no finish page ever actually appeared** in the installer. Fixed by
adding the missing `!insertmacro` calls. Also enriched `WelcomeText` (EN+HE)
to actually explain what ActionClip does (phone→WhatsApp, tracking→carrier
page, address→Maps/Waze, link→open, plus the local clipboard-history
feature) instead of the previous generic "this wizard will guide you"
framing.

Added brand-colored primary button: NSIS/Modern UI 2 has no supported way
to reshape or recolor a standard Next/Back/Cancel button (Windows'
uxtheme draws them). Real, working technique used: disable visual-style
theming on the Next/Install/Finish button handle specifically
(`uxtheme::SetWindowTheme` via NSIS's bundled `System` plugin), which lets
the native `SetCtlColors` instruction actually take effect. The primary
button loses the native rounded Windows 11 chrome and renders flat/classic
in the brand indigo — a real, visible change, not a shaped custom bitmap
button; Back/Cancel stay native. Color audited against WCAG AA: raw brand
indigo `#6366f1` vs. white text is 4.47:1 (just under the 4.5:1 AA floor
for normal-size text); darkened ~10% to `#595cd9` clears it at 5.31:1.

Confirmed unchanged: installer sidebar/header branding, bilingual language
picker, `customInit`/`customInstall`/`customUnInstall` registry+firewall
logic, and electron-builder's built-in `CHECK_APP_RUNNING` guard.

## 2.5.2 (desktop agent) - 2026-09-17 — Installer header banner added

Visual-only polish pass on the NSIS installer, no app code touched. The
welcome/finish sidebar (`build-resources/installer-sidebar.bmp`) was already
branded with the real indigo→violet gradient (`#6366f1` → `#a855f7`, per
`assets/BRAND.md`), but the assisted-installer pages that follow (License,
Install Location, Installing, Finish) had no `installerHeader` configured,
so they fell back to NSIS's generic default banner instead of matching the
sidebar. Added `build-resources/generate-installer-header.cjs` (mirrors
Playnest's `build/make-installer-graphics.cjs` approach: rasterize an SVG
with `sharp`, hand-write a 24-bit BMP since `sharp` can't emit BMP) to
produce a 150×57 white banner with the real `assets/logo.png` mark +
"ActionClip" wordmark, and wired it in as `nsis.installerHeader` in
`package.json`. New npm script: `npm run icons` regenerates it. Confirmed
unchanged: bilingual language picker (English default), install-location
handling, shortcut creation, uninstaller, and the update-detection flow in
`build-resources/installer.nsh` (electron-builder's built-in
`CHECK_APP_RUNNING` still handles the running-instance guard — untouched).

## 2.5.0 (desktop agent) / 1.2.1 (Chrome extension) - 2026-09-15 — Product-improvement pass: custom rules, international phone support, tray quick-actions

Requested as a focused product-improvement pass (competitor research + UI
polish + one conservative automation idea + a bug/performance sweep), not
another compliance audit. Chrome extension unchanged this round (still
1.2.1) — every change below is in the desktop agent.

### Competitor research (brief)
Looked at what Ditto, ClipboardFusion, PhraseExpress and Raycast's
clipboard history do well in 2026: Ditto focuses on deep clipboard-history
customization; **ClipboardFusion's standout feature is user-defined
clipboard "Macros"** (pattern-matched text → a custom action), which
ActionClip had no equivalent of — it only ships 5 fixed detectors
(phone/tracking/address/url/email) with no way for a call-center admin to
add their own (e.g. an internal order-number format → their CRM's lookup
URL); PhraseExpress centers on text-expansion/snippets (out of scope — a
different product category from a clipboard-action-popup tool);
Raycast's clipboard history supports per-app exclusion and configurable
retention, both of which ActionClip already had (the sensitive-clipboard-
format exclusion and `historyStorageLimit`/`historyPreviewLimit`, see
2.1.0/1.4.0). Net finding: ActionClip's history/tagging/shortcuts/
multi-monitor-popup feature set is already close to parity with these
tools for its niche — the one clear, product-fitting gap was custom
pattern-based rules, which is what this release adds.

### Added
- **Custom action rules** (Settings ▸ "כללים מותאמים אישית", new
  `src/lib/detectors/custom.js`): define your own regex pattern → URL
  template rules, beyond the 5 built-in detectors — e.g. an internal order
  number format (`ORD-(\d{6})`) opening `https://crm.example.com/orders/{value}`.
  Checked *after* all built-in detectors (a mature, specific detector
  always wins over a user-authored regex that might be looser). Security:
  only `http://`/`https://` URL templates are honored — a `javascript:`/
  `file:`/`data:` template is rejected before it could ever reach
  `shell.openExternal`; invalid regex syntax is caught and the rule is
  skipped rather than throwing inside the clipboard-poll loop. New store
  key `customActionRules` (same validate-on-save pattern as the existing
  auto-tag rules), capped at 30 rules. New IPC:
  `settings:get-custom-rules`/`settings:save-custom-rules`.
- **International phone-number fallback** (`src/lib/phone.js`,
  `normalizeInternationalPhone`/`formatInternationalDisplay`): a copied
  number with an explicit `+countrycode` prefix that isn't Israeli now
  still opens a WhatsApp composer, instead of being silently ignored the
  way every non-Israeli number was before. Deliberately conservative: it
  only fires for an explicit `+` prefix (a bare local-format number stays
  Israeli-only, since without a country code there's no safe way to tell
  it apart from Israeli local formats — guessing would just add false
  positives) and never changes anything about how an Israeli number is
  detected, normalized, or displayed. `findPhone()` still tries the
  Israeli path first on every candidate before falling back to this, so
  existing behavior is 100% unchanged when an Israeli number is present.
- **Tray "Recent actions" quick-repeat submenu** (Raycast/ClipboardFusion-
  style speed): the tray's right-click menu now has a submenu listing the
  last 5 clipboard copies that had a detected action, each one-click to
  re-fire its primary action directly — no need to reopen the full
  history panel. Rebuilt only when a new actionable copy is logged (not on
  every clipboard tick), so this adds no measurable overhead to the
  existing poll loop. New `store.getRecentActionableHistory()`.
- `⚡` category icon + filter chip for `custom`-type detections in the
  clipboard-history panel (`clipboard-history.js`/`.html`).
- i18n keys (`nav.custom-rules`, `custom-rules.*`) in
  `src/lib/i18n-renderer.js` for both `he`/`en`.
- Settings UI polish pass (`settings.css`): hover/border affordance on the
  now-more-list-heavy custom-tags/custom-rules cards, a subtle icon-scale
  hover on sidebar nav items, and a `prefers-reduced-motion` media query
  (nothing in this file previously respected the OS-level "reduce motion"
  accessibility setting). Deliberately light-touch, additive only — no
  color/layout changes to already-shipped, daily-used UI; brand palette
  (indigo→violet, `#6366f1`/`#a855f7`) untouched.

### Notes on scope
- The task brief referenced a teal (`#21b0a6`/`#0a4440`) brand palette for
  ActionClip specifically — checked every CSS/HTML file in this project
  (desktop-agent windows, `site/index.html`) and found no trace of that
  palette anywhere; ActionClip's actual, consistently-used brand since the
  2.0.0 rebrand is indigo→violet (`#6366f1 → #a855f7`, documented in that
  changelog entry). That teal color belongs to a different project in this
  workspace (digi-transform.com). Kept the real existing palette
  unchanged rather than introducing a color that was never part of this
  product, per "keep the existing brand palette" taking priority over a
  specific hex value that doesn't match this codebase.
- Reviewed the clipboard-detection (`checkClipboard`) and WhatsApp-launch
  (`buildWhatsAppUrl`/`shell.openExternal`) paths for the requested
  performance/bug sweep: found no correctness bugs beyond the international-
  phone gap above. The existing `clipboardCheckInFlight` guard, dedupe
  maps, and async `clipboard.readText()` handling (fixed in 1.4.1) are all
  still correct and weren't touched.
- Considered but deliberately skipped: cloud/AI-based detection (the task
  brief itself asks to stay conservative here — this app's value
  proposition is "fast, predictable, local", and there was no clear,
  well-justified opt-in case for adding one now), and pinning individual
  clipboard-history items (a genuine Raycast feature, but overlaps enough
  with the existing message-template system that it didn't clear the bar
  for "aim for 2-4 additions" in this pass).

### Verification
`node --check` on every changed/new file. `npm test`: 88 tests passing
(the existing 64 plus 24 new — international-phone normalization/display/
`findPhone` fallback-priority cases, and custom-rule matching/validation/
security cases including invalid-regex and unsafe-URL-template rejection).
`npm run dist` rebuilt the installer clean; see the build/test results
recorded when this version shipped for the exact confirmation. **Not
verified with a real GUI click-through** (no Windows desktop session
available here) — the new Settings ▸ "כללים מותאמים אישית" tab, the tray
submenu rendering, and the CSS hover/reduced-motion changes are confirmed
correct by code review and the automated tests above, not by eyes on the
actual rendered UI. Recommend a quick manual pass: add a custom rule, copy
matching text, confirm the popup opens the right URL; copy a `+`-prefixed
non-Israeli number and confirm WhatsApp opens; right-click the tray icon
after a detected copy and confirm "פעולות אחרונות" lists it.

---

## 2.4.4 (desktop agent) / 1.2.1 (Chrome extension) - 2026-09-15 — Full STANDARDS.md compliance sweep

### Added
- `chrome-extension/ActionClip-v1.2.1.zip` — a single packaged ZIP (no
  README/dev files inside, only manifest+icons+src) per §1/§8, as an
  alternative to loading the raw folder; `chrome-extension/README.md`
  updated to mention it
- `PRIVACY.md` (root, bilingual) — documents that neither component sends
  data anywhere (no backend, no analytics, no AI/cloud calls), what is
  stored locally and where, and the Chrome extension permission
  justifications, per STANDARDS.md §11.10/§17.1
- `site/index.html`: new FAQ section ("האם המידע שלי נשלח לענן?" / admin
  rights / where templates+history live / what closing the window does)
  and a Privacy link in the footer, per §17.1 items 5+7
- `PRIVACY.md` linked from the doc map in `README.md`

### Fixed
- `site/index.html` language toggle was cosmetic only — it flipped
  `dir`/`lang` on `<html>` but every visible string (hero, steps,
  detectors, components, features, changelog, install, FAQ, footer)
  stayed Hebrew-only, flagged as an explicit out-of-scope gap by the
  previous STANDARDS.md §17 audit pass. Rebuilt as a real bilingual page:
  the full page content is now duplicated in `.lang-en` (default) and
  `.lang-he` blocks, toggled via `data-lang` on `<html>` and a JS
  `setSiteLang()` helper (persisted in `localStorage`), same pattern
  already used by OptiGuard's and Playnest's `site/` landing pages.
  English is the default per §4/§17.0; switching to Hebrew now swaps
  every visible string and applies full RTL (logical CSS properties
  already in place handled the layout flip with no extra work).
- Project root cleaned per §1: removed 3 stale duplicate installers
  (`ActionClip-Setup-2.4.0/1/2.exe` + blockmaps) that a previous session
  had flagged in `DELETIONS.md` as "waiting for manual deletion" — no
  process was locking them this session, deleted for real. Removed an
  entire stray duplicate `ActionClip/ActionClip/` directory (old 2.4.0
  installer + blockmap + a second, divergent `README.md`) left over from
  an earlier reorganization. Removed matching stale build outputs
  (2.4.0/2.4.1/2.4.2 exe+blockmap) from `desktop-agent/dist/`. Root now
  contains exactly one installer (`ActionClip-Setup-2.4.4.exe`, matching
  `version.json`), no build-only files, no orphaned folders.
- `site/index.html` had two stale references that would have sent a user
  to a dead path: the desktop-agent card pointed at
  `ActionClip/ActionClip-Setup-1.4.1.exe` (wrong nested path, ~10 major
  versions out of date) and the install intro pointed at `INSTALL.md`
  (deleted and merged into `README.md` per `DELETIONS.md`, 2026-09-14).
  Both fixed; version badge synced 2.4.2 → 2.4.4.
- `README.md` header version line was stale at "2.4.0 / 1.2.0" (already
  two releases behind at the start of this pass) — synced to 2.4.4 / 1.2.1.

### Verified, no code change needed
- Installer language selector (§4/§7): `desktop-agent/package.json`
  `build.nsis` already has `displayLanguageSelector: true`,
  `installerLanguages: ["en_US", "he_IL"]`, `language: "1033"` (English
  default) — STANDARDS.md's status table was out of date on this point
  for ActionClip, code already matches the required pattern.
- Electron hardening (§11.4): all 5 `BrowserWindow`/`webPreferences`
  blocks in `desktop-agent/src/main.js` already set `contextIsolation:
  true`, `nodeIntegration: false`, `sandbox: true` together.
- Chrome extension icon spec (§15.4): `chrome-extension/icons/` already
  has exactly the 4 required PNG sizes (16/32/48/128), square, wired
  correctly (`action.default_icon`: 16+32, `icons`: 48+128).
- Chrome extension packaging (§8): MV3, no remote code, no `eval`,
  minimal permissions (`storage`, `clipboardRead`) both justified, CSP
  is `script-src 'self'; object-src 'self'`, zero outbound network calls
  except the user-initiated `wa.me` deep link.
- Chrome extension IPC/memory hygiene: the one `ipcRenderer.on` listener
  in `desktop-agent/src/clipboard-history/preload.js` already returns an
  unsubscribe function via `removeListener`.

---

## 2.4.3 (desktop agent) - 2026-09-14 — About screen, build date, §6 compliance

### Added
- About tab in Settings sidebar with logo, version, build date, changelog link, and website link per §6
- `buildDate` field exposed via `settings:get-data` IPC (read from `version.json`)
- `settings:open-external` IPC handler for opening changelog/site in system browser
- `openExternal` exposed via settings preload bridge
- i18n keys for About screen in `en.json` and `he.json`

### Changed
- Version bumped to 2.4.3; `buildDate` updated to 2026-09-14
- Version badge in `site/index.html` updated to v2.4.2

---

## 2.4.2 (desktop agent) - 2026-09-14 — STANDARDS.md second pass

### Added
- Skip button in welcome.html onboarding footer per §5
- © 2024–2026 footer in welcome.html per §5
- © notice in NSIS installer finish screen per §7
- Language toggle button in `site/index.html` header per §17

### Fixed
- welcome.html language fallback changed from `'he'` to `'en'` per §4
- Stale doc references in `site/index.html` footer fixed

---

## 2.4.1 (desktop agent) - 2026-09-14 — STANDARDS.md full compliance pass

### Added
- `USER-GUIDE.md` — full bilingual user guide (EN + HE) per §9
- `RELEASE-CHECKLIST.md` — pre-release verification checklist per §9
- `locales/en.json` + `locales/he.json` — 120-key i18n source files per §4
- File logging system in `main.js`: `%APPDATA%\ActionClip\logs\actionclip.log`, 5 MB rotation, INFO/WARN/ERROR levels per §2
- Windows Firewall inbound rule added by installer (and removed on uninstall) per §11.8
- Copyright notice in settings.html footer per §5

### Fixed
- Installer language selector: was hardcoded Hebrew, now defaults to English per §7
- `#phoneDisplay` in popup.html: added `dir="ltr"` to prevent RTL digit reversal per §11.6
- IPC listener memory leak in clipboard-history preload: `onItemsChanged` now returns cleanup function per §11.9
- `generate-icons.cjs` moved from root to `build/` per §1 directory structure
- Stale references to `docs/` and `INSTALL.md` in README.md removed

### Changed
- Default language in `store.js` changed from `'he'` to `'en'` per §7
- `CHANGELOG.md` restructured to Keep a Changelog format

---

### Historical context (installer language fix — also in this version)

Audit found `package.json`'s NSIS config explicitly disabled the language
selector and hardcoded Hebrew (`displayLanguageSelector: false, language:
"1037"`) — the installer had no way to show English at all, contradicting
the project-wide default-English rule.

- `desktop-agent/package.json` `build.nsis`: `displayLanguageSelector: true`,
  added `installerLanguages: ["en_US", "he_IL"]`, `language` changed from
  `"1037"` (Hebrew) to `"1033"` (English, the default/pre-selected choice).
- `build-resources/installer.nsh` was entirely hardcoded Hebrew too (welcome
  page, finish page, registry comments) — even with the selector fixed,
  these would have stayed Hebrew regardless of the chosen language. Rewrote
  every string through NSIS `LangString` (English + Hebrew pairs) so they
  now actually follow the selected installer language.
- Removed a redundant custom "app is running" check I initially added -
  turned out electron-builder's base template already calls
  `CHECK_APP_RUNNING` automatically for every NSIS installer (offers to
  close a running `ActionClip.exe` and retries), so this was already
  satisfied without any custom code.
- **Not verified with a real build** — this environment has no NSIS
  compiler / can't run a full `electron-builder dist` for Windows; changes
  were checked for valid JSON (`package.json`) and reviewed against
  electron-builder's own source (`node_modules/app-builder-lib`) to confirm
  the option names and LangString mechanism are real, not guessed. Please
  do one real `npm run dist` + install test before relying on this.

## 2.4.0 (desktop agent) - 2026-09-14

> **הערת שקיפות (נוספה 2026-09-14):** גרסאות 2.3.0 ו-2.4.0 שוחררו (יש קובץ
> התקנה בנוי לכל אחת) בלי שנרשמה עבורן רשומת CHANGELOG בזמן אמת. לא נמצא
> תיעוד אחר (README, SPEC, הודעות build) שמפרט מה השתנה ביניהן, ולכן לא
> ניתן לשחזר את התוכן המדויק כאן בלי להמציא אותו. אם אתם יודעים מה השתנה -
> כדאי להשלים את הרשומות האלה; מכאן והלאה מומלץ לתעד כל שחרור מיד.

## 2.3.0 (desktop agent) - 2026-09-14

> ראו הערת שקיפות למעלה - אין תיעוד זמין למה שהשתנה בגרסה הזו.

## 2.2.0 (desktop agent) - 2026-09-13 - UI/UX redesign: sidebar navigation, installer update detection

Settings window redesigned with a sidebar navigation (7 tabs → sidebar with
grouped nav items), richer card layouts, and improved visual hierarchy. NSIS
installer now detects existing installations via registry and logs an update
message. Folder cleanup: LeadClip Chrome Extension folder renamed to ACTIONCLIP.

- **Settings sidebar nav.** The old horizontal 7-tab row at the top is replaced
  by a grouped sidebar (כלי / מערכת / היסטוריה groups). Each nav item has an
  emoji icon and a name. Content area has proper page titles with icons and
  subtitle descriptions.
- **Improved panel design.** Panels have purple accent titles, detector items
  use a card layout with icon + label + description + toggle, preference selects
  are in a responsive grid, and hint/warning boxes have colored left-border
  accents.
- **Installer update detection.** Custom NSIS `installer.nsh` reads the registry
  for an existing ActionClip install and logs whether this is a fresh install or
  an in-place update.
- **Version bump** to 2.2.0 to reflect the UI changes.

## 2.1.0 (desktop agent) - 2026-09-13/14 - polish pass: single instance, real shortcuts, tags, email, onboarding, Program Files

A large batch requested in one go: fix the duplicate-instance bug, make
`Win+V` actually diagnosable instead of silently doing nothing,
configurable shortcuts, an email detector, keyword-based tags, unlimited-
but-bounded history with pagination, a first-run onboarding screen,
per-action default choices with an optional auto-run delay, install to
Program Files like other Windows software, and a less generic-looking
installer.

- **Fixed: duplicate running instances.** `app.requestSingleInstanceLock()`
  was never called (flagged as a known gap in 1.4.0's entry, now fixed) -
  a second launch used to start a whole second tray icon + clipboard-poll
  timer + shortcut registrations instead of doing nothing. Now a second
  launch attempt quits itself immediately and surfaces the *existing*
  instance's Settings window instead. Verified by launching the app twice
  in a row and confirming the second attempt logs nothing and adds exactly
  one process (the Settings window it opened on the first instance), not a
  second full instance.
- **`Win+V` diagnosability.** Registration status (`✓`/`✗` per shortcut) is
  now tracked and surfaced in the new Settings ▸ קיצורי מקלדת tab, and a
  tray menu item ("רענן קיצורי מקלדת") re-attempts the OS-level grab
  without restarting the app - useful because registration only happens
  once at startup, so turning off Windows' own Clipboard History *after*
  ActionClip is already running previously required a full restart to
  take effect, silently. If `Win+V` still shows "✗ תפוס" after turning off
  Windows' Clipboard History and refreshing, something else on the system
  (not Windows itself) holds it - `Ctrl+Alt+V` keeps working regardless.
- **Configurable keyboard shortcuts** (Settings ▸ קיצורי מקלדת): click a
  field, press the combo, save - re-registers live, no restart. Reset to
  defaults available.
- **Email detector**: a copied bare email address offers "open new mail"
  (`mailto:`) and "open in Gmail", same intent-guard as the URL detector
  (only fires when the copy is *just* the address).
- **Keyword-based auto-tags** (Settings ▸ תגיות אוטומטיות): define a tag
  label + keywords; any future copy containing a keyword gets that tag,
  shown as a chip in the history panel and matched by its search box.
  Doesn't retroactively tag existing history.
- **History storage redesign**: `historySize` (single 10-200 cap) split
  into `historyStorageLimit` (what's actually kept on disk - default 1000,
  configurable to 5000; a literal unlimited cap isn't safe for a
  JSON-file-backed store re-written on every change) and
  `historyPreviewLimit` (what the panel loads per page - default 50, a
  "טען עוד" button pages through the rest). Each item now shows its full
  date/time, not just relative ("לפני 3 דק'").
- **First-run onboarding** (`src/welcome/*`): a 4-step walkthrough with a
  skip button at every step, shown once automatically (tracked via
  `settings.welcomeSeen`) and reopenable anytime from the tray menu ("מה
  זה ActionClip?").
- **Per-action default + auto-run** (Settings ▸ הגדרות): for detectors
  with more than one action (address: Maps/Waze, tracking: carrier/
  17track, email: mailto/Gmail), pick which is primary; optionally have
  ActionClip run the primary action by itself after a configurable delay
  (default 4s, off by default) instead of waiting for a click - the popup
  still shows first, closing it cancels.
- **Install location**: NSIS `perMachine` true → installs to Program Files
  like other Windows software, instead of a per-user AppData folder. This
  means the installer now requests admin elevation (UAC) - expected and
  unavoidable for writing to Program Files, not a bug.
- **Installer visuals**: custom branded sidebar bitmap (indigo→violet
  gradient, the ActionClip mark) on the welcome/finish pages instead of
  NSIS's generic default graphic. Hand-built as a 24-bit BMP (sharp can
  encode many formats but not BMP) since NSIS requires that exact format;
  verified valid via Python/PIL round-trip (sharp itself can't decode BMP
  either, so it couldn't self-verify).

Verification: `node --check` on every changed/new file. Direct unit tests:
tag-rule keyword matching (hit/miss), history pagination (120 items,
50/100-item pages, correct `total`), the welcome-seen flag round-trip,
partial shortcut-settings merging (doesn't clobber other bindings), and
the action-preference reorder (`waze` preference correctly promotes it to
`actions[0]`, no preference leaves the detector's own order untouched).
Built the real installer and also deployed the unpacked build directly
(same reasoning as 1.4.1/2.0.0 - `perMachine: true` now requires an actual
UAC approval only the user can grant, so this round's functional testing
used a non-elevated deployment; the packaged `ActionClip-Setup-2.1.0.exe`
with the Program Files/admin flow itself still needs a real run-through
from the user). Confirmed for real on this machine: single-instance lock
(described above), a fresh email-address clipboard write correctly logged
and categorized `email` in the live `actionclip.json`, and settings
round-trips for both `actionPreferences` and `shortcuts` through the
actual store.

**Not covered by automation this round** (needs the user): actually
running the installer and approving the UAC elevation prompt, visually
confirming the onboarding screen's step flow and the new shortcuts-tab
capture UI, and the installer sidebar bitmap as NSIS itself renders it
(built and validated as a correct BMP file, but never watched inside the
actual installer window). The top-level project folder rename is still
blocked ("Permission denied" - something else has it open); rename it by
hand once nothing does.

Desktop agent package version: 2.0.0 → 2.1.0.

## 2.0.0 (desktop agent) - 2026-09-13 - renamed PingClip → ActionClip

**Full rebrand**, requested explicitly: the product outgrew the "PingClip"
name (born as a phone→WhatsApp tool for Passportugo) once it became a
general multi-detector clipboard-action engine with its own history
manager. Everything now reads **ActionClip**.

- **Every reference renamed** across code, docs, and the landing page:
  `package.json` (`name`, `productName`, `appId: com.actionclip.app`,
  `shortcutName`, installer artifact name), the `electron-store` file
  (settings/templates/both histories now live under `actionclip.json`
  instead of `pingclip-agent.json` - **existing local data does not
  migrate automatically**, a fresh install starts with empty history/
  default templates, same as any local-only app rename), tray tooltip/
  menu text, all four window titles, the Chrome extension's manifest and
  `chrome.storage` keys (`actionclip_templates` etc. - same non-migration
  caveat there), and every doc (`README.md`, `INSTALL.md`, `docs/SPEC.md`,
  `docs/ACTIONCLIP-SPEC.md`, the landing page).
- **New icon**: the old mark was a literal WhatsApp-style speech bubble
  (green, checkmark) - misleading now that WhatsApp is one of several
  destinations, not the product's identity. New mark: a clipboard with a
  lightning bolt, in the new brand gradient. Regenerated via
  `generate-icons.cjs` (PNG set, tray icon, and multi-resolution `.ico`).
- **New visual identity**: brand gradient shifted from green→teal
  (`#22c55e → #0d9488`, which read as "this is a WhatsApp tool") to
  indigo→violet (`#6366f1 → #a855f7`) across all four renderer windows
  (popup, action-popup, clipboard-history, settings) - a single CSS
  variable pair per file, so this was a low-risk, high-coverage change.
  Green is kept for "detected ✓" success-state chips specifically (a
  deliberate, separate design decision - success states stay green by
  convention regardless of brand color). Container corner radius bumped
  14px → 18px for a softer, more modern feel.
- **Folder rename**: `PingClip/` (the installer-output folder) →
  `ActionClip/`. **The top-level project folder itself could not be
  renamed** - Windows reported it busy (another process, likely a
  concurrent session, had it open as a working directory) - left as-is;
  rename it by hand once nothing has it open.
- **Old install not auto-removed**: the previous "PingClip Agent" install
  under `%LocalAppData%\Programs\PingClip Agent` is a fully separate app
  from Windows' point of view now (different `appId`), so this upgrade
  doesn't touch it - its own silent uninstaller (`/S`) hit the same
  flakiness noted in 1.4.1's entry and left files in place despite exiting
  0. **Uninstall it by hand** via Windows Settings ▸ Apps ▸ "PingClip
  Agent" if you don't want the old entry hanging around; ActionClip is
  installed separately and doesn't depend on it.
- On `Win+V` and Windows' own Clipboard History: unchanged from before -
  still requires the user to turn it off in Windows Settings for
  ActionClip to receive `Win+V` itself (a system-settings change this app
  does not make automatically); `Ctrl+Alt+V` remains the guaranteed
  fallback.

Verification: `node --check` on every JS file post-rename; the
tracking/address/url/phone categorization regression suite re-run and
passing; built the real `ActionClip-Setup-2.0.0.exe`, deployed it (NSIS
`/S` was flaky again, worked around the same way as 1.4.1 - copied
`dist/win-unpacked/` over a fresh `%LocalAppData%\Programs\ActionClip`),
launched it for real, and confirmed end-to-end via the actual on-disk
`actionclip.json`: a live tracking-number clipboard write was logged and
correctly categorized `tracking` under the new store name. No startup
errors beyond the expected "`Super+V` already taken by Windows" notice.
Test entries cleared afterward.

Desktop agent package: `pingclip-agent` 1.4.1 → `actionclip` 2.0.0 (major
bump - a rename plus a visual identity change, not a patch).

## 1.4.1 (desktop agent) - 2026-09-13

**Found and fixed the actual root cause behind every clipboard-detection
problem this app has had since 1.3.0** - including the 1.3.1 "crash" and
1.4.0's silent no-op, both previously (and wrongly) attributed to
environment/remote-desktop clipboard quirks.

**The real cause:** `electron@44.2.0`'s `clipboard` module was migrated to
a fully Promise-based API (`readText()`, `writeText()`, `read()`, `has()`
all now return Promises, modeled on `navigator.clipboard` - there is no
synchronous string-returning `readText()` anymore, and `availableFormats()`
no longer exists at all). This codebase - going back to before this
detector work started - always called `clipboard.readText()` synchronously
(`text = clipboard.readText()`, then `text.match(...)`). On this Electron
version that assigns a **Promise object** to `text`, not a string:
- Before 1.3.1's guard: `!text` is `false` for a Promise (truthy object),
  so it fell through to `text.match()` a few calls deep and threw - the
  exact crash-loop 1.3.1 fixed, misdiagnosed there as "a remote-desktop
  clipboard-sync quirk returning `{}`" (a Promise's shape in that logging
  context looked like `{}`).
- After 1.3.1's `typeof text !== 'string'` guard: the Promise object was
  correctly rejected by the guard - but that meant **every single poll
  tick silently no-opped, forever**, since a Promise is never a string.
  Detection wasn't flaky after 1.3.1 - it never ran a single successful
  tick again. This is why 1.4.0's live install (installed and left running
  crash-free per its own changelog entry) still logged **zero** clipboard-
  history items across five distinct test writes with no error - not a
  bridge/session issue as suspected at the time, an actual Promise-vs-
  string mismatch on every single read.

**Fix:** `checkClipboard()` and `triggerManualPopup()` are now `async` and
`await clipboard.readText()`; `clipboardExcludedFromHistory()` (added in
1.4.0) now uses `await clipboard.read()` + each `ClipboardItem.types`
instead of the no-longer-existent `availableFormats()`; the history
panel's `writeText()` on re-copy is awaited too. A `clipboardCheckInFlight`
guard prevents overlapping polls now that each tick genuinely awaits I/O.

**Verified for real this time**, not just "no crash": stood up a bare
Electron script against the exact same `electron` version this app ships
(`node_modules/electron`, same 44.2.0) confirming `typeof (await
clipboard.readText())` is `'string'` post-fix, where the pre-fix
synchronous call had returned a Promise object. Then built, deployed the
fixed unpacked build over the real installed app on this machine (bypassing
a flaky silent-installer step that had stopped applying updates - noted
below), launched it for real, wrote a fresh Israel Post-style tracking
number to the live system clipboard, and **read the actual on-disk
`clipboardHistory` store back**: the item appeared, correctly categorized
`tracking` (not `phone` - the 1.4.0 priority-reorder fix holds too). Test
entries cleared from the store afterward. This closes the "not yet
verified end-to-end" gap every prior entry back to 1.3.0 had to leave
open.

**Also noted, not yet fixed:** the packaged NSIS installer's silent
(`/S`) mode stopped reliably applying updates partway through this session
(exit code 2, files left unchanged) for reasons not yet diagnosed -
worked around this round by copying the freshly built `dist/win-unpacked/`
output directly over the installed app's `Programs` folder. The GUI
installer wizard (double-click, click through Install/Finish) is
unaffected and remains the supported install path for end users; this
only affects unattended `/S` upgrades, which end users don't do anyway.

Desktop agent package version: 1.4.0 → 1.4.1.

## 1.4.0 (desktop agent) - 2026-09-13

**ActionClip is now a full clipboard-history manager**, not just a
detector-triggered popup tool - the user asked for it to genuinely replace
Windows' own Win+V clipboard history: every text copy gets logged (not
just ones that match a detector), browsable/searchable/filterable by
category, with the same one-click actions available inline.

- **New clipboard-history panel** (`src/clipboard-history/*`): opens on
  `Win+V` (if free - see below) or the guaranteed fallback `Ctrl+Alt+V`,
  or from the tray menu. Search box, category filter chips (📞 טלפון /
  📦 מעקב / 🗺️ כתובת / 🔗 קישור / 📋 טקסט), click an item to copy it back
  to the clipboard (same as Win+V), a per-item ▶ button to run its
  detected action directly without re-copying, per-item delete, and
  "נקה הכל".
- **`Win+V` itself**: Windows' own built-in Clipboard History already owns
  this shortcut, so Electron can only register it once that's turned off
  in Windows Settings (System ▸ Clipboard) - documented in the new
  Settings ▸ "היסטוריית לוח (Win+V)" tab, since this app can't change that
  system setting for the user. `Ctrl+Alt+V` always works regardless.
- **Every text copy is logged**, independent of the `detectors` toggles
  (those only gate the instant action popup) - up to `historySize` (default
  50, configurable 10-200) most recent, oldest dropped first. New
  `store.js` keys: `clipboardHistory`, `settings.historyEnabled`,
  `settings.historySize`.
- **Privacy**: a clear pause toggle (in the panel's footer and in
  Settings) and a "clear all" action, since this is a meaningfully bigger
  data surface than before (everything copied, not just detector matches,
  persisted to disk). Also: **a copy an app marks as sensitive (the
  `ExcludeClipboardContentFromMonitorProcessing` clipboard format -
  respected by 1Password, Bitwarden, and Windows' own Win+V) is never
  logged**, the same convention those tools already rely on - no
  password-specific detection needed on our end.
- **Real bug found and fixed while wiring this up**: `findPhone`'s loose
  "bare 9 consecutive digits = landline missing its leading 0" heuristic
  (`lib/phone.js`) was quietly swallowing Israel Post tracking numbers
  (the UPU S10 format is 2 letters + **9 digits** + 2 letters, e.g.
  `RR123456789IL`) as phone-number matches - and since `checkClipboard`/
  `triggerManualPopup` checked phone before the generic detectors, every
  such tracking number opened the WhatsApp composer instead of the
  tracking popup, silently, since 1.3.0. Fixed by checking the generic
  detectors (tracking/address/url - all far more specific patterns) first,
  phone as the fallback, in both functions and in the new history
  categorizer. This was a real regression in 1.3.0 no one had caught yet,
  not something introduced by this release.
- Desktop agent package version: 1.3.1 → 1.4.0.

Verification: `node --check` on every new/changed file. Direct unit tests:
`store.js`'s clipboard-history add/delete/clear/cap-at-`historySize` logic
(50-item cap confirmed with 60 inserts); the priority-reorder fix
re-verified against the exact tracking/phone/address/url strings used in
this session (`RR123456789IL` now correctly categorizes as `tracking`, not
`phone`; genuine phone numbers still categorize as `phone`); the
non-string clipboard guard from 1.3.1 re-confirmed still safe after the
reorder. **Not yet installed and run on the machine this round** (unlike
1.3.1, which was caught by doing exactly that) - the tray/notification-area
screen-control access needed for a real visual check was still not
obtainable in this remote session as of 1.3.1's entry; recommend running
`npm run dist` and doing a real Win+V-vs-Ctrl+Alt+V smoke test, including
copying an Israel Post-style tracking number to confirm it now opens the
tracking popup instead of WhatsApp, before this ships further.

**Follow-up correctness pass (same day, separate session, explicitly asked
not to launch any visible window while checking):** independently
rewrote - not re-ran - the unit tests above from scratch against the
shipped code (25 fresh cases across all three detectors + `findPhone`,
including confirming a real tracking number *would* have matched
`findPhone`'s heuristic pre-fix, so the reorder fix is verified load-bearing
rather than trusted on description alone) plus an 18-case malformed-input
sweep (`{}`, `[]`, `NaN`, `Symbol()`, etc.) across every detector entry
point - all passed. `store.js`'s settings-merge exercised directly
(electron-store runs standalone outside Electron, confirmed to a separate
fallback path from the installed app's real config, test artifact deleted
after). Found and fixed packaging drift this session left unfinished: a
`ActionClip-Setup-1.4.0.exe` existed in `dist/` but was never copied to
`ActionClip/` (still had 1.3.1, now removed) or documented in this changelog
section header's sibling files; `package-lock.json` was still pinned at
1.2.0 (`npm install` re-run, 0 vulnerabilities); `dist/win-unpacked/`
(~370 MB regenerable cache) and the stale 1.3.1 exe+blockmap in `dist/`
were left over from the same build. `desktop-agent/README.md` still
described the pre-1.3.0 phone-only product (three tabs, no detectors, no
history) - rewritten to match what's actually shipped. **The real-machine
popup/panel smoke test above is still outstanding** - this pass fixed
packaging and doc drift and added independent test coverage, not the one
verification step that requires an actual local desktop session.

## 1.3.1 (desktop agent) - 2026-09-11

**Fixed a real crash-loop bug** found by actually installing 1.3.0 and
running it on this machine (the thing 1.3.0's own changelog entry flagged
as unverified): `clipboard.readText()` returned a non-string value here
(observed as `{}}` - likely a remote-desktop clipboard-sync quirk on this
machine, Electron's own type isn't enforced at the native layer) which
used to slip past `if (!text || ...)` (an object is truthy) straight into
`text.match(...)` a few calls deep in `phone.js`. Since this throws inside
the main process's 800ms clipboard-poll timer, it wasn't just a skipped
tick - Electron's default uncaught-exception handling threw up a blocking
"A JavaScript error occurred in the main process" dialog, and because the
poll timer kept firing every 800ms regardless, dismissing one dialog just
produced the next, forever.

- `checkClipboard()`/`triggerManualPopup()` in `main.js` now check
  `typeof text === 'string'` before doing anything else with it.
- Defense in depth: `findPhone`/`extractCandidates` (`lib/phone.js`) and
  all three new detectors (`lib/detectors/{tracking,address,url}.js`) now
  guard `typeof text !== 'string'` at their own entry point too, so no
  future caller can reintroduce this by skipping the main.js guard.
- Desktop agent package version: 1.3.0 → 1.3.1.

Verification: `node --check` on every changed file; a direct unit test
feeding `{}`, `[]`, `42`, `null`, `undefined`, `true` into `findPhone` and
`findGenericAction` confirms none of them throw anymore (all previously
threw via the object case, matching what actually happened on screen).
Then the real repro: installed the rebuilt `ActionClip-Setup-1.3.1.exe`
on this machine (found the 1.3.0 crash this way in the first place -
`electron .` from source never reproduced it), and confirmed **no error
dialog appears** on launch or across several real clipboard writes
(`write_clipboard` via computer-use, and `Set-Clipboard` via PowerShell in
the same session) with tracking-number/address/URL text that previously
triggered the crash reliably - that's the regression this release fixes,
confirmed fixed.
**Not verified this round: that a matching action popup actually renders**
for those same clipboard writes. The popup window never became visible in
a screenshot, and after installing the fix I could not get screen-control
access to the system tray/notification-area flyout in this remote-desktop
session to check the tray icon or menu directly either (an access-request
resolution issue in the automation layer, not applied to me pushing on
it further - not something this fix touches). The detection logic itself
is independently unit-tested and correct (see 1.3.0's entry and the
`node -e` tests above, re-run against the literal strings used in this
session's clipboard writes with matching results). Given the clipboard
bridge in this same session was *already* shown to be unreliable (that's
the whole bug this release fixes), popup-not-appearing here is equally
consistent with "the app never saw the write" as with any front-end
regression - this needs a real local login session (not a remote-control
one) or the user's own eyes to settle either way before calling the
detectors themselves fully confirmed end-to-end.

## 1.3.0 (desktop agent) - 2026-09-10

Generalized the desktop agent's clipboard-watching engine from
"phone → WhatsApp only" into a multi-detector "clipboard → action" engine
(the "ActionClip" concept - see [`docs/ACTIONCLIP-SPEC.md`](docs/ACTIONCLIP-SPEC.md)),
folded directly into ActionClip rather than shipped as a separate app, per
product decision to keep one installed tool instead of two competing for
the same clipboard.

- **Three new free detectors**, each opening a small one-click action
  popup next to the cursor (separate from the existing rich WhatsApp
  composer, which is unchanged for phone numbers):
  - **Tracking number → track shipment**: דואר ישראל (S10/UPU format),
    UPS (`1Z...`), DHL AWB, plus keyword-gated FedEx/DHL bare-digit formats
    (only fire near words like "מעקב", "AWB", "tracking" to avoid
    false-positiving on invoice/order numbers) - opens the carrier's own
    tracking page, with a 17track.net universal fallback button.
  - **Address → navigate**: Hebrew (`רחוב`/`רח'`/`שדרות` + house number)
    and English (`221B Baker Street, London`-style) address patterns -
    opens Google Maps and Waze.
  - **Bare URL → open**: only fires when the clipboard is *just* the URL
    (not a link buried in a paragraph) - opens it in the default browser.
- **New Settings ▸ "סוגי זיהוי" tab**: each detector (phone included) has
  its own on/off toggle, on by default.
- New files: `src/lib/detectors/{tracking,address,url,index}.js`,
  `src/action-popup/*` (generic action popup window - header, detected
  value, 1-2 action buttons, same visual language as the WhatsApp popup).
  `src/lib/store.js` settings gained a `detectors` object, deep-merged so
  partial saves don't clobber other detector flags.
- Manual trigger (`Ctrl+Alt+P` / tray menu) now also matches the new
  detectors, not just phone numbers.
- Desktop agent package version: 1.2.0 → 1.3.0.

Verification: `node --check` on every new/changed file; standalone `node
-e` unit tests for all three detectors against ~10 positive/negative cases
each (including the false-positive guards - bare invoice-like numbers,
URLs embedded mid-sentence); a clean `electron .` launch with no console
errors for 8s; `store.js` settings merge logic exercised directly
(partial `saveSettings({ detectors: { tracking: false } })` leaves
`phone`/`address`/`url` untouched, confirmed via output, then reset back
to defaults). Real end-to-end clipboard-copy verification wasn't possible
from this non-interactive shell (`clipboard.readText()` returns `{}`
instead of a string with no active Windows desktop session, an
environment limitation, not a code issue) - **recommend a quick manual
smoke test** (`npm start`, then copy a tracking number / address / bare
URL and confirm each popup + button) before the next installer build.

## Packaging simplification - 2026-09-07

Removed the combined `ActionClip-Setup.exe` wizard (PowerShell/WinForms,
compiled with ps2exe) added earlier today. It wrapped two very different
things behind one graphical installer - copying the Chrome extension's
files, and launching the desktop agent's real NSIS installer - but Chrome
extensions can't be installed silently under any circumstances (Developer
mode + Load unpacked is unavoidable no matter what puts the files on disk),
so the wizard wasn't actually saving a step for the extension half; it was
just another exe to double-click before reaching the same manual steps.

- `chrome-extension/` now installs by loading the folder directly - no
  installer of any kind. See `chrome-extension/README.md`.
- `desktop-agent/` keeps its real installer - it's genuine software that
  sits on the machine and runs in the background, which is exactly what an
  installer is for. `ActionClip/` now contains only
  `ActionClip-Setup-<version>.exe`.
- Deleted the whole `installer/` folder (template, build script, the
  generated intermediate `.ps1`, and its own `app.ico` - the desktop
  agent's `assets/app.ico` was always the one actually used for anything
  that ships).
- Cleaned up file duplication found while tidying: a stale
  `ActionClip-Setup-1.1.0.exe` (+ blockmap) was still sitting in
  `desktop-agent/dist/` next to the current 1.2.0 build, and the ~370 MB
  `dist/win-unpacked/` intermediate build directory (regenerable any time
  via `npm run dist`) was never cleared between builds. A project-wide
  content-hash scan found no other duplicate files.

## 1.2.0 - 2026-09-07

Second upgrade pass, plus two correctness fixes found while verifying it -
one of them a real bug in every previously-built `ActionClip-Setup.exe`,
**including the 1.1.0 one already handed over**.

- **Fixed: garbled Hebrew in `ActionClip-Setup.exe`.** `installer/installer_template.ps1`
  has no BOM, and Windows PowerShell 5.1's `Get-Content -Raw` (no explicit
  `-Encoding`) silently reads a BOM-less file using the system ANSI
  codepage - every Hebrew string in the wizard was being double-encoded
  into mojibake (e.g. "ברוכים הבאים" → "׳‘׳¨׳•׳›׳™׳...") before it even got
  embedded into the compiled exe. `ps2exe` compiled without warning either
  way, because it only wraps the script text as a runtime resource - it
  never validates PowerShell syntax at compile time - so this shipped
  silently. Caught by actually parsing the generated script with
  `[System.Management.Automation.Language.Parser]::ParseFile` (32 cascading
  syntax errors, since a mangled Hebrew string breaks quote-matching for
  everything after it) and confirming char-by-char via Unicode code points
  before and after the fix. **If you already installed from the 1.1.0
  `ActionClip-Setup.exe`, the wizard text you saw was garbled - re-run this
  version's installer; nothing else about that install is affected, since
  the wizard only orchestrates file copies and doesn't store any of its own
  UI text anywhere.** Fix: `installer/build-installer.ps1` now reads the
  template with `-Encoding UTF8` explicitly.
- **Manual entry in the desktop agent's popup** (parity with the Chrome
  extension): if the clipboard didn't contain a recognizable number, the
  popup now shows the same paste/type-a-number fallback the extension has,
  instead of only ever working when auto-detection succeeded.
- **Manual trigger**: `Ctrl+Alt+P` (global, works from anywhere on the
  machine) or the new "פתח ידנית" tray menu item opens the popup on demand
  - re-reads the clipboard immediately, or falls back to the manual-entry
    field - regardless of the poll interval or the repeat-popup cooldown.
- **Correctness fix**: sending from the manual-entry field now uses the
  number actually typed in, not whatever (if anything) was auto-detected
  when the window opened - previously the desktop agent would silently
  send to the wrong number if a rep opened the popup on a bad clipboard
  read and then typed in a different one by hand. The duplicate-send
  warning is recomputed for that number too, not just the initially
  detected one. (The Chrome extension didn't have this bug - its popup
  always read the phone from its own local UI state - but its logic was
  hardened the same way for consistency.)
- **CSV export** for send history, both components (`ייצוא ל-CSV` button
  next to "נקה היסטוריה"): UTF-8 with a BOM so Hebrew opens correctly in
  Excel, one row per send (number, name, template, timestamp).
- **Version number** shown at the bottom of both Settings/Options pages.
- Chrome extension manifest version: 1.1.0 → 1.2.0. Desktop agent package
  version: 1.1.0 → 1.2.0.

Verification for this release: `node --check` on every changed file, `node
--eval` unit tests for the new CSV-escaping/building logic (quoting commas,
embedded quotes, missing fields) and the duplicate-detection recompute, a
clean Electron launch with no console errors, and an actual click-through
of the new manual-entry → duplicate-warning flow rendered in a browser via
a stubbed `window.actionclip`/`chrome.*` (screenshotted, not just read) -
this is what caught the send-uses-stale-phone bug above. `npm audit`:
0 vulnerabilities in `desktop-agent`. The generated installer script was
parsed with PowerShell's own AST parser (not just compiled with ps2exe,
which doesn't validate script syntax) and its Hebrew strings checked at the
Unicode-code-point level - this is what caught the encoding bug above.
Both installers rebuilt and the repackaged agent re-launched cleanly.

## 1.1.0 - 2026-09-07

Modern UI/UX pass across both components, a graphical installer for the
whole system, and a first round of "quality of life" upgrades.

- **Redesigned UI** (Chrome extension popup/options, desktop-agent
  popup/settings): gradient brand header, card-based layout, custom toggle
  switches, focus rings, hover/press micro-animations, consistent design
  tokens (colors, radii, shadows) shared across both surfaces, light/dark
  mode support. Replaces the plain/utilitarian v1.0.0 styling.
- **Duplicate-send warning**: sending to a number already messaged
  recently (default 30 min, configurable) now shows an inline warning
  banner in the popup - "already messaged N minutes ago" - instead of
  silently allowing or blocking it. The rep decides whether to send again.
- **Send history** (last 25, local only): both components now log every
  send (phone, name, template, time) and expose it in a new History tab in
  Settings, with a "clear history" action.
- **Auto-launch on Windows startup** (desktop agent): toggle in Settings ▸
  ניטור, backed by `app.setLoginItemSettings`.
- **Tray status**: the desktop agent's tray tooltip/menu now reflects
  whether monitoring is active or paused, instead of a static label.
- **Graphical installer**: `ActionClip/ActionClip-Setup.exe` - a single
  branded wizard (PowerShell + WinForms, compiled with ps2exe, same
  approach as LeadClip's installer in this workspace) that lets you pick
  either or both components, installs the Chrome extension's files, and
  launches the desktop agent's own installer
  (`ActionClip-Setup-<version>.exe`, built with `electron-builder` /
  NSIS - proper Windows installer with an uninstall entry, desktop/start
  menu shortcuts, and a custom install directory).
- Electron bumped from 30 to 44 (closes a large batch of upstream Electron
  CVEs); electron-builder bumped to 26 for the same reason. `npm audit`
  reports 0 vulnerabilities in `desktop-agent` as of this release.
- Chrome extension manifest version: 1.0.0 → 1.1.0. Desktop agent package
  version: 1.0.0 → 1.1.0.

## 1.0.0 - 2026-09-07

Initial release: phone-number detection (Israeli mobile + landline,
several input formats), 5 default lead-type message templates (editable),
and two independent trigger surfaces - a Chrome extension (manual, via
toolbar icon or `Alt+Shift+P`) and a desktop agent (automatic, system-tray
clipboard watcher). See [`docs/SPEC.md`](docs/SPEC.md).

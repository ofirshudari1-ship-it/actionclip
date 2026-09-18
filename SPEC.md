# ActionClip — Product Spec & Definition of Done

## Overview
ActionClip is a Windows system-tray desktop agent that monitors the clipboard in real time.
When it detects a phone number, address, tracking number, or URL, it pops up a one-click
action (WhatsApp, navigation, shipment tracking, browser open). It also maintains a full
clipboard history accessible via a global shortcut (Win+V / Ctrl+Alt+V).

## Core Features
| Feature | Status |
|---------|--------|
| Clipboard watcher (500ms poll) | ✅ |
| Phone → WhatsApp popup | ✅ |
| Address → Maps popup | ✅ |
| Tracking number → carrier lookup | ✅ |
| URL → open in browser | ✅ |
| Clipboard history (Win+V) | ✅ |
| Lead capture & delivery (Webhook / Email) | ✅ |
| System-tray icon + context menu | ✅ |
| Settings UI (shortcuts, language, theme) | ✅ |
| First-run welcome wizard | ✅ |
| NSIS installer (per-machine, Program Files) | ✅ |
| Auto-start on Windows login | ✅ |
| Dark / Light theme | ✅ |
| Hebrew / English UI | ✅ |
| Landing page (`site/index.html`) — full bilingual EN/HE content + RTL, English default | ✅ |

> **Note (2026-09-15):** `site/index.html` previously only flipped
> `dir`/`lang` on language toggle while all visible text stayed
> Hebrew-only — flagged as an open gap by the STANDARDS.md §17 audit.
> This is now fixed: the page carries full duplicate EN/HE content
> (`.lang-en` / `.lang-he` blocks, English default, real RTL layout via
> logical CSS properties), matching the pattern already used by
> OptiGuard's and Playnest's `site/` pages. See CHANGELOG.md.

## Definition of Done (per release)

### Code
- [ ] All Jest tests pass (`npm test`)
- [ ] No new `console.error` / unhandled promise rejections in dev run
- [ ] `version.json` bumped; `package.json` in sync (via `build.ps1`)
- [ ] Security: no renderer-controlled network calls; all IPC handlers go through store

### Installer
- [ ] `build.ps1` runs cleanly end-to-end
- [ ] EXE lands in project root (`ActionClip-Setup-<version>.exe`)
- [ ] Install to `C:\Program Files\ActionClip` works without error
- [ ] Uninstall removes app files; AppData preserved
- [ ] Language selector shows English + Hebrew; defaults to English

### UX
- [ ] Welcome wizard shown on first launch after install
- [ ] Tray icon appears on startup
- [ ] Global shortcut (Ctrl+Alt+V) opens clipboard history
- [ ] Settings persist across restarts
- [ ] RTL layout correct when Hebrew is selected

### Security
- [ ] CSP meta tag present in all 5 HTML pages
- [ ] `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on all windows
- [ ] SSRF: IPC handlers read URL/headers from store only

## Version History
See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

# Release Checklist — ActionClip

Use this checklist before publishing any installer. Complete every item in order.

## Pre-build

- [ ] `version.json` updated — `version`, `buildDate`, `channel`
- [ ] `desktop-agent/package.json` version matches `version.json`
- [ ] `CHANGELOG.md` has a dated entry for this version (not "Unreleased")
- [ ] All `data-i18n` keys present in both `locales/en.json` and `locales/he.json`
- [ ] No hardcoded Hebrew strings in JS/HTML files (grep for untracked Hebrew text)
- [ ] `SPEC.md` up to date if any feature changed
- [ ] `README.md` up to date (install section, screenshots if applicable)

## Build

- [ ] Run `npm test` in `desktop-agent/` — all tests pass (64/64 baseline)
- [ ] Run `build.ps1` from project root (reads `version.json`, syncs package.json, runs `npm run dist`)
- [ ] Build completes without errors or NSIS warnings
- [ ] Output EXE named `ActionClip-Setup-<version>.exe` (check file name!)

## Installer verification

- [ ] Install on a clean Windows 10/11 machine (or VM)
- [ ] Language selector appears and both English and Hebrew work
- [ ] App starts after install and tray icon is visible
- [ ] Uninstall removes all shortcuts and registry entries (check `HKCU\Software\ActionClip`)
- [ ] No "blocked features" firewall dialog on first launch (firewall rule added by installer)

## Post-build

- [ ] Old installer EXE removed from project root (only one EXE at a time)
- [ ] New EXE copied to project root — `PC-Software/ActionClip/ActionClip-Setup-<version>.exe`
- [ ] No leftover `dist/`, `out/`, or intermediate files in project root
- [ ] `DELETIONS.md` updated if any files were deleted/moved during this release
- [ ] Git commit / tag created (if using version control)

## Smoke test

- [ ] Copy a phone number → popup appears with WhatsApp button
- [ ] History panel opens with `Ctrl+Shift+H`
- [ ] Settings window opens, version label matches `version.json`
- [ ] Language switch (EN ↔ HE) works without restart
- [ ] Log file created at `%APPDATA%\ActionClip\logs\actionclip.log`

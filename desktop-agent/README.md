# ActionClip - Desktop Agent

A small background app (system tray, no visible window) that watches your
clipboard everywhere on the computer - not just in the browser. Copy
something, and ActionClip does the right next thing with it:

| You copied | ActionClip offers |
|---|---|
| An Israeli phone number | Open WhatsApp with a ready-made message (own popup, name field, template picker) |
| A shipment tracking number (דואר ישראל / UPS / DHL / FedEx) | Track the package on the carrier's site (+ 17track fallback) |
| An address (Hebrew or English) | Navigate with Google Maps or Waze |
| A bare link | Open it in your browser |
| Anything else | Nothing pops up, but it's still logged - see **Clipboard history** below |

See [`../docs/ACTIONCLIP-SPEC.md`](../docs/ACTIONCLIP-SPEC.md) for the
design behind the multi-detector engine, and
[`../docs/SPEC.md`](../docs/SPEC.md) for the original phone → WhatsApp spec.

## Install (recommended: the built installer)

Run [`../ActionClip/ActionClip-Setup-<version>.exe`](../ActionClip/README.md).
A real Windows installer (NSIS, via `electron-builder`): per-user install
(no admin required), desktop + start menu shortcuts, and a normal uninstall
entry in Windows Settings. No Node/npm needed on the target machine.

## Setup (developer / running from source)

```bash
cd desktop-agent
npm install
npm start
```

A ActionClip icon appears in the Windows system tray (bottom-right, may be
under the "^" hidden-icons arrow the first time). Right-click it for the
menu: toggle monitoring, open settings/templates, open clipboard history,
or quit. Its tooltip and menu label reflect whether monitoring is currently
active or paused.

## Using it

1. Copy anything - a phone number, a tracking number, an address, a link,
   or just regular text.
2. If it matched a detector, a small window appears near your cursor
   within about a second, showing what was detected and one or two action
   buttons (phone numbers get the richer WhatsApp composer - name field,
   template picker, message preview; everything else gets a compact
   "action(s) for this" popup).
3. Click the action - it opens in your default browser, and the popup
   closes.

The window closes itself after a short delay (configurable in Settings),
or with the ✕ button / Escape key.

**Nothing in the clipboard, or monitoring is paused?** Press `Ctrl+Alt+P`
from anywhere, or right-click the tray icon → **פתח ידנית** - re-reads the
clipboard right now regardless of settings; for a phone number this shows
the same paste/type-a-number fallback the Chrome extension has.

## Clipboard history (Win+V-style)

ActionClip also keeps a running log of everything you copy - not just what
triggered an action popup - searchable and filterable by type, the same
idea as Windows' own Win+V. Open it with `Ctrl+Alt+V` or the tray menu
(Windows' native Win+V shortcut only opens ActionClip's version once you've
turned off Windows' own Clipboard History in Settings ▸ System ▸ Clipboard -
covered in-app in Settings ▸ "היסטוריית לוח (Win+V)").

Click an item to re-copy it, or the ▶ button to run its action directly.
Anything a password manager (1Password, Bitwarden, Windows' own Clipboard
History) marks as sensitive is skipped and never logged - same standard
those apps already use for "don't remember this copy" (a copied password).
Turn history recording off entirely, or clear it, from Settings.

## Settings

Right-click the tray icon → **הגדרות ותבניות...** - five tabs:

- **תבניות הודעה** - add/edit/delete WhatsApp message templates per lead
  type (`{שם}` token), and pick the default one.
- **סוגי זיהוי** - turn each detector on/off independently (phone,
  tracking, address, url) - all on by default.
- **הגדרות** - clipboard monitoring on/off, auto-launch on Windows startup,
  scan interval, repeat-popup cooldown, popup auto-close delay, and the
  WhatsApp duplicate-send warning window (minutes).
- **היסטוריית לוח (Win+V)** - clipboard-history recording on/off, how many
  items to keep, clear it, and how to free up the real Win+V shortcut.
- **היסטוריית שליחות** - the last 25 WhatsApp sends (number, name,
  template, when), with buttons to export to CSV (Excel-friendly, UTF-8
  with BOM) or clear it. This is separate from clipboard history above -
  it only logs actual WhatsApp sends, not every copy.

Settings, templates, and both histories are stored locally (via
`electron-store`, a JSON file under your Windows user profile) - nothing
leaves the machine except whichever link (WhatsApp/Maps/Waze/carrier
site/the link itself) you choose to open.

## Building the installer (for maintainers)

```bash
npm run dist
```

Produces `dist/ActionClip-Setup-<version>.exe` (electron-builder, NSIS
target - config lives in `package.json`'s `"build"` field). Copy the result
into `../ActionClip/`, and delete the previous version's file from both
`dist/` and `../ActionClip/` so a stale build doesn't linger - also worth
clearing `dist/win-unpacked/` (a large intermediate directory `npm run dist`
regenerates each time, not needed once the installer exists).

## Privacy

- Clipboard text is only ever inspected in memory to look for a phone /
  tracking / address / URL pattern; detection is entirely local.
- Clipboard history (if enabled) is written to disk locally
  (`electron-store`) so it survives a restart, same as any other local app
  setting - never uploaded anywhere. Turn it off or clear it anytime from
  Settings. Copies flagged sensitive by the source app are never logged.
- The only outbound action is opening a link in your default browser
  (WhatsApp, Maps, Waze, a carrier's tracking page, or the copied link
  itself) - the same as clicking that link by hand.
- Turn off monitoring anytime from the tray menu.

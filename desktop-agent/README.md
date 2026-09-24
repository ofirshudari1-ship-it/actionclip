# TapAct

**Copy something on Windows, get the right next step automatically — built for call centers.**

## What it does

TapAct is a small Windows background app (it lives in the system tray, no visible window) that watches your clipboard everywhere on the computer, not just inside a browser tab. It's built for the fast copy-paste workflow of a call center: copy a customer's phone number and a WhatsApp composer pops up ready to send; copy a shipment tracking number and it offers to open the carrier's tracking page; copy an address and it offers Google Maps or Waze; copy a plain link and it offers to open it. Everything else you copy is still quietly logged to a searchable local clipboard history (like Windows' own Win+V), so nothing is ever lost even when no action fires. Detection and history are entirely local — the only thing TapAct ever sends out is opening the link you actually clicked, in your normal browser.

## Download & install

Get the latest installer from the GitHub Releases page:

**[Download the latest version](https://github.com/ofirshudari1-ship-it/tapact/releases/latest)**

1. Download `TapAct-Setup-<version>.exe` from the release's Assets.
2. Run the installer — no administrator rights required (per-user install).
3. Follow the setup wizard: choose English or Hebrew, then finish.
4. TapAct starts automatically and adds an icon to your system tray (it may be hidden under the "^" arrow the first time).
5. Copy a phone number, address, tracking number, or link to try it out.

**System requirements:** Windows 10/11.

## Key features

- **Phone number → WhatsApp**: a ready-made message composer with a name field and template picker, for Israeli numbers by default with an international fallback for numbers copied with an explicit `+countrycode` prefix.
- **Tracking number → carrier tracking page** (Israel Post, UPS, DHL, FedEx, with a 17track fallback).
- **Address → Google Maps or Waze** navigation, Hebrew or English.
- **Plain link → opens in your default browser.**
- **Custom action rules**: define your own regex pattern → URL template rules for formats specific to your business (e.g. an internal order number that opens your CRM), on top of the five built-in detectors.
- **Clipboard history** (`Ctrl+Alt+V`): a searchable, filterable log of everything you copy, not just what triggered a popup — re-copy or re-run any past item's action with one click. Anything your system already flags as a sensitive copy (like a password) is never logged.
- **Message templates** per lead type, and a send-history log (last 25 WhatsApp sends) exportable to CSV.
- **Tray quick-repeat menu** for instantly re-firing the last few detected actions.
- Full bilingual **English/Hebrew UI**, auto-launch on Windows startup, and configurable popup timing.

## Automatic updates

TapAct checks GitHub for new versions automatically in the background and offers to install them for you (via electron-updater), so you don't need to manually re-download the installer for routine updates. You can always find the latest release yourself on the [Releases page](https://github.com/ofirshudari1-ship-it/tapact/releases).

## Privacy

- Clipboard text is only ever inspected in memory to check for a phone/tracking/address/URL pattern — detection is entirely local, nothing is sent anywhere to be analyzed.
- Clipboard history, if enabled, is stored locally on your machine and never uploaded. Turn it off or clear it anytime from Settings.
- The only outbound action TapAct ever takes is opening a link in your default browser (WhatsApp, Maps, Waze, a carrier's tracking page, or the link you copied) — exactly the same as clicking that link yourself.
- You can pause monitoring anytime from the tray menu.

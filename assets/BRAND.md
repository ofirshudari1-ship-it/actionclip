# TapAct Brand Guidelines

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--brand-start` | `#6366f1` | Gradient start (Indigo 500) |
| `--brand-end` | `#a855f7` | Gradient end (Purple 500) |
| `--brand-dark` | `#3730a3` | Header/deep accent (Indigo 800) |
| `--bg-primary` | `#0f172a` | App background (dark mode) |
| `--bg-secondary` | `#1e293b` | Card/panel background (dark mode) |
| `--text-primary` | `#f1f5f9` | Primary text (dark mode) |
| `--text-secondary` | `#94a3b8` | Secondary / muted text (dark mode) |
| `--border-color` | `#334155` | Borders & dividers (dark mode) |
| `--success` | `#22c55e` | Success states |
| `--warning` | `#f59e0b` | Warning states |
| `--danger` | `#ef4444` | Error / destructive actions |

### Light Mode Overrides
| Token | Hex |
|-------|-----|
| `--bg-primary` | `#f8fafc` |
| `--bg-secondary` | `#ffffff` |
| `--text-primary` | `#0f172a` |
| `--text-secondary` | `#64748b` |
| `--border-color` | `#e2e8f0` |

## Gradient
```css
background: linear-gradient(120deg, #3730a3, #6366f1, #a855f7);
```
Used on: header bars, tray icon, installer sidebar, primary CTAs.

## Typography
- **UI font**: system-ui / Segoe UI (Windows native)
- **Hebrew support**: required on all screens; RTL layout when `lang="he"`

## Logo Usage
- `assets/logo.png` — full logo (tray menu header)
- `assets/app.ico` — window + taskbar icon (multi-size ICO)
- `assets/tray.png` — 16×16 / 32×32 tray icon

## Iconography
- Emoji-based icons in popup actions (📞 🗺️ 📦 🔗)
- System icons (✓ ✗) for shortcut status
- No third-party icon font dependencies

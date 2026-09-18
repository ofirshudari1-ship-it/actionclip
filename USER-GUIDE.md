# ActionClip — User Guide / מדריך משתמש

## English

### What is ActionClip?

ActionClip is a Windows background agent that watches your clipboard and suggests the right next action automatically. Copy a phone number → get a WhatsApp message ready. Copy a tracking number → open the shipper's tracking page. Copy an address → open navigation. Everything you copy is also saved in a searchable local history.

### Installation

1. Download **ActionClip-Setup-2.4.0.exe** from the project root.
2. Run the installer — select your preferred language (English or Hebrew).
3. The installer requires administrator rights to register the autostart entry.
4. After installation, ActionClip starts automatically and appears in the system tray (bottom-right corner of the taskbar).

### First Launch

On first launch the system tray icon (📎) appears. Double-click it or left-click to open the main popup. A welcome wizard guides you through:

1. **Language** — English / Hebrew (affects the app interface; the installer language is chosen separately during setup).
2. **Channels** — enable WhatsApp, Webhook, Slack, Email, or Copy-to-clipboard.
3. **Keyboard shortcut** — the default shortcut to open the popup is `Ctrl+Shift+V` (configurable in Settings).

### Daily Use

| Action | Result |
|--------|--------|
| Copy any text on screen | ActionClip analyses it silently in the background |
| Recognised phone number | Popup appears with WhatsApp / channel buttons |
| Copy again while popup is open | Popup refreshes with the new content |
| `Ctrl+Shift+V` | Opens popup regardless of clipboard content |
| `Ctrl+Shift+H` | Opens clipboard history panel |

### Clipboard History

Press `Ctrl+Shift+H` (or click the History icon in the tray menu) to open the history panel. You can:

- Search across all past clipboard entries
- Click any entry to copy it again
- Run saved actions on historical phone numbers
- Clear the entire history from the Settings page

### Settings

Right-click the tray icon → **Settings** or press `Ctrl+Shift+S`:

| Section | What you can configure |
|---------|------------------------|
| **Tool** | WhatsApp API URL, webhook endpoint, Slack token/channel, email server |
| **History** | Maximum entries stored, auto-clear on exit |
| **System** | Startup with Windows, global shortcuts, language, theme |
| **About** | Version, licences |

### Sending Leads

When a phone number is detected:

1. Optionally fill in **Name**, **Role**, **Source** fields.
2. Select or compose a **message template** (WhatsApp section).
3. Click the channel button (WhatsApp / Webhook / Slack / Email) or **Send to all**.

Duplicate detection warns you if the same number was sent recently.

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| Tray icon doesn't appear after install | Restart the PC; check `Task Manager → Startup` that ActionClip is enabled |
| Popup doesn't open on copy | Right-click tray → Enable; verify global shortcut is not conflicting |
| WhatsApp messages not sending | Verify WhatsApp Web is open and logged in on this PC |
| Log file location | `%APPDATA%\ActionClip\logs\actionclip.log` |

---

## עברית

### מה זה ActionClip?

ActionClip הוא סוכן רקע ל-Windows שעוקב אחרי הלוח ומציע את הפעולה הנכונה הבאה אוטומטית. מעתיקים מספר טלפון ← מקבלים הודעת WhatsApp מוכנה. מספר מעקב ← פותח דף מעקב אצל החברה המשלחת. כתובת ← פותח ניווט. כל מה שמעתיקים נשמר גם בהיסטוריה מקומית עם חיפוש.

### התקנה

1. הורד את **ActionClip-Setup-2.4.0.exe** משורש הפרויקט.
2. הרץ את תוכנית ההתקנה — בחר שפה (אנגלית / עברית).
3. ההתקנה דורשת הרשאות מנהל לצורך רישום הפעלה אוטומטית עם Windows.
4. לאחר ההתקנה ActionClip מופעל אוטומטית ומופיע ב-System Tray (פינה ימנית-תחתונה של שורת המשימות).

### שימוש יומיומי

| פעולה | תוצאה |
|-------|-------|
| העתק כל טקסט | ActionClip מנתח אותו ברקע בשקט |
| מספר טלפון זוהה | פופ-אפ נפתח עם כפתורי WhatsApp / ערוצים |
| העתקה נוספת כשהפופ-אפ פתוח | הפופ-אפ מתרענן עם התוכן החדש |
| `Ctrl+Shift+V` | פותח פופ-אפ ללא תלות בתוכן הלוח |
| `Ctrl+Shift+H` | פותח חלון היסטוריית העתקות |

### היסטוריית לוח

לחץ `Ctrl+Shift+H` (או לחץ על History בתפריט ה-Tray) לפתיחת לוח ההיסטוריה:

- חיפוש בין כל הרשומות
- לחיצה על רשומה מעתיקה אותה מחדש
- הפעלת פעולות שמורות על מספרי טלפון מהעבר
- ניקוי כל ההיסטוריה מדף ההגדרות

### פתרון תקלות

| תסמין | פתרון |
|-------|-------|
| האייקון לא מופיע לאחר התקנה | הפעל מחדש את המחשב; בדוק ב-Task Manager → Startup שActionClip מופעל |
| הפופ-אפ לא נפתח בהעתקה | לחץ ימני על Tray → Enable; ודא שהקיצור לא מתנגש עם תוכנה אחרת |
| הודעות WhatsApp לא נשלחות | ודא ש-WhatsApp Web פתוח ומחובר במחשב זה |
| מיקום קובץ לוג | `%APPDATA%\ActionClip\logs\actionclip.log` |

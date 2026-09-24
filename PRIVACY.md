# Privacy Policy — TapAct / מדיניות פרטיות

_Last updated / עודכן לאחרונה: 2026-09-15 (v2.4.4 desktop agent / v1.2.1 extension)_

## English

TapAct has two components: a Windows desktop agent and a Chrome
extension. Neither one sends your data to any TapAct server, because
there isn't one — there is no backend, no analytics, and no telemetry.

**What is read:** both components read the Windows/browser clipboard only
at the moment you trigger the tool (open the popup, or the clipboard
watcher detects a copy), to look for a phone number, tracking number,
address, or link.

**What is stored, and where:**
- Desktop agent: message templates, settings, and clipboard/send history
  are stored locally in `%APPDATA%\TapAct` on your own machine.
- Chrome extension: templates and settings are stored in
  `chrome.storage.sync` (synced through your own Google account, not an
  TapAct account); send history is stored in `chrome.storage.local`
  (this browser profile only).

**What leaves your machine:** the only outbound action either component
takes is opening a `wa.me/<number>` link in your default browser or a new
tab — that is you opening WhatsApp Web with the number you chose, the same
as typing the URL yourself. No clipboard content, template text, or
history is transmitted to TapAct, WhatsApp, or any third party by the
extension or the agent themselves.

**No AI / cloud processing:** TapAct does not call any AI API (Claude,
OpenAI, or otherwise) and does not send page content, clipboard content, or
any user data to a cloud service for processing. Nothing here is subject to
the Chrome Web Store's Limited Use restrictions because nothing is sent off
the device in the first place.

**Permissions justification (Chrome extension):**
- `storage` — to save templates/settings/history locally as described above.
- `clipboardRead` — to detect a phone number in what you just copied, only
  when you open the popup.

**Distribution:** this extension is currently distributed as an unpacked
folder (`chrome-extension/`) loaded via Chrome's Developer Mode, not
published on the Chrome Web Store. The Chrome Web Store's Single Purpose
Policy / data-disclosure enforcement (effective 2026-08-01) applies to Web
Store listings; this document exists so the extension is ready and accurate
if/when it is submitted there.

**Changes:** if a future update changes what data is read or where it is
stored, this file and the in-app "What's new" notes will say so before you
update, not after.

**Contact:** see `README.md` for how to reach the maintainer.

---

## עברית

ל-TapAct שני רכיבים: סוכן שולחן עבודה ל-Windows ותוסף Chrome. אף אחד
מהם לא שולח מידע לשרת של TapAct, כי אין כזה — אין backend, אין
אנליטיקס, אין טלמטריה.

**מה נקרא:** שני הרכיבים קוראים את לוח ההעתקה (clipboard) של Windows/הדפדפן
רק ברגע שהכלי מופעל (פתיחת ה-popup, או זיהוי העתקה על ידי הסוכן), כדי
לחפש מספר טלפון, מספר מעקב, כתובת או קישור.

**מה נשמר, ואיפה:**
- סוכן שולחן העבודה: תבניות הודעה, הגדרות, והיסטוריית שליחות נשמרים
  מקומית ב-`%APPDATA%\TapAct` על המחשב שלך בלבד.
- תוסף Chrome: תבניות והגדרות נשמרות ב-`chrome.storage.sync` (מסונכרן
  דרך חשבון Google שלך, לא חשבון TapAct); היסטוריית שליחות נשמרת
  ב-`chrome.storage.local` (פרופיל הדפדפן הזה בלבד).

**מה יוצא מהמחשב שלך:** הפעולה היחידה שיוצאת החוצה היא פתיחת קישור
`wa.me/<number>` בדפדפן/בטאב חדש — זו בדיוק הפעולה של פתיחת WhatsApp Web
עם המספר שבחרת, בדיוק כמו הקלדת ה-URL בעצמך. שום תוכן מלוח ההעתקה, טקסט
תבנית, או היסטוריה לא משודר ל-TapAct, ל-WhatsApp, או לכל צד שלישי,
לא על ידי התוסף ולא על ידי הסוכן.

**בלי AI / עיבוד בענן:** TapAct לא קורא לשום API של AI (Claude,
OpenAI או אחר) ולא שולח תוכן עמוד, תוכן לוח העתקה, או כל מידע משתמש
לשירות ענן לעיבוד. שום דבר כאן לא כפוף למגבלות Limited Use של חנות
Chrome, כי שום דבר לא יוצא מהמכשיר מלכתחילה.

**הצדקת הרשאות (תוסף Chrome):**
- `storage` — לשמירת תבניות/הגדרות/היסטוריה מקומית כמתואר למעלה.
- `clipboardRead` — לזיהוי מספר טלפון במה שהועתק זה עתה, רק כשה-popup נפתח.

**הפצה:** התוסף מופץ כרגע כתיקייה לא-ארוזה (`chrome-extension/`) שנטענת
דרך Developer Mode של Chrome, ולא מפורסם ב-Chrome Web Store. אכיפת
Single Purpose Policy/גילוי הנתונים של חנות Chrome (בתוקף מ-1.8.2026)
חלה על רישומים בחנות; מסמך זה קיים כדי שהתוסף יהיה מוכן ומדויק אם/כאשר
הוא יוגש לשם.

**שינויים:** אם עדכון עתידי משנה אילו נתונים נקראים או איפה הם נשמרים,
זה יתועד כאן ובהודעות "מה חדש" באפליקציה לפני העדכון, לא אחריו.

**יצירת קשר:** ראו `README.md` לדרכי יצירת קשר עם המפתח.

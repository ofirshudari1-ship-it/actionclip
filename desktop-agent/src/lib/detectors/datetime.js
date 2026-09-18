// Date/time detection — fires when the copied text looks like a standalone
// date or date+time (not a sentence that happens to mention a date).
// The action opens Google Calendar's new-event page with the date pre-filled.

const HE_MONTHS = {
  'ינואר': 1, 'פברואר': 2, 'מרץ': 3, 'אפריל': 4,
  'מאי': 5, 'יוני': 6, 'יולי': 7, 'אוגוסט': 8,
  'ספטמבר': 9, 'אוקטובר': 10, 'נובמבר': 11, 'דצמבר': 12
};

const EN_MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function pad(n) { return String(n).padStart(2, '0'); }

function toGCalDate(y, m, d, h, min) {
  const ds = `${y}${pad(m)}${pad(d)}`;
  if (h == null) {
    // all-day: dates=YYYYMMDD/YYYYMMDD+1day
    const next = new Date(y, m - 1, d + 1);
    const ns = `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
    return `${ds}/${ns}`;
  }
  const ts = `${ds}T${pad(h)}${pad(min)}00`;
  // +1 hour end time
  const end = new Date(y, m - 1, d, h + 1, min);
  const es = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
  return `${ts}/${es}`;
}

function extractTime(str) {
  // HH:MM (24h) or H:MM am/pm
  const m24 = str.match(/(\d{1,2}):(\d{2})(?:\s*(?:am|pm))?/i);
  if (!m24) return null;
  let h = parseInt(m24[1], 10);
  const min = parseInt(m24[2], 10);
  const ampm = str.match(/(\d{1,2}:\d{2})\s*(am|pm)/i);
  if (ampm) {
    const suffix = ampm[2].toLowerCase();
    if (suffix === 'pm' && h < 12) h += 12;
    if (suffix === 'am' && h === 12) h = 0;
  }
  if (h > 23 || min > 59) return null;
  return { h, min };
}

function parseDate(text) {
  const t = text.trim();

  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  let m = t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) {
    const d = parseInt(m[1], 10), mo = parseInt(m[2], 10);
    let y = parseInt(m[3], 10);
    if (y < 100) y += 2000;
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const time = extractTime(t);
      return { y, m: mo, d, h: time?.h ?? null, min: time?.min ?? null };
    }
  }

  // YYYY-MM-DD (ISO)
  m = t.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const time = extractTime(t);
      return { y, m: mo, d, h: time?.h ?? null, min: time?.min ?? null };
    }
  }

  // Hebrew: "23 בספטמבר 2026" or "23 ספטמבר 2026"
  m = t.match(/(\d{1,2})\s+ב?([א-ת]+)\s+(\d{4})/);
  if (m) {
    const d = parseInt(m[1], 10), mo = HE_MONTHS[m[2]], y = parseInt(m[3], 10);
    if (mo) {
      const time = extractTime(t);
      return { y, m: mo, d, h: time?.h ?? null, min: time?.min ?? null };
    }
  }

  // English: "Sep 23, 2026" or "23 Sep 2026" or "September 23, 2026"
  m = t.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (!m) m = t.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const raw1 = m[1], raw2 = m[2], raw3 = m[3];
    let d, moName, y;
    if (/^\d/.test(raw1)) { d = parseInt(raw1, 10); moName = raw2; y = parseInt(raw3, 10); }
    else { moName = raw1; d = parseInt(raw2, 10); y = parseInt(raw3, 10); }
    const mo = EN_MONTHS[moName.toLowerCase().slice(0, 3)];
    if (mo && d >= 1 && d <= 31) {
      const time = extractTime(t);
      return { y, m: mo, d, h: time?.h ?? null, min: time?.min ?? null };
    }
  }

  return null;
}

function findDateTime(text) {
  if (typeof text !== 'string' || !text) return null;
  const trimmed = text.trim();

  // Reject long text — a date shouldn't be a paragraph
  if (trimmed.length > 80 || trimmed.split('\n').length > 3) return null;

  const parsed = parseDate(trimmed);
  if (!parsed) return null;

  const { y, m, d, h, min } = parsed;
  const now = new Date();
  const year = y || now.getFullYear();
  if (year < 2000 || year > 2100) return null;

  const dateStr = `${pad(d)}/${pad(m)}/${year}`;
  const timeStr = h != null ? ` ${pad(h)}:${pad(min)}` : '';
  const gcalDates = toGCalDate(year, m, d, h, min);
  const gcalBase = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('📅 ' + dateStr + timeStr)}&dates=${gcalDates}`;

  return {
    type: 'datetime',
    raw: trimmed,
    display: dateStr + timeStr,
    title: 'תאריך זוהה',
    actions: [
      {
        id: 'gcal',
        label: `שמור ביומן Google 📅`,
        url: gcalBase
      }
    ]
  };
}

module.exports = { findDateTime };

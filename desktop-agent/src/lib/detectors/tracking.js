// Shipment tracking-number detection.
// Two confidence tiers, mirroring the reasoning in phone.js:
//  - "self-evident" formats (S10 UPU postal standard, UPS 1Z, DHL "JD" AWB)
//    match anywhere in the copied text - their shape alone is distinctive
//    enough that false positives are very unlikely.
//  - "bare numeric" formats (FedEx, generic DHL) are common-looking digit
//    strings that could just as easily be an invoice or order number, so
//    they only count as a match when a shipping-related keyword also
//    appears in the copied text (e.g. the label a courier/webshop prints
//    next to the number: "מספר מעקב", "AWB", "tracking", "משלוח").

const KEYWORD_RE = /(מעקב|משלוח|חבילה|שליח|tracking|track|shipment|parcel|awb|consignment|courier|דואר)/i;

const CARRIERS = [
  {
    name: 'israelpost',
    label: 'דואר ישראל',
    // UPU S10 standard: 2 letters, 9 digits, 2 letters (e.g. RR123456789IL)
    re: /\b([A-Z]{2}\d{9}[A-Z]{2})\b/,
    confident: true,
    url: (code) => `https://mypost.israelpost.co.il/itemtrace?itemcode=${encodeURIComponent(code)}`
  },
  {
    name: 'ups',
    label: 'UPS',
    re: /\b(1Z[0-9A-Z]{16})\b/i,
    confident: true,
    url: (code) => `https://www.ups.com/track?loc=he_IL&tracknum=${encodeURIComponent(code.toUpperCase())}`
  },
  {
    name: 'dhl-awb',
    label: 'DHL',
    // DHL eCommerce / Express modern AWB prefix
    re: /\b(JJD\d{16,18}|JD\d{16,18})\b/i,
    confident: true,
    url: (code) => `https://www.dhl.com/il-en/home/tracking.html?tracking-id=${encodeURIComponent(code)}`
  },
  {
    name: 'fedex',
    label: 'FedEx',
    re: /\b(\d{12}|\d{15}|\d{20})\b/,
    confident: false,
    url: (code) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(code)}`
  },
  {
    name: 'dhl',
    label: 'DHL',
    re: /\b(\d{10,11})\b/,
    confident: false,
    url: (code) => `https://www.dhl.com/il-en/home/tracking.html?tracking-id=${encodeURIComponent(code)}`
  }
];

function findTrackingNumber(text) {
  if (typeof text !== 'string' || !text) return null;
  const hasKeyword = KEYWORD_RE.test(text);

  for (const carrier of CARRIERS) {
    if (!carrier.confident && !hasKeyword) continue;
    const m = text.match(carrier.re);
    if (!m) continue;
    const code = m[1];
    return {
      type: 'tracking',
      subtype: carrier.name,
      raw: code,
      display: code,
      title: `מספר מעקב זוהה (${carrier.label})`,
      actions: [
        { id: 'carrier', label: `עקוב אחר המשלוח ב-${carrier.label} 📦`, url: carrier.url(code) },
        { id: '17track', label: 'חיפוש כללי (17track) 🔍', url: `https://www.17track.net/en#nums=${encodeURIComponent(code)}` }
      ]
    };
  }
  return null;
}

module.exports = { findTrackingNumber };

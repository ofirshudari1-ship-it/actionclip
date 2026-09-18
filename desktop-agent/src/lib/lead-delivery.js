// lead-delivery.js — multi-channel delivery for the Lead Capture feature.
// Runs in the main process (called from IPC handlers in main.js).
// Mirrors LeadClip's background.js but adapted for Node / Electron.

const { net } = require('electron');

// Renders {{name}}, {{phone}}, {{role}}, {{source}}, {{url}} tokens.
function renderTemplate(template, lead) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => String(lead[key] || '-'));
}

function buildShareText(lead, template) {
  if (template && template.trim()) return renderTemplate(template, lead);
  const lines = [
    'ליד חדש מ-ActionClip',
    `שם: ${lead.name || '-'}`,
    `טלפון: ${lead.phone || '-'}`,
    `תפקיד: ${lead.role || '-'}`,
    `מקור: ${lead.source || '-'}`
  ];
  if (lead.url) lines.push(`קישור: ${lead.url}`);
  return lines.join('\n');
}

function buildWhatsappUrl(lead, number, template) {
  const digits = (number || '').replace(/[^\d]/g, '');
  const text = encodeURIComponent(buildShareText(lead, template));
  return `https://wa.me/${digits}?text=${text}`;
}

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

function buildMailtoUrl(lead, address, template) {
  const subject = encodeURIComponent(`ליד חדש: ${lead.name || ''}`.trim());
  const body = encodeURIComponent(buildShareText(lead, template));
  const raw = (address || '').trim();
  // Validate email address to prevent mailto header injection; use as-is if valid
  const to = EMAIL_RE.test(raw) ? raw : '';
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

// POST JSON to a webhook URL using Electron's net module (works regardless
// of the renderer's Content Security Policy).
async function postJson(url, body, headerName, headerValue) {
  return new Promise((resolve) => {
    const req = net.request({ method: 'POST', url });
    req.setHeader('Content-Type', 'application/json');
    if (headerName && headerValue) req.setHeader(headerName, headerValue);
    req.on('response', (res) => {
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode });
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.write(JSON.stringify(body));
    req.end();
  });
}

// Cleans up captured lead data with Claude API (user's own API key).
// Returns { ok, lead } on success or { ok: false, error } on failure.
async function cleanupLeadWithAi(lead, apiKey) {
  if (!apiKey) return { ok: false, error: 'אין מפתח API' };

  const systemPrompt =
    'You clean up lead-capture data for a CRM tool. ' +
    'Given raw fields as JSON, respond with ONLY a JSON object with keys ' +
    '"name","phone","role","source" — no markdown, no extra keys. ' +
    'Fix obvious formatting/capitalization. Fill role only when clearly implied. ' +
    'Never invent a phone number or fabricate details not in the input.';

  return new Promise((resolve) => {
    const req = net.request({
      method: 'POST',
      url: 'https://api.anthropic.com/v1/messages'
    });
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('x-api-key', apiKey);
    req.setHeader('anthropic-version', '2023-06-01');

    let body = '';
    req.on('response', (res) => {
      res.on('data', (chunk) => { body += chunk.toString(); });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return resolve({ ok: false, error: `שגיאת AI (${res.statusCode})` });
        }
        try {
          const data = JSON.parse(body);
          let raw = (data?.content?.[0]?.text || '').trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
          const cleaned = JSON.parse(raw);
          resolve({
            ok: true,
            lead: {
              name: (cleaned.name || lead.name || '').slice(0, 120),
              phone: (cleaned.phone || lead.phone || '').slice(0, 40),
              role: (cleaned.role || lead.role || '').slice(0, 160),
              source: (cleaned.source || lead.source || '').slice(0, 60)
            }
          });
        } catch (e) {
          resolve({ ok: false, error: 'תשובת AI לא תקינה' });
        }
      });
    });
    req.on('error', (err) => resolve({ ok: false, error: err.message }));

    req.write(JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 0.2,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify({
        name: lead.name || '', phone: lead.phone || '',
        role: lead.role || '', source: lead.source || '',
        pageTitle: lead.pageTitle || '', url: lead.url || ''
      }) }]
    }));
    req.end();
  });
}

module.exports = { buildShareText, buildWhatsappUrl, buildMailtoUrl, postJson, cleanupLeadWithAi };

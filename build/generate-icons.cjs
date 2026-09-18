// One-off script: generates the PNG icon set + Windows .ico files from a
// single SVG source. Run with: node generate-icons.cjs
const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '..', 'Relay', 'scripts', 'node_modules', 'sharp'));
const pngToIco = require(path.join(__dirname, '..', 'Relay', 'scripts', 'node_modules', 'png-to-ico'));

// ActionClip mark: a clipboard (what you copied) with a lightning bolt
// (the instant action it triggers) - the gradient is the brand's own
// indigo -> violet, not tied to any single destination app (WhatsApp,
// Maps, etc.) since the product now fans out to several.
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/>
      <stop offset="1" stop-color="#a855f7"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <rect x="38" y="30" width="52" height="72" rx="10" fill="#fff" fill-opacity="0.16"/>
  <rect x="38" y="30" width="52" height="72" rx="10" fill="none" stroke="#fff" stroke-width="4.5"/>
  <rect x="52" y="24" width="24" height="14" rx="5" fill="#fff"/>
  <path d="M72 46 L50 78 L62 78 L56 104 L82 68 L68 68 Z" fill="#fde68a" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>
</svg>`;

const sizes = [16, 32, 48, 128];
const outDir = path.join(__dirname, 'chrome-extension', 'icons');
const agentDir = path.join(__dirname, 'desktop-agent', 'assets');

(async () => {
  for (const size of sizes) {
    const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    await sharp(buf).toFile(path.join(outDir, `icon${size}.png`));
  }

  // Desktop agent: tray icon (small) + full logo
  const tray = await sharp(Buffer.from(svg)).resize(32, 32).png().toBuffer();
  await sharp(tray).toFile(path.join(agentDir, 'tray.png'));
  const logo = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
  await sharp(logo).toFile(path.join(agentDir, 'logo.png'));

  // Multi-resolution .ico for the desktop agent's installer/app icon, so it
  // looks sharp in every Explorer view (list, details, large/extra-large).
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoPngPaths = [];
  for (const size of icoSizes) {
    const p = path.join(agentDir, `app-${size}.png`);
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(p);
    icoPngPaths.push(p);
  }
  const icoBuffer = await pngToIco(icoPngPaths);
  fs.writeFileSync(path.join(agentDir, 'app.ico'), icoBuffer);
  icoPngPaths.forEach((p) => fs.unlinkSync(p));

  console.log('Icons generated (PNG set + app.ico).');
})();

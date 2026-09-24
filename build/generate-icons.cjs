// One-off script: generates the PNG icon set + Windows .ico files from a
// single SVG source. Run with: node generate-icons.cjs
//
// TapAct mark (v3.0.0 rebrand from ActionClip): a stylized "T" whose
// crossbar doubles as a fingertip mid-tap, with a soft ripple ring under it
// — reads as "tap" + "act" without leaning on the old product's "Action"
// lightning-bolt-in-a-clipboard glyph (that mark is retired along with the
// name, to stay clear of the unrelated actionclip.app product it collided
// with). Frame/gradient follows the shared cross-tool badge treatment from
// STANDARDS.md §21: navy #0B1220 -> accent blue #2F6FED, rounded-square
// frame — only the glyph inside is product-specific.
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0B1220"/>
      <stop offset="55%" stop-color="#0B1220"/>
      <stop offset="1" stop-color="#2F6FED"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#g)"/>
  <!-- ripple ring beneath the tap point -->
  <circle cx="64" cy="88" r="17" fill="none" stroke="#5B9AFF" stroke-width="3" stroke-opacity="0.55"/>
  <circle cx="64" cy="88" r="26" fill="none" stroke="#5B9AFF" stroke-width="2.5" stroke-opacity="0.28"/>
  <!-- "T" stem -->
  <rect x="56" y="34" width="16" height="54" rx="7" fill="#ffffff"/>
  <!-- "T" crossbar, doubling as the fingertip that lands on the ripple -->
  <rect x="30" y="30" width="68" height="16" rx="8" fill="#ffffff"/>
  <!-- tap point accent -->
  <circle cx="64" cy="88" r="7" fill="#fde68a"/>
</svg>`;

const sizes = [16, 32, 48, 128];
const outDir = path.join(__dirname, '..', 'chrome-extension', 'icons');
const agentDir = path.join(__dirname, '..', 'desktop-agent', 'assets');

// Minimal ICO packer using PNG-compressed frames (supported by Windows
// since Vista) — avoids depending on png-to-ico, which isn't installed
// anywhere reachable from this repo.
function buildIco(pngBuffers, sizes) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * count;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  for (let i = 0; i < count; i++) {
    const size = sizes[i];
    const buf = pngBuffers[i];
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // size of image data
    entry.writeUInt32LE(offset, 12); // offset of image data
    dirEntries.push(entry);
    offset += buf.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers]);
}

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
  const icoPngBuffers = [];
  for (const size of icoSizes) {
    const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    icoPngBuffers.push(buf);
  }
  const icoBuffer = buildIco(icoPngBuffers, icoSizes);
  fs.writeFileSync(path.join(agentDir, 'app.ico'), icoBuffer);

  console.log('Icons generated (PNG set + app.ico).');
})();

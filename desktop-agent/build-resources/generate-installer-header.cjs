// Generates the NSIS assisted-installer bitmaps — the header banner
// (MUI_HEADERIMAGE, shown atop the License/Directory/Install/Finish pages)
// and the welcome/finish sidebar (MUI_WELCOMEFINISHPAGE_BITMAP) — from the
// app's real logo. Electron-builder wires these up as `nsis.installerHeader`
// / `nsis.installerSidebar`; see package.json.
//
// The sidebar uses the shared cross-product installer palette from
// STANDARDS.md §21 ("IObit-style" unified branding): OptiGuard, Playnest,
// ActionClip and SnapCap all share the same dark base + accent-blue gradient
// in their installer wizard so the four tools read as one company's suite —
// only the logo mark + product name/tagline inside stay ActionClip-specific.
// Reference implementation: Playnest's build/make-installer-graphics.cjs,
// which already generates this exact shared banner.
//
// NSIS's MUI_HEADERIMAGE_BITMAP/MUI_WELCOMEFINISHPAGE_BITMAP must be plain
// 24-bit BMPs (no alpha) — sharp doesn't emit BMP, so we rasterize to raw
// RGB and write the BMP container by hand.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const desktopAgentDir = path.join(__dirname, '..');
const logoPath = path.join(desktopAgentDir, 'assets', 'logo.png');
const headerOutPath = path.join(__dirname, 'installerHeader.bmp');
const sidebarOutPath = path.join(__dirname, 'installer-sidebar.bmp');

const WIDTH = 150;
const HEIGHT = 57;
const SIDEBAR_WIDTH = 164;
const SIDEBAR_HEIGHT = 314;

// `channels` must reflect the ACTUAL stride of rawBuffer (3 for RGB, 4 for
// RGBA) — sharp's .raw() can still emit 4 channels here even after
// .flatten()+.removeAlpha() depending on the pipeline, and silently
// assuming 3 produces a badly-misaligned, static-like image (every pixel
// read from the wrong offset) instead of erroring, so this takes the real
// channel count explicitly rather than guessing.
function writeBmp24(rawBuffer, width, height, channels, outFile) {
  const rowSize = Math.ceil((width * 3) / 4) * 4; // rows padded to 4-byte boundary
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buf = Buffer.alloc(fileSize);
  // BITMAPFILEHEADER
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6);
  buf.writeUInt32LE(54, 10); // pixel data offset

  // BITMAPINFOHEADER
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26); // planes
  buf.writeUInt16LE(24, 28); // bits per pixel
  buf.writeUInt32LE(0, 30); // no compression
  buf.writeUInt32LE(pixelArraySize, 34);
  buf.writeInt32LE(2835, 38); // ~72 DPI
  buf.writeInt32LE(2835, 42);
  buf.writeUInt32LE(0, 46);
  buf.writeUInt32LE(0, 50);

  // Pixel data: BMP rows are stored bottom-up, BGR order, padded per row.
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    const rowStart = 54 + y * rowSize;
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcY * width + x) * channels;
      const dstIdx = rowStart + x * 3;
      buf[dstIdx] = rawBuffer[srcIdx + 2]; // B
      buf[dstIdx + 1] = rawBuffer[srcIdx + 1]; // G
      buf[dstIdx + 2] = rawBuffer[srcIdx]; // R
    }
  }
  fs.writeFileSync(outFile, buf);
}

async function main() {
  // Header banner: white background bar with the app mark + wordmark, left
  // margin per MUI_HEADERIMAGE_RIGHT="" default (left-aligned strip content).
  // White background per NSIS convention (the strip sits above the page
  // content, not part of the dark brand banner below) — wordmark uses the
  // shared accent blue so it still reads as the same brand as the sidebar.
  const markSize = 34;
  const markX = 10;
  const markY = Math.round((HEIGHT - markSize) / 2);

  const headerLogoBuf = await sharp(logoPath).resize(markSize, markSize).png().toBuffer();

  const header = `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>
      <text x="${markX + markSize + 8}" y="35" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" fill="#2F6FED">ActionClip</text>
    </svg>`;

  const { data: headerData, info: headerInfo } = await sharp(Buffer.from(header))
    .composite([{ input: headerLogoBuf, left: markX, top: markY }])
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  writeBmp24(headerData, WIDTH, HEIGHT, headerInfo.channels, headerOutPath);
  console.log(`Generated ${path.relative(process.cwd(), headerOutPath)} (${WIDTH}x${HEIGHT})`);

  // Welcome/finish sidebar: shared cross-product brand banner (STANDARDS.md
  // §21). Dark base -> accent-blue gradient, logo badge with an accent glow
  // ring, product name + short tagline — same treatment as Playnest's
  // sidebar, only the logo mark and copy are ActionClip-specific.
  const badgeSize = 100;
  const badgeX = Math.round((SIDEBAR_WIDTH - badgeSize) / 2);
  const badgeY = 58;
  const logoInsetSize = 68;
  const logoInsetX = badgeX + Math.round((badgeSize - logoInsetSize) / 2);
  const logoInsetY = badgeY + Math.round((badgeSize - logoInsetSize) / 2);

  const sidebarLogoBuf = await sharp(logoPath).resize(logoInsetSize, logoInsetSize).png().toBuffer();

  const sidebar = `
    <svg width="${SIDEBAR_WIDTH}" height="${SIDEBAR_HEIGHT}" viewBox="0 0 ${SIDEBAR_WIDTH} ${SIDEBAR_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0B1220"/>
          <stop offset="55%" stop-color="#0B1220"/>
          <stop offset="100%" stop-color="#2F6FED"/>
        </linearGradient>
      </defs>
      <rect width="${SIDEBAR_WIDTH}" height="${SIDEBAR_HEIGHT}" fill="url(#bg)"/>
      <rect x="0" y="274" width="${SIDEBAR_WIDTH}" height="40" fill="#5B9AFF" opacity="0.16"/>
      <circle cx="${badgeX + badgeSize / 2}" cy="${badgeY + badgeSize / 2}" r="${badgeSize / 2}"
        fill="rgba(255,255,255,0.08)" stroke="#5B9AFF" stroke-width="2" stroke-opacity="0.55"/>
      <text x="82" y="200" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" fill="#EAEAEA">ActionClip</text>
      <text x="82" y="222" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="10.5" fill="#94A3B8">Smart clipboard</text>
      <text x="82" y="236" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="10.5" fill="#94A3B8">actions</text>
    </svg>`;

  const { data: sidebarData, info: sidebarInfo } = await sharp(Buffer.from(sidebar))
    .composite([{ input: sidebarLogoBuf, left: logoInsetX, top: logoInsetY }])
    .flatten({ background: '#0B1220' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  writeBmp24(sidebarData, SIDEBAR_WIDTH, SIDEBAR_HEIGHT, sidebarInfo.channels, sidebarOutPath);
  console.log(`Generated ${path.relative(process.cwd(), sidebarOutPath)} (${SIDEBAR_WIDTH}x${SIDEBAR_HEIGHT})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Generates the NSIS assisted-installer header banner (MUI_HEADERIMAGE,
// shown atop the License/Directory/Install/Finish pages) from the app's
// real logo + brand gradient (assets/BRAND.md), so those pages match the
// already-branded welcome/finish sidebar instead of falling back to NSIS's
// generic default header. Electron-builder wires this up as
// `nsis.installerHeader`; see package.json.
//
// NSIS's MUI_HEADERIMAGE_BITMAP must be a plain 24-bit BMP (no alpha) —
// sharp doesn't emit BMP, so we rasterize to raw RGB and write the BMP
// container by hand (same approach as Playnest's build/make-installer-graphics.cjs).
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const desktopAgentDir = path.join(__dirname, '..');
const logoPath = path.join(desktopAgentDir, 'assets', 'logo.png');
const outPath = path.join(__dirname, 'installerHeader.bmp');

const WIDTH = 150;
const HEIGHT = 57;

function writeBmp24(rawRgbBuffer, width, height, outFile) {
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
      const srcIdx = (srcY * width + x) * 3;
      const dstIdx = rowStart + x * 3;
      buf[dstIdx] = rawRgbBuffer[srcIdx + 2]; // B
      buf[dstIdx + 1] = rawRgbBuffer[srcIdx + 1]; // G
      buf[dstIdx + 2] = rawRgbBuffer[srcIdx]; // R
    }
  }
  fs.writeFileSync(outFile, buf);
}

async function main() {
  // White background bar with the app mark + wordmark right-aligned, matching
  // MUI_HEADERIMAGE_RIGHT and the same layout convention Playnest uses.
  const markSize = 34;
  const markX = WIDTH - markSize - 78;
  const markY = Math.round((HEIGHT - markSize) / 2);

  const logoBuf = await sharp(logoPath).resize(markSize, markSize).png().toBuffer();

  const header = `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>
      <text x="${markX + markSize + 8}" y="35" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700" fill="#1a1f2e">ActionClip</text>
    </svg>`;

  const { data } = await sharp(Buffer.from(header))
    .composite([{ input: logoBuf, left: markX, top: markY }])
    .flatten({ background: '#ffffff' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  writeBmp24(data, WIDTH, HEIGHT, outPath);
  console.log(`Generated ${path.relative(process.cwd(), outPath)} (${WIDTH}x${HEIGHT})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

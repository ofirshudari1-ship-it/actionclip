// zip-writer.test.js — the dependency-free ZIP writer used by the
// diagnostics export (Settings ▸ About ▸ "ייצוא קובץ אבחון"). Since Node has
// no built-in unzip, this test parses the produced buffer back out by hand
// (local file headers -> payload -> inflate if needed) rather than trusting
// createZip's own bookkeeping, so a bug in the offsets/sizes it writes would
// actually be caught here.

const zlib = require('zlib');
const { createZip, crc32 } = require('../src/lib/zip-writer');

function readEntriesFromZip(buf) {
  const entries = [];
  let offset = 0;
  while (offset < buf.length) {
    const sig = buf.readUInt32LE(offset);
    if (sig !== 0x04034b50) break; // stop at first non-local-file-header (central dir)
    const method = buf.readUInt16LE(offset + 8);
    const crc = buf.readUInt32LE(offset + 14);
    const compSize = buf.readUInt32LE(offset + 18);
    const uncompSize = buf.readUInt32LE(offset + 22);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = buf.slice(nameStart, nameStart + nameLen).toString('utf8');
    const dataStart = nameStart + nameLen + extraLen;
    const compData = buf.slice(dataStart, dataStart + compSize);
    const data = method === 8 ? zlib.inflateRawSync(compData) : compData;
    entries.push({ name, data, crc, uncompSize });
    offset = dataStart + compSize;
  }
  return entries;
}

describe('createZip', () => {
  test('round-trips a single small text file', () => {
    const files = [{ name: 'system-info.txt', content: 'TapAct version: 3.4.0\r\n' }];
    const zip = createZip(files);
    const entries = readEntriesFromZip(zip);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('system-info.txt');
    expect(entries[0].data.toString('utf8')).toBe('TapAct version: 3.4.0\r\n');
  });

  test('round-trips multiple files including one with Hebrew content', () => {
    const files = [
      { name: 'version.json', content: JSON.stringify({ version: '3.4.0' }) },
      { name: 'tapact.log', content: '[2026-09-25T00:00:00.000Z] [INFO] TapAct started\n' },
      { name: 'settings-redacted.json', content: JSON.stringify({ leadSettings: { webhookUrl: '[הוסר לצורך פרטיות]' } }) }
    ];
    const zip = createZip(files);
    const entries = readEntriesFromZip(zip);
    expect(entries.map((e) => e.name)).toEqual(['version.json', 'tapact.log', 'settings-redacted.json']);
    entries.forEach((entry, i) => {
      const originalBuf = Buffer.from(files[i].content, 'utf8');
      expect(entry.data.equals(originalBuf)).toBe(true);
      expect(entry.crc).toBe(crc32(originalBuf));
      expect(entry.uncompSize).toBe(originalBuf.length);
    });
  });

  test('handles an empty file list without throwing', () => {
    const zip = createZip([]);
    expect(Buffer.isBuffer(zip)).toBe(true);
    expect(readEntriesFromZip(zip)).toHaveLength(0);
  });

  test('accepts Buffer content directly (e.g. a binary log file read via fs.readFileSync)', () => {
    const buf = Buffer.from([0, 1, 2, 255, 254, 253]);
    const zip = createZip([{ name: 'bin.dat', content: buf }]);
    const entries = readEntriesFromZip(zip);
    expect(entries[0].data.equals(buf)).toBe(true);
  });
});

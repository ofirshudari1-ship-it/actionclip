// Runs automatically before every `npm run dist` (see package.json's
// "predist" script). Without this, dist/ silently accumulated every past
// installer build forever - by the time this was noticed there were 8 old
// TapAct/ActionClip installers sitting there (~850MB), none of them the
// current version, with nothing to tell them apart at a glance. Every other
// tool in this portfolio already cleans up stale installers as part of its
// own build script (OptiGuard's build.ps1, Playnest's
// finalize-installer.cjs, SnapCap's build_installer.py) - this brings
// TapAct in line with that.
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) process.exit(0);

const stalePatterns = [/^TapAct-Setup-.*\.exe(\.blockmap)?$/i, /^ActionClip-Setup-.*\.exe(\.blockmap)?$/i];

for (const name of fs.readdirSync(distDir)) {
  if (stalePatterns.some((re) => re.test(name))) {
    fs.unlinkSync(path.join(distDir, name));
    console.log(`predist: removed stale installer artifact ${name}`);
  }
}

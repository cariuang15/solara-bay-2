// Ambil 4 screenshot game lewat Chrome headless (adegan ?shot=),
// lalu ubah ke JPEG di screenshots/ (maks 256 KiB tiap berkas).
// Jalankan dari repo: node tools/take-shots.mjs
import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, Tab, sleep } from './cdp.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const shotsDir = join(root, 'screenshots');
mkdirSync(shotsDir, { recursive: true });

const SCENES = [
  { name: '1-judul.jpg', shot: 'judul', seed: 7 },
  { name: '2-kota.jpg', shot: 'kota', seed: 11 },
  { name: '3-kejaran.jpg', shot: 'kejaran', seed: 13 },
  { name: '4-misi.jpg', shot: 'misi', seed: 17 },
];

const server = spawn('node', ['serve.ts', '--port', '8080'], { cwd: root, stdio: 'ignore' });
await sleep(1500);

let chrome = null;
const failures = [];
try {
  chrome = await launchChrome();
  for (const scene of SCENES) {
    const url = `http://127.0.0.1:8080/?shot=${scene.shot}&seed=${scene.seed}`;
    const tab = await Tab.create(url);
    let ready = false;
    for (let i = 0; i < 30; i += 1) {
      await sleep(300);
      try {
        ready = await tab.evaluate('window.__shotReady === true');
      } catch {
        ready = false;
      }
      if (ready) break;
    }
    if (!ready) {
      failures.push(`${scene.shot}: __shotReady tidak muncul`);
      await tab.close();
      continue;
    }
    const pngPath = `/tmp/solara-${scene.shot}.png`;
    await tab.screenshot(pngPath);
    if (tab.consoleErrors.length > 0) {
      failures.push(`${scene.shot}: console error: ${tab.consoleErrors.join(' | ')}`);
    }
    await tab.close();
    // PNG -> JPEG (kualitas turun bertahap sampai <= 256 KiB).
    const outPath = join(shotsDir, scene.name);
    const convert = (quality) => {
      execSync(`python3 -c "from PIL import Image; im = Image.open('${pngPath}').convert('RGB'); im.save('${outPath}', 'JPEG', quality=${quality}, optimize=True)"`, { stdio: 'ignore' });
    };
    let quality = 84;
    convert(quality);
    const { statSync } = await import('node:fs');
    while (statSync(outPath).size > 262144 && quality > 55) {
      quality -= 8;
      convert(quality);
    }
    const size = statSync(outPath).size;
    console.log(`${scene.name}: ${size} byte (kualitas ${quality})${size > 262144 ? ' TERLALU BESAR' : ''}`);
    if (size > 262144) failures.push(`${scene.name}: ${size} byte > 256 KiB`);
    if (!existsSync(pngPath)) failures.push(`${scene.shot}: PNG tidak terbentuk`);
  }
} finally {
  if (chrome) chrome.kill();
  server.kill();
}

if (failures.length > 0) {
  console.error('GAGAL:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('Semua screenshot OK.');

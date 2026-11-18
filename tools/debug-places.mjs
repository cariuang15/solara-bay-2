// Debug: apakah titik-titik misi berada di dalam gedung?
import { spawn } from 'node:child_process';
import { launchChrome, Tab, sleep } from './cdp.mjs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = spawn('node', ['serve.ts', '--port', '8080'], { cwd: root, stdio: 'ignore' });
await sleep(1500);
let chrome = null;
try {
  chrome = await launchChrome();
  const tab = await Tab.create('http://127.0.0.1:8080/?seed=99');
  await sleep(2000);
  const report = await tab.evaluate(`(() => {
    const w = window.__solara.world;
    const city = w.city;
    const out = [];
    const places = {
      rumahRosa: [980, 1860], tokoRosa: [980, 1760], bank: [1680, 700],
      dermaga: [2100, 2480], kasino: [2940, 420], marina: [220, 2320],
      rumahSakit: [1260, 1240], kantorPolisi: [2520, 1240],
      rumahAman: [700, 560], plaza: [1680, 1300], balapStart: [240, 420],
    };
    for (const [name, [x, y]] of Object.entries(places)) {
      const hit = city.buildings.find((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
      out.push(name + ': ' + (hit ? 'DI DALAM GEDUNG (' + Math.round(hit.x) + ',' + Math.round(hit.y) + ' ' + Math.round(hit.w) + 'x' + Math.round(hit.h) + ')' : 'bebas'));
    }
    return out;
  })()`);
  console.log(report.join('\n'));
  await tab.close();
} finally {
  if (chrome) chrome.kill();
  server.kill();
}

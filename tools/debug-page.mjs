// Debug cepat: buka game, laporkan URL, judul, dan __solara.
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
  await sleep(3000);
  console.log('URL:', await tab.evaluate('window.location.href'));
  console.log('Title:', await tab.evaluate('document.title'));
  console.log('__solara:', await tab.evaluate(`typeof window.__solara`));
  console.log('canvas:', await tab.evaluate(`!!document.getElementById('game')`));
  console.log('status:', await tab.evaluate(`document.getElementById('status').textContent`));
  console.log('consoleErrors:', JSON.stringify(tab.consoleErrors));
  await tab.close();
} finally {
  if (chrome) chrome.kill();
  server.kill();
}

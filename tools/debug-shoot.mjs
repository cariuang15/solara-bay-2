// Debug tembakan: klik CDP vs klik sintetis lewat JS.
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
  await tab.press('Enter', 'Enter');
  await sleep(500);
  const shots = () => tab.evaluate(`window.__solara.world.stats.shots`);
  console.log('tembakan awal:', await shots());
  // Klik CDP di tengah kanan layar (dengan mouseMoved dulu + pointerType).
  await tab.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1000, y: 200, button: 'none' });
  await sleep(100);
  await tab.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 1000, y: 200, button: 'left', clickCount: 1, pointerType: 'mouse' });
  await sleep(50);
  await tab.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1000, y: 200, button: 'left', clickCount: 1, pointerType: 'mouse' });
  await sleep(500);
  console.log('tembakan setelah klik CDP:', await shots());
  // Klik sintetis lewat JS (PointerEvent langsung ke canvas).
  await tab.evaluate(`(() => {
    const canvas = document.getElementById('game');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: rect.left + 1000, clientY: rect.top + 200, bubbles: true }));
    return true;
  })()`);
  await sleep(500);
  console.log('tembakan setelah klik sintetis:', await shots());
  console.log('consoleErrors:', JSON.stringify(tab.consoleErrors));
  await tab.close();
} finally {
  if (chrome) chrome.kill();
  server.kill();
}

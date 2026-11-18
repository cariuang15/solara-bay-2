// Pengemudi Chrome headless lewat DevTools Protocol (WebSocket bawaan
// Node 22+): buka halaman, kirim tombol, baca keadaan game, dan ambil
// screenshot. Dipakai skrip take-shots.mjs dan playtest.mjs.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const CHROME = '/opt/meta-chromium/chrome';
const PORT = 9222;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(path) {
  const response = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return response.json();
}

/** Luncurkan Chrome headless dengan remote debugging; kembalikan prosesnya. */
export async function launchChrome() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=' + PORT,
    '--window-size=1280,720',
    '--hide-scrollbars',
    '--user-data-dir=/tmp/solara-chrome-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 40; i += 1) {
    try {
      await getJson('/json/version');
      return chrome;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('Chrome tidak menjawab di port debugging');
}

/** Satu tab baru dengan CDP: navigasi, evaluasi, tombol, dan screenshot. */
export class Tab {
  constructor(ws, targetId) {
    this.ws = ws;
    this.targetId = targetId;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails;
        this.consoleErrors.push('EXCEPTION: ' + (details.exception?.description || details.text));
      }
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        this.consoleErrors.push('CONSOLE: ' + message.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
      }
    };
  }

  static async create(url) {
    // /json/new mengambil URL mentah sebagai query string (tanpa encode).
    const target = await fetch(`http://127.0.0.1:${PORT}/json/new?${url}`, { method: 'PUT' }).then((r) => r.json());
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve) => ws.onopen = resolve);
    const tab = new Tab(ws, target.id);
    await tab.send('Runtime.enable');
    await tab.send('Page.enable');
    return tab;
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('CDP timeout: ' + method));
        }
      }, 15000);
    });
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await sleep(1200);
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error('Evaluate gagal: ' + (result.exceptionDetails.exception?.description || ''));
    return result.result.value;
  }

  async key(type, code, keyValue) {
    await this.send('Input.dispatchKeyEvent', { type, code, key: keyValue, windowsVirtualKeyCode: 0 });
  }

  async press(code, keyValue) {
    await this.key('keyDown', code, keyValue);
    await sleep(60);
    await this.key('keyUp', code, keyValue);
  }

  async hold(code, keyValue, ms) {
    await this.key('keyDown', code, keyValue);
    await sleep(ms);
    await this.key('keyUp', code, keyValue);
  }

  /** Klik di (x, y): CDP mouse di headless ini tidak membangkitkan
   *  pointerdown, jadi kirim PointerEvent sintetis ke elemen di titik itu
   *  (pendengar pointerdown game tetap yang menangani). */
  async click(x, y) {
    await this.evaluate(`(() => {
      const target = document.elementFromPoint(${x}, ${y}) || document.getElementById('game');
      const rect = target.getBoundingClientRect();
      target.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: rect.left + ${x}, clientY: rect.top + ${y}, bubbles: true,
      }));
      target.dispatchEvent(new PointerEvent('pointerup', {
        clientX: rect.left + ${x}, clientY: rect.top + ${y}, bubbles: true,
      }));
      return true;
    })()`);
  }

  async screenshot(path) {
    const result = await this.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path, Buffer.from(result.data, 'base64'));
  }

  async close() {
    try {
      await fetch(`http://127.0.0.1:${PORT}/json/close/${this.targetId}`);
    } catch {
      // Sudah tertutup.
    }
    this.ws.close();
  }
}

export { sleep };

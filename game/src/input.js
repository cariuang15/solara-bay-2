// Masukan pemain: kibor dan tetikus. Tombol yang ditahan memberi arah;
// penekanan sekali (jeda, bantuan, masuk mobil, pukul, simpan) diantrekan
// sebagai peristiwa dan diambil sekali oleh putaran game, jadi tidak ada
// penekanan yang hilang atau terhitung dua kali.

export const EVENT_PAUSE = 1;
export const EVENT_HELP = 2;
export const EVENT_ENTER = 4;
export const EVENT_PUNCH = 8;
export const EVENT_SAVE = 16;
export const EVENT_MUTE = 32;
export const EVENT_CONFIRM = 64;

/** Kode tombol untuk tiap aksi. */
const KEYS = {
  up: new Set(['KeyW', 'ArrowUp']),
  down: new Set(['KeyS', 'ArrowDown']),
  left: new Set(['KeyA', 'ArrowLeft']),
  right: new Set(['KeyD', 'ArrowRight']),
  run: new Set(['ShiftLeft', 'ShiftRight']),
  pause: new Set(['KeyP', 'Escape']),
  help: new Set(['KeyH']),
  enter: new Set(['KeyE']),
  punch: new Set(['KeyF']),
  save: new Set(['KeyL']),
  mute: new Set(['KeyM']),
  confirm: new Set(['Enter', 'Space']),
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  let queued = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseClicked = false;
  let mouseDown = false;

  function match(code, set) {
    return set.has(code);
  }

  window.addEventListener('keydown', (event) => {
    if (match(event.code, KEYS.up)) held.up = true;
    else if (match(event.code, KEYS.down)) held.down = true;
    else if (match(event.code, KEYS.left)) held.left = true;
    else if (match(event.code, KEYS.right)) held.right = true;
    else if (match(event.code, KEYS.run)) held.run = true;
    else if (match(event.code, KEYS.pause)) { if (!event.repeat) queued |= EVENT_PAUSE; }
    else if (match(event.code, KEYS.help)) { if (!event.repeat) queued |= EVENT_HELP; }
    else if (match(event.code, KEYS.enter)) { if (!event.repeat) queued |= EVENT_ENTER; }
    else if (match(event.code, KEYS.punch)) { if (!event.repeat) queued |= EVENT_PUNCH; }
    else if (match(event.code, KEYS.save)) { if (!event.repeat) queued |= EVENT_SAVE; }
    else if (match(event.code, KEYS.mute)) { if (!event.repeat) queued |= EVENT_MUTE; }
    else if (match(event.code, KEYS.confirm)) { if (!event.repeat) queued |= EVENT_CONFIRM; }
    else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (match(event.code, KEYS.up)) held.up = false;
    else if (match(event.code, KEYS.down)) held.down = false;
    else if (match(event.code, KEYS.left)) held.left = false;
    else if (match(event.code, KEYS.right)) held.right = false;
    else if (match(event.code, KEYS.run)) held.run = false;
  });

  // Tombol yang dilepas saat tab disembunyikan tidak mengirim keyup: lepas semuanya.
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.run = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    mouseClicked = true;
    event.preventDefault();
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  return {
    /** Arah gerak -1/0/1 di tiap sumbu dari tombol yang ditahan. */
    axes() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
        run: held.run,
      };
    },
    /** Posisi tetikus dalam piksel kanvas (diskalakan ke logis oleh pemanggil). */
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    /** Benar sekali setelah satu klik tetikus; dibersihkan saat dibaca. */
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    /** Peristiwa sekali-tekan sejak panggilan terakhir, sebagai bendera EVENT_*.
     *  Hanya bendera dalam `mask` yang diambil; sisanya tetap antre untuk
     *  pembaca lain (layar mengambil jeda/bantuan, dunia mengambil E/F). */
    takeEvents(mask = 0xffff) {
      const taken = queued & mask;
      queued &= ~mask;
      return taken;
    },
  };
}

/** Masukan sintetis untuk adegan screenshot dan pengujian: arah dan tombol palsu. */
export function makeScriptedInput() {
  const axes = { x: 0, y: 0, run: false };
  let click = false;
  return {
    axes() {
      return axes;
    },
    mouse() {
      return { x: 0, y: 0, down: false };
    },
    takeClick() {
      const value = click;
      click = false;
      return value;
    },
    takeEvents() {
      return 0;
    },
    /** Atur arah mengemudi: x -1/0/1, y -1/0/1 (y -1 berarti maju). */
    steer(x, y, run = false) {
      axes.x = x;
      axes.y = y;
      axes.run = run;
    },
    pressClick() {
      click = true;
    },
  };
}

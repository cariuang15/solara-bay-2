// Boot dan putaran utama: baca masukan tiap bingkai, majukan dunia dalam
// langkah tetap 1/60 detik, dan gambar hasilnya. Layar: judul, main,
// jeda, bantuan, tumbang, tertangkap, dan cerita selesai.
//
// ?seed=N memakai biji tetap. ?shot=judul|kota|kejaran|misi (dengan
// &seed=N) menyiapkan adegan itu, menggambarnya dua kali, lalu menandai
// window.__shotReady untuk screenshot.
import { createAudio } from './audio.js';
import { createInput, EVENT_CONFIRM, EVENT_ENTER, EVENT_HELP, EVENT_MUTE, EVENT_PAUSE, EVENT_SAVE } from './input.js';
import { createWorld, EVENT_BUSTED, EVENT_DEAD, EVENT_MISSION_DONE, EVENT_STORY_DONE, nearMissionStart, resetWorld, stepWorld, tryStartMission } from './world.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_HELP, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE } from './render.js';
import { applySave, clearSave, loadSave, saveGame } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
/** Bingkai terpanjang yang dikejar; jeda lebih lama (tab tersembunyi) dibuang. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(seed);
world.audio = audio;
const renderer = createRenderer(canvas);

function announce(message) {
  status.textContent = message;
}

/** Jalankan satu adegan screenshot dan tandai siap. */
function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, { muted: false, saveExists: false, saveNote: '' });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** Jalankan permainan biasa dengan semua layarnya. */
function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let saveData = loadSave();
  let saveNote = '';
  let saveNoteTimer = 0;
  let accumulator = 0;
  let last = performance.now();

  world.onMissionComplete = (def) => {
    saveGame(world, audio.isMuted());
    announce(`Misi selesai: ${def.title}.`);
  };
  world.onMissionFailed = (def, reason) => {
    if (audio) audio.missionFail();
    announce(`Misi gagal: ${reason}.`);
  };

  function showSaveNote(text) {
    saveNote = text;
    saveNoteTimer = 3;
  }

  function startNewGame() {
    resetWorld(world, Math.floor(Math.random() * 4294967296));
    clearSave();
    saveData = null;
    screen = SCREEN_PLAY;
    announce('Solara Bay. Pergi ke Rumah Mama Rosa untuk misi pertama.');
  }

  function continueSave() {
    if (!saveData) return;
    resetWorld(world, Math.floor(Math.random() * 4294967296));
    applySave(world, saveData);
    screen = SCREEN_PLAY;
    announce('Melanjutkan simpanan.');
  }

  function doSave() {
    if (saveGame(world, audio.isMuted())) showSaveNote('Permainan disimpan!');
    else showSaveNote('Gagal menyimpan (penyimpanan peramban mati).');
  }

  function handleEvents() {
    // Tombol global: suara (M) dan simpan (L) berlaku di layar main/jeda.
    const globalEvents = input.takeEvents(EVENT_MUTE | EVENT_SAVE);
    if (globalEvents & EVENT_MUTE) {
      const muted = audio.toggleMute();
      showSaveNote(muted ? 'Suara dimatikan (M).' : 'Suara dinyalakan (M).');
    }
    if (globalEvents & EVENT_SAVE && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      doSave();
    }
    if (screen === SCREEN_TITLE) {
      const events = input.takeEvents(EVENT_CONFIRM | EVENT_ENTER);
      if (events & EVENT_CONFIRM) startNewGame();
      else if (events & EVENT_ENTER && saveData) continueSave();
      return;
    }
    if (screen === SCREEN_PLAY) {
      const events = input.takeEvents(EVENT_PAUSE | EVENT_HELP);
      if (events & EVENT_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Jeda.');
      } else if (events & EVENT_HELP) {
        screen = SCREEN_HELP;
        announce('Bantuan.');
      } else if (nearMissionStart(world)) {
        // Di dekat Rumah Rosa, E (atau Enter) memulai misi berikutnya.
        const interact = input.takeEvents(EVENT_ENTER | EVENT_CONFIRM);
        if (interact) {
          const intro = tryStartMission(world);
          if (intro) announce(intro);
        }
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      const events = input.takeEvents(EVENT_PAUSE | EVENT_HELP);
      if (events & EVENT_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Lanjut main.');
      } else if (events & EVENT_HELP) {
        screen = SCREEN_HELP;
      }
      return;
    }
    if (screen === SCREEN_HELP) {
      const events = input.takeEvents(EVENT_HELP | EVENT_PAUSE);
      if (events) screen = SCREEN_PLAY;
      return;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      const events = input.takeEvents(EVENT_CONFIRM);
      if (events & EVENT_CONFIRM) {
        world.player.health = 100;
        screen = SCREEN_PLAY;
        announce('Lanjut main.');
      }
      return;
    }
    if (screen === SCREEN_STORY) {
      const events = input.takeEvents(EVENT_CONFIRM);
      if (events & EVENT_CONFIRM) screen = SCREEN_PLAY;
    }
  }

  function step() {
    const result = stepWorld(world, STEP, input);
    if (result & EVENT_BUSTED) {
      screen = SCREEN_BUSTED;
      announce('Tertangkap polisi.');
    } else if (result & EVENT_DEAD) {
      screen = SCREEN_OVER;
      announce('Kamu tumbang.');
    } else if (result & EVENT_STORY_DONE) {
      screen = SCREEN_STORY;
      saveGame(world, audio.isMuted());
      announce('Cerita selesai!');
    } else if (result & EVENT_MISSION_DONE) {
      announce('Misi selesai.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleEvents();
    if (saveNoteTimer > 0) {
      saveNoteTimer -= Math.min(MAX_FRAME, accumulator);
      if (saveNoteTimer <= 0) saveNote = '';
    }
    if (screen === SCREEN_TITLE) {
      // Latar judul hidup: lalu lintas berjalan, pemain diam.
      while (accumulator >= STEP) {
        stepWorld(world, STEP, input);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, {
      muted: audio.isMuted(),
      saveExists: !!saveData,
      saveNote,
    });
  }

  // Buka audio saat interaksi pertama (peramban mengharuskan begitu).
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  // Meninggalkan tab menjeda permainan yang sedang berjalan.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Jeda.');
    }
  });

  // Pegangan debug untuk pengujian otomatis (bukan bagian permainan).
  window.__solara = {
    world,
    screen: () => screen,
    start: () => startNewGame(),
    saveData: () => loadSave(),
  };

  announce('Solara Bay. Tekan Enter untuk mulai.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

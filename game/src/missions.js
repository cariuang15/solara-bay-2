// Misi cerita: enam pekerjaan untuk Mama Rosa, dimainkan berurutan.
// Tiap misi punya tahap-tahap: pergi ke tempat, bertahan di dekat pintu,
// kabur dengan buron, atau balapan melewati pos-pos di pantai.

import { MISSIONS, PLACES } from './config.js';
import { createCar } from './vehicles.js';

/** Keadaan awal alur misi: belum ada misi yang selesai. */
export function createMissionState() {
  return {
    completed: 0, // jumlah misi yang sudah selesai
    active: null, // {def, stage, holdTimer, checkpoints, rivals, message}
    banner: null, // teks besar sesaat: {text, timer}
    toast: null, // pesan kecil: {text, timer}
  };
}

/** Misi berikutnya yang bisa dimulai (atau null bila cerita tamat). */
export function nextMission(state) {
  return state.completed < MISSIONS.length ? MISSIONS[state.completed] : null;
}

/** Titik di mana misi berikutnya dimulai (Rumah Mama Rosa). */
export function missionStartPoint() {
  return PLACES.rumahRosa;
}

/** Mulai misi yang sedang aktif. Mengembalikan teks pembuka. */
export function startMission(state, world) {
  const def = nextMission(state);
  if (!def || state.active) return null;
  const active = {
    def,
    stage: 0,
    holdTimer: 0,
    checkpoints: 0,
    rivals: [],
    failed: false,
  };
  state.active = active;
  // Balapan: siapkan dua mobil rival di garis start pantai.
  if (def.id === 5) {
    const rivalKinds = ['sport', 'sedan'];
    for (let i = 0; i < 2; i += 1) {
      const car = createCar(rivalKinds[i], PLACES.balapStart.x + 60 + i * 40, PLACES.balapStart.y + 60 + i * 30, Math.PI / 2);
      car.driver = 'rival';
      car.rivalCheckpoint = 0;
      car.speed = 0;
      active.rivals.push(car);
      world.cars.push(car);
    }
    // Pemain dipindah ke garis start.
    world.player.x = PLACES.balapStart.x;
    world.player.y = PLACES.balapStart.y + 120;
    if (world.player.inCar) {
      world.player.inCar.x = world.player.x;
      world.player.inCar.y = world.player.y;
      world.player.inCar.angle = Math.PI / 2;
      world.player.inCar.speed = 0;
    }
  }
  if (def.wanted) {
    world.setWanted(def.wanted);
  }
  showBanner(state, def.title);
  return def.intro;
}

/** Tampilkan spanduk besar selama 3 detik. */
export function showBanner(state, text) {
  state.banner = { text, timer: 3 };
}

/** Tampilkan pesan kecil selama 4 detik. */
export function showToast(state, text) {
  state.toast = { text, timer: 4 };
}

/** Tujuan misi aktif saat ini: teks dan titik penanda di peta. */
export function currentObjective(state) {
  if (!state.active) {
    const next = nextMission(state);
    if (!next) return { text: 'Cerita selesai! Jelajahi Solara Bay sesukamu.', point: null };
    return { text: `Misi ${next.id}: ${next.title} — pergi ke Rumah Mama Rosa`, point: PLACES.rumahRosa };
  }
  const { def, stage } = state.active;
  const step = def.stages[stage];
  if (!step) return { text: '', point: null };
  if (step.kind === 'race') {
    const cp = step.checkpoints[state.active.checkpoints];
    return {
      text: `${step.text} (${state.active.checkpoints}/${step.checkpoints.length} pos)`,
      point: cp || null,
    };
  }
  const place = PLACES[step.at];
  let text = step.text;
  if (step.kind === 'hold' && state.active.holdTimer > 0) {
    text += ` — ${Math.ceil(step.seconds - state.active.holdTimer)} detik lagi`;
  }
  return { text, point: place };
}

/** Selesaikan misi aktif: bayar, buka misi berikut, dan beri spanduk. */
function completeMission(state, world) {
  const active = state.active;
  const def = active.def;
  world.player.money += def.pay;
  state.completed += 1;
  state.active = null;
  // Pekerjaan selesai berarti lolos: panas buron langsung padam.
  world.setWanted(0);
  showBanner(state, `Misi selesai! +$${def.pay}`);
  world.onMissionComplete(def);
  return def;
}

/** Gagalkan misi aktif: kembali ke dunia bebas, bisa diulang. */
export function failMission(state, world, reason) {
  const active = state.active;
  if (!active) return;
  // Singkirkan mobil rival balapan dari dunia.
  for (const rival of active.rivals) {
    const index = world.cars.indexOf(rival);
    if (index >= 0) world.cars.splice(index, 1);
  }
  state.active = null;
  showBanner(state, `Misi gagal: ${reason}`);
  world.onMissionFailed(active.def, reason);
}

/** Jarak pemain (kaki atau mobil) ke sebuah titik. */
function distanceToPoint(world, point) {
  const px = world.player.inCar ? world.player.inCar.x : world.player.x;
  const py = world.player.inCar ? world.player.inCar.y : world.player.y;
  return Math.hypot(point.x - px, point.y - py);
}

/**
 * Majukan misi aktif satu langkah waktu. Menangani tiap jenis tahap:
 * goto (sampai di titik), hold (bertahan di dekat pintu), escape
 * (sampai sambil diburu), dan race (pos demi pos melawan rival).
 */
export function updateMissions(state, world, dt) {
  if (state.banner) {
    state.banner.timer -= dt;
    if (state.banner.timer <= 0) state.banner = null;
  }
  if (state.toast) {
    state.toast.timer -= dt;
    if (state.toast.timer <= 0) state.toast = null;
  }
  const active = state.active;
  if (!active) return;
  const def = active.def;
  const step = def.stages[active.stage];
  if (!step) {
    completeMission(state, world);
    return;
  }

  if (step.kind === 'goto' || step.kind === 'escape') {
    const place = PLACES[step.at];
    if (step.wanted && world.wanted.level < step.wanted) {
      world.setWanted(step.wanted);
    }
    if (distanceToPoint(world, place) < step.radius) {
      active.stage += 1;
      if (active.stage >= def.stages.length) {
        completeMission(state, world);
      } else {
        showToast(state, def.stages[active.stage].text);
      }
    }
    return;
  }

  if (step.kind === 'hold') {
    const place = PLACES[step.at];
    const dist = distanceToPoint(world, place);
    if (dist < step.radius) {
      active.holdTimer += dt;
      if (active.holdTimer >= step.seconds) {
        world.setWanted(def.id === 6 ? 5 : 3);
        active.stage += 1;
        active.holdTimer = 0;
        if (active.stage >= def.stages.length) completeMission(state, world);
        else showToast(state, def.stages[active.stage].text);
      }
    } else {
      active.holdTimer = Math.max(0, active.holdTimer - dt * 2);
    }
    return;
  }

  if (step.kind === 'race') {
    // Rival melaju dari pos ke pos.
    for (const rival of active.rivals) {
      const cp = step.checkpoints[rival.rivalCheckpoint];
      if (!cp) continue;
      const dx = cp.x - rival.x;
      const dy = cp.y - rival.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 70) {
        rival.rivalCheckpoint += 1;
        if (rival.rivalCheckpoint >= step.checkpoints.length) {
          failMission(state, world, 'Rival lebih dulu sampai garis akhir');
          return;
        }
        continue;
      }
      const want = Math.atan2(dy, dx);
      let diff = want - rival.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rival.angle += Math.max(-1, Math.min(1, diff * 2.5)) * 2.4 * dt;
      rival.speed = Math.min(330, rival.speed + 300 * dt);
      rival.x += Math.cos(rival.angle) * rival.speed * dt;
      rival.y += Math.sin(rival.angle) * rival.speed * dt;
    }
    // Pemain melewati pos berikutnya?
    const cp = step.checkpoints[active.checkpoints];
    if (cp && distanceToPoint(world, cp) < 80) {
      active.checkpoints += 1;
      if (active.checkpoints >= step.checkpoints.length) {
        completeMission(state, world);
      } else {
        showToast(state, `Pos ${active.checkpoints}/${step.checkpoints.length} terlewati!`);
      }
    }
  }
}

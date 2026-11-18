// Adegan screenshot: tiap adegan memainkan aturan sungguhan dari dunia
// baru berbiji tetap, dikemudikan autopilot sederhana, jadi bingkai yang
// diambil selalu sama. Dipanggil lewat ?shot=judul|kota|kejaran|misi.

import { createCar } from './vehicles.js';
import { makeScriptedInput } from './input.js';
import { resetWorld, setWantedLevel, stepWorld } from './world.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMission } from './missions.js';

const STEP = 1 / 60;

/** Selisih sudut ke [-PI, PI]. */
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Autopilot pure-pursuit: ikuti garis rute, bidik titik 260px di depan
 *  mobil sepanjang rute. Mobil tetap di jalan dan berbelok dengan halus. */
function autopilot(world, input, route) {
  const car = world.player.inCar;
  if (!car || route.length < 2) return;
  // Jarak sepanjang rute ke titik terdekat dari mobil.
  let bestDist = Infinity;
  let bestAlong = 0;
  let total = 0;
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby || 1;
    let t = ((car.x - a.x) * abx + (car.y - a.y) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + abx * t;
    const py = a.y + aby * t;
    const d = Math.hypot(car.x - px, car.y - py);
    const segLen = Math.sqrt(len2);
    if (d < bestDist) {
      bestDist = d;
      bestAlong = total + segLen * t;
    }
    total += segLen;
  }
  // Titik bidik: 260px di depan sepanjang rute.
  const lookahead = Math.min(total, bestAlong + 260);
  let acc = 0;
  let target = route[route.length - 1];
  for (let i = 0; i < route.length - 1; i += 1) {
    const a = route[i];
    const b = route[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + segLen >= lookahead) {
      const t = (lookahead - acc) / segLen;
      target = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      break;
    }
    acc += segLen;
  }
  const diff = wrapAngle(Math.atan2(target.y - car.y, target.x - car.x) - car.angle);
  const steer = Math.max(-1, Math.min(1, diff * 2.5));
  let throttle = Math.abs(diff) > 1.0 ? 0.35 : 1;
  // Mobil di depan: jangan menabrak — ikuti kecepatannya, tetap di rute.
  // (Jangan menggeser ke samping: itu yang mendorong mobil keluar jalan.)
  for (const other of [...world.cars, ...world.policeCars]) {
    if (other === car || other.wrecked) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = -ox * Math.sin(car.angle) + oy * Math.cos(car.angle);
    if (ahead > 0 && ahead < 150 && Math.abs(side) < 36) {
      const targetSpeed = Math.min(other.speed + 20, 300);
      throttle = car.speed < targetSpeed ? 0.6 : -0.6;
      break;
    }
  }
  input.steer(steer, -throttle);
}

/** Taruh Leo di dalam mobil sport di jalan, menghadap timur. */
function putPlayerInCar(world, x, y, angle) {
  const car = createCar('sport', x, y, angle);
  car.driver = 'pemain';
  car.speed = 120;
  world.cars.push(car);
  world.player.inCar = car;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
  world.camera.x = x;
  world.camera.y = y;
  return car;
}

/** Jalankan dunia selama `seconds` detik dengan autopilot mengikuti rute. */
function simulate(world, seconds, route) {
  const input = makeScriptedInput();
  const steps = Math.floor(seconds / STEP);
  // Pemulihan macet: bila mobil hampir tidak bergerak selama 0,5 detik
  // padahal seharusnya jalan, mundur sebentar lalu coba lagi.
  let checkX = world.player.inCar ? world.player.inCar.x : 0;
  let checkY = world.player.inCar ? world.player.inCar.y : 0;
  let reversing = 0;
  for (let i = 0; i < steps; i += 1) {
    const car = world.player.inCar;
    if (car && reversing > 0) {
      input.steer(0, 1); // mundur lurus
      reversing -= 1;
    } else if (route) {
      autopilot(world, input, route);
    }
    stepWorld(world, STEP, input);
    if (car && i % 30 === 29) {
      const moved = Math.hypot(car.x - checkX, car.y - checkY);
      if (moved < 20 && reversing === 0) reversing = 45;
      checkX = car.x;
      checkY = car.y;
    }
  }
}

/** Adegan judul: kota hidup di belakang layar judul. */
function stageTitle(world) {
  resetWorld(world, 7);
  simulate(world, 8, null);
  return { screen: SCREEN_TITLE };
}

/** Adegan kota: Leo mengemudi di jalan besar dengan lalu lintas dan HUD penuh. */
function stageCity(world) {
  resetWorld(world, 11);
  putPlayerInCar(world, 700, 760, 0);
  // Lurus ke timur sepanjang jalan besar — tanpa belokan tajam.
  simulate(world, 6, [
    { x: 700, y: 760 }, { x: 3300, y: 760 },
  ]);
  return { screen: SCREEN_PLAY };
}

/** Adegan kejar-kejaran: bintang tiga, mobil polisi mengejar dari belakang. */
function stageChase(world) {
  resetWorld(world, 13);
  putPlayerInCar(world, 700, 1160, 0);
  setWantedLevel(world, 3);
  // Dua mobil polisi sudah dekat di belakang Leo.
  for (const [dx, dy] of [[-260, -40], [-320, 50]]) {
    const car = createCar('polisi', 700 + dx, 1160 + dy, 0);
    car.driver = 'polisi';
    car.speed = 260;
    world.policeCars.push(car);
  }
  simulate(world, 5, [
    { x: 700, y: 1160 }, { x: 3300, y: 1160 },
  ]);
  return { screen: SCREEN_PLAY };
}

/** Adegan misi: tahap kabur misi bank, uang di tangan, polisi mengejar. */
function stageMission(world) {
  resetWorld(world, 17);
  world.missions.completed = 2;
  startMission(world.missions, world);
  // Lompat ke tahap kabur: uang sudah diambil, buron tiga bintang.
  const active = world.missions.active;
  active.stage = 2;
  setWantedLevel(world, 3);
  putPlayerInCar(world, 1680, 900, Math.PI / 2);
  for (const [dx, dy] of [[-220, -60], [-280, 60]]) {
    const car = createCar('polisi', 1680 + dx, 900 + dy, Math.PI / 2);
    car.driver = 'polisi';
    car.speed = 260;
    world.policeCars.push(car);
  }
  simulate(world, 5, [
    { x: 1680, y: 900 }, { x: 1680, y: 2300 },
  ]);
  return { screen: SCREEN_PLAY };
}

/**
 * Siapkan adegan bernama (judul, kota, kejaran, misi; nama lain = judul)
 * dan kembalikan layar yang harus digambar di atasnya.
 */
export function stageShot(name, world) {
  if (name === 'kota') return stageCity(world);
  if (name === 'kejaran') return stageChase(world);
  if (name === 'misi') return stageMission(world);
  return stageTitle(world);
}

/** Daftar adegan untuk skrip screenshot. */
export const SHOT_NAMES = ['judul', 'kota', 'kejaran', 'misi'];

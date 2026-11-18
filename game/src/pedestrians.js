// Pejalan kaki: berjalan di trotoar, menyeberang sesekali, dan lari
// ketakutan saat ada tembakan atau mobil yang melaju ke arah mereka.

import { WORLD } from './config.js';
import { hitsBuilding, randomSidewalkPoint } from './city.js';

const SHIRT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#fd79a8'];

/** Membuat satu pejalan kaki di titik trotoar acak. */
export function createPedestrian(dice, x, y) {
  const spot = x === undefined ? randomSidewalkPoint(dice) : { x, y };
  return {
    x: spot.x,
    y: spot.y,
    angle: dice.range(0, Math.PI * 2),
    speed: dice.range(28, 52),
    color: dice.pick(SHIRT_COLORS),
    target: null,
    state: 'jalan', // jalan | lari | jatuh
    fallTimer: 0,
    bob: dice.range(0, Math.PI * 2),
  };
}

/** Pilih titik trotoar baru untuk dituju. */
function pickWalkTarget(ped, dice) {
  const spot = randomSidewalkPoint(dice);
  // Lebih sering berjalan di sekitar tempat sekarang daripada menyeberang kota.
  if (Math.hypot(spot.x - ped.x, spot.y - ped.y) > 900) {
    return { x: ped.x + dice.range(-260, 260), y: ped.y + dice.range(-260, 260) };
  }
  return spot;
}

/** Majukan satu pejalan kaki satu langkah waktu. */
export function updatePedestrian(ped, dt, dice) {
  if (ped.state === 'jatuh') {
    ped.fallTimer -= dt;
    if (ped.fallTimer <= 0) {
      ped.state = 'jalan';
      ped.target = pickWalkTarget(ped, dice);
    }
    return;
  }
  if (ped.state === 'lari') {
    ped.speed = 150;
    // Lari menjauhi bahaya.
    const away = Math.atan2(ped.y - ped.dangerY, ped.x - ped.dangerX);
    ped.angle = away;
    ped.x += Math.cos(away) * ped.speed * dt;
    ped.y += Math.sin(away) * ped.speed * dt;
    ped.bob += dt * 14;
    if (Math.hypot(ped.x - ped.dangerX, ped.y - ped.dangerY) > 320) {
      ped.state = 'jalan';
      ped.speed = 40;
      ped.target = pickWalkTarget(ped, dice);
    }
    clampToWorld(ped);
    return;
  }
  if (!ped.target) ped.target = pickWalkTarget(ped, dice);
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 12) {
    ped.target = pickWalkTarget(ped, dice);
    return;
  }
  ped.angle = Math.atan2(dy, dx);
  const step = ped.speed * dt;
  const nx = ped.x + Math.cos(ped.angle) * step;
  const ny = ped.y + Math.sin(ped.angle) * step;
  // Jangan menembus gedung: belok saja ke target baru.
  if (!hitsBuilding(thisCity, nx, ny, 10)) {
    ped.x = nx;
    ped.y = ny;
  } else {
    ped.target = pickWalkTarget(ped, dice);
  }
  ped.bob += dt * 7;
  clampToWorld(ped);
}

let thisCity = null;
export function setCityForPedestrians(city) {
  thisCity = city;
}

function clampToWorld(ped) {
  ped.x = Math.max(WORLD.waterEdge + 8, Math.min(WORLD.width - 8, ped.x));
  ped.y = Math.max(8, Math.min(WORLD.height - 8, ped.y));
}

/** Buat pejalan kaki ketakutan dan lari dari titik bahaya. */
export function scarePedestrian(ped, x, y) {
  if (ped.state === 'jatuh') return;
  ped.state = 'lari';
  ped.dangerX = x;
  ped.dangerY = y;
}

/** Jatuhkan pejalan kaki (terpukul atau tertembak). */
export function knockDown(ped) {
  ped.state = 'jatuh';
  ped.fallTimer = 3;
}

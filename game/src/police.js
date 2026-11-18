// Polisi dan tingkat buron (wanted): bintang 1–5. Kejahatan menaikkan
// panas; polisi mengejar, memasang blokade, dan menangkap Leo bila
// terlalu dekat. Bersembunyi jauh dari polisi mendinginkan panas.

import { PLACES, WANTED, WORLD } from './config.js';
import { createCar, driveCar, wreckCar } from './vehicles.js';
import { nearestRoadPoint } from './city.js';

/** Keadaan awal sistem buron: tenang, tanpa panas. */
export function createWanted() {
  return {
    level: 0,
    heat: 0, // 0..100 di dalam tingkat sekarang
    bustTimer: 0,
    hiddenTimer: 0,
    roadblocks: [], // {x, y, angle, cars}
    officers: [], // polisi jalan kaki {x, y, angle, speed}
  };
}

/** Tambah panas karena kejahatan; tingkat naik tiap 100 panas. */
export function addHeat(wanted, amount) {
  wanted.heat += amount;
  while (wanted.heat >= 100 && wanted.level < WANTED.maxLevel) {
    wanted.heat -= 100;
    wanted.level += 1;
  }
  if (wanted.level >= WANTED.maxLevel) wanted.heat = Math.min(100, wanted.heat);
}

/** Atur tingkat buron langsung (untuk naskah misi). */
export function setWanted(wanted, level) {
  wanted.level = Math.max(0, Math.min(WANTED.maxLevel, level));
  wanted.heat = level > 0 ? 40 : 0;
  wanted.bustTimer = 0;
}

/** Hapus semua buron (setelah tertangkap atau misi selesai). */
export function clearWanted(wanted) {
  wanted.level = 0;
  wanted.heat = 0;
  wanted.bustTimer = 0;
  wanted.roadblocks = [];
  wanted.officers = [];
}

/** Apakah ada polisi yang melihat pemain (dekat dan tidak terhalang jauh)? */
function policeCanSee(player, policeCars, officers) {
  for (const car of policeCars) {
    if (Math.hypot(car.x - player.x, car.y - player.y) < 520) return true;
  }
  for (const officer of officers) {
    if (Math.hypot(officer.x - player.x, officer.y - player.y) < 260) return true;
  }
  return false;
}

/** Titik kemunculan mobil polisi: jalan terdekat di tepi pandangan pemain. */
function spawnPointNear(player, dice, distance) {
  const angle = dice.range(0, Math.PI * 2);
  let x = player.x + Math.cos(angle) * distance;
  let y = player.y + Math.sin(angle) * distance;
  x = Math.max(WORLD.sandEdge + 80, Math.min(WORLD.width - 80, x));
  y = Math.max(80, Math.min(WORLD.height - 80, y));
  const road = nearestRoadPoint(x, y);
  return { x: road.x, y: road.y };
}

/** Pasang blokade: dua mobil polisi melintang di jalan depan pemain. */
function placeRoadblock(wanted, player, dice) {
  const ahead = {
    x: player.x + Math.cos(player.angle || 0) * 420,
    y: player.y + Math.sin(player.angle || 0) * 420,
  };
  const road = nearestRoadPoint(ahead.x, ahead.y);
  const angle = Math.abs(road.x - ahead.x) < Math.abs(road.y - ahead.y) ? 0 : Math.PI / 2;
  const block = { x: road.x, y: road.y, angle, cars: [] };
  for (let i = 0; i < 2; i += 1) {
    const offset = i === 0 ? -34 : 34;
    const car = createCar('polisi', road.x + Math.cos(angle + Math.PI / 2) * offset, road.y + Math.sin(angle + Math.PI / 2) * offset, angle);
    car.driver = 'blokade';
    block.cars.push(car);
  }
  wanted.roadblocks.push(block);
  return block.cars;
}

/**
 * Majukan sistem buron: panas mendingin saat bersembunyi, polisi
 * bermunculan sesuai tingkat, dan tangkapan berjalan saat polisi dekat.
 * Mengembalikan peristiwa: 'busted' bila Leo tertangkap.
 */
export function updateWanted(wanted, dt, player, policeCars, dice, onEvent) {
  const seen = policeCanSee(player, policeCars, wanted.officers);
  if (wanted.level > 0) {
    if (!seen) {
      wanted.hiddenTimer += dt;
      wanted.heat -= (WANTED.decayPerSecond + WANTED.decayHiddenBonus) * dt;
    } else {
      wanted.hiddenTimer = 0;
      wanted.heat -= WANTED.decayPerSecond * 0.35 * dt;
    }
    if (wanted.heat < 0 && wanted.level > 0) {
      wanted.level -= 1;
      wanted.heat = wanted.level > 0 ? 90 : 0;
    }
  }

  // Mobil polisi: tambah sampai sesuai tingkat, buang yang terlalu jauh.
  const wantCars = WANTED.policeCars[wanted.level];
  for (let i = policeCars.length - 1; i >= 0; i -= 1) {
    const car = policeCars[i];
    if (car.wrecked || Math.hypot(car.x - player.x, car.y - player.y) > 1600) {
      policeCars.splice(i, 1);
    }
  }
  while (policeCars.length < wantCars) {
    const spot = spawnPointNear(player, dice, 620);
    const car = createCar('polisi', spot.x, spot.y, Math.atan2(player.y - spot.y, player.x - spot.x));
    car.driver = 'polisi';
    policeCars.push(car);
    onEvent('sirene');
  }

  // Polisi jalan kaki di tingkat 2 ke atas.
  const wantOfficers = WANTED.officers[wanted.level];
  while (wanted.officers.length < wantOfficers) {
    const spot = spawnPointNear(player, dice, 320);
    wanted.officers.push({ x: spot.x, y: spot.y, angle: 0, speed: 120 });
  }
  for (let i = wanted.officers.length - 1; i >= 0; i -= 1) {
    const officer = wanted.officers[i];
    if (Math.hypot(officer.x - player.x, officer.y - player.y) > 1200) {
      wanted.officers.splice(i, 1);
    }
  }

  // Blokade di tingkat 4 ke atas, paling banyak dua.
  if (wanted.level >= 4 && wanted.roadblocks.length < 2 && dice.chance(dt * 0.12)) {
    const cars = placeRoadblock(wanted, player, dice);
    for (const car of cars) policeCars.push(car);
    onEvent('blokade');
  }

  // Tangkap: polisi jalan kaki yang menyentuh Leo menahan hitungan.
  if (wanted.level > 0 && !player.inCar) {
    let nearest = Infinity;
    for (const officer of wanted.officers) {
      nearest = Math.min(nearest, Math.hypot(officer.x - player.x, officer.y - player.y));
    }
    if (nearest < 34) {
      wanted.bustTimer += dt;
      if (wanted.bustTimer >= WANTED.bustSeconds) return 'busted';
    } else {
      wanted.bustTimer = Math.max(0, wanted.bustTimer - dt * 2);
    }
  } else {
    wanted.bustTimer = Math.max(0, wanted.bustTimer - dt * 2);
  }
  return null;
}

/** Kemudi mobil polisi: kejar pemain, tabrak mobilnya bila dekat. */
export function chaseSteer(car, dt, player, dice) {
  const targetX = player.inCar ? player.inCar.x : player.x;
  const targetY = player.inCar ? player.inCar.y : player.y;
  const dx = targetX - car.x;
  const dy = targetY - car.y;
  const dist = Math.hypot(dx, dy);
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.4));
  let throttle = 0.95;
  if (dist < 60) throttle = 1;
  if (Math.abs(diff) > 1.2) throttle = 0.3;
  // Polisi tidak mengejar ke laut.
  if (car.x < WORLD.sandEdge + 60 && Math.cos(car.angle) < 0) throttle = 0.2;
  return { throttle, steer };
}

/** Gerak polisi jalan kaki: berlari ke arah pemain. */
export function updateOfficer(officer, dt, player) {
  const dx = player.x - officer.x;
  const dy = player.y - officer.y;
  const dist = Math.hypot(dx, dy) || 1;
  officer.angle = Math.atan2(dy, dx);
  const step = officer.speed * dt;
  officer.x += (dx / dist) * step;
  officer.y += (dy / dist) * step;
}

/** Tabrakan mobil polisi dengan mobil pemain: rusak dan goyangkan. */
export function policeRam(policeCar, playerCar, onEvent) {
  if (!playerCar || playerCar.wrecked) return;
  const dist = Math.hypot(policeCar.x - playerCar.x, policeCar.y - playerCar.y);
  if (dist < 46) {
    // Sekali per 0,5 detik saja — kalau tidak, satu sentuhan menahan
    // mobil pemain sampai berhenti total.
    if (playerCar.damageCooldown <= 0) {
      playerCar.hp -= 8;
      playerCar.damageCooldown = 0.5;
      policeCar.speed *= 0.5;
      playerCar.speed *= 0.7;
      onEvent('tabrak');
      if (playerCar.hp <= 0) wreckCar(playerCar);
    }
  }
}

/** Setelah tertangkap: Leo dibawa ke rumah sakit, uang dipotong. */
export function applyBusted(player) {
  player.money = Math.floor(player.money * 0.85);
  player.health = 100;
  player.x = PLACES.rumahSakit.x;
  player.y = PLACES.rumahSakit.y + 60;
  if (player.inCar) {
    player.inCar = null;
  }
  player.angle = -Math.PI / 2;
  player.facingX = 0;
  player.facingY = -1;
}

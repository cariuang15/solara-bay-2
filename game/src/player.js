// Leo Marín, sang pemain: berjalan kaki, berlari, memukul, menembak,
// dan masuk-keluar mobil. Semua gerak kaki dan tempur ada di sini;
// mengemudi ditangani vehicles.js.

import { PLAYER, WORLD } from './config.js';
import { hitsBuilding, isWaterAt, pushOutOfBuildings } from './city.js';

/** Keadaan awal pemain: di depan Rumah Mama Rosa, berjalan kaki. */
export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    health: PLAYER.health,
    money: 150,
    inCar: null, // mobil yang sedang dikendarai, atau null bila berjalan kaki
    facingX: 0,
    facingY: -1,
    punchTimer: 0,
    punchCooldown: 0,
    shootCooldown: 0,
    hurtTimer: 0,
    speed: 0,
  };
}

/** Arah bidik: ke tetikus saat menembak, kalau tidak ke arah gerak. */
export function aimAt(player, worldX, worldY) {
  player.facingX = worldX - player.x;
  player.facingY = worldY - player.y;
  const len = Math.hypot(player.facingX, player.facingY) || 1;
  player.facingX /= len;
  player.facingY /= len;
  player.angle = Math.atan2(player.facingY, player.facingX);
}

/**
 * Gerak jalan kaki satu langkah: WASD menggerakkan, Shift berlari.
 * Mengembalikan jarak yang ditempuh (untuk suara langkah, bila perlu).
 */
export function walkPlayer(player, dt, axes, city) {
  const speed = axes.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = axes.x;
  let my = axes.y;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const nx = player.x + mx * speed * dt;
  const ny = player.y + my * speed * dt;
  player.speed = len > 0 ? speed : 0;
  if (len > 0.1) {
    player.facingX = mx;
    player.facingY = my;
    player.angle = Math.atan2(my, mx);
  }
  // Coba geser penuh; bila terhalang gedung, coba tiap sumbu sendiri (geser di dinding).
  if (!hitsBuilding(city, nx, ny, PLAYER.radius) && !isWaterAt(nx, ny)) {
    player.x = nx;
    player.y = ny;
  } else if (!hitsBuilding(city, nx, player.y, PLAYER.radius) && !isWaterAt(nx, player.y)) {
    player.x = nx;
  } else if (!hitsBuilding(city, player.x, ny, PLAYER.radius) && !isWaterAt(player.x, ny)) {
    player.y = ny;
  }
  const pushed = pushOutOfBuildings(city, player.x, player.y, PLAYER.radius);
  player.x = pushed.x;
  player.y = pushed.y;
  player.x = Math.max(WORLD.waterEdge + 10, Math.min(WORLD.width - 10, player.x));
  player.y = Math.max(10, Math.min(WORLD.height - 10, player.y));
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.hurtTimer > 0) player.hurtTimer -= dt;
  return player.speed * dt;
}

/** Pukulan: busur pendek di depan pemain. Mengembalikan true bila bisa memukul. */
export function tryPunch(player) {
  if (player.inCar || player.punchCooldown > 0) return false;
  player.punchCooldown = 0.45;
  player.punchTimer = 0.22;
  return true;
}

/** Tembakan: satu peluru dari pemain ke arah bidik. Mengembalikan true bila bisa menembak. */
export function tryShoot(player) {
  if (player.inCar || player.shootCooldown > 0) return false;
  player.shootCooldown = 0.28;
  return true;
}

/** Apakah titik (x, y) berada dalam jangkauan pukulan pemain? */
export function inPunchArc(player, x, y) {
  const dx = x - player.x;
  const dy = y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > PLAYER.punchRange + 14) return false;
  const dot = (dx * player.facingX + dy * player.facingY) / (dist || 1);
  return dot > Math.cos(PLAYER.punchArc);
}

/** Turunkan nyawa pemain; mengembalikan true bila pemain tumbang. */
export function hurtPlayer(player, amount) {
  if (player.hurtTimer > 0) return false;
  player.health -= amount;
  player.hurtTimer = 0.6;
  return player.health <= 0;
}

/** Pulihkan nyawa sedikit demi sedikit saat tidak bertarung. */
export function regenPlayer(player, dt) {
  if (player.hurtTimer <= 0 && player.health > 0 && player.health < PLAYER.health) {
    player.health = Math.min(PLAYER.health, player.health + 2.5 * dt);
  }
}

/** Keluar dari mobil: letakkan pemain di samping pintu pengemudi. */
export function exitCar(player, car) {
  const side = { x: car.x - Math.sin(car.angle) * 30, y: car.y + Math.cos(car.angle) * 30 };
  player.x = side.x;
  player.y = side.y;
  player.inCar = null;
  player.speed = 0;
  player.angle = car.angle;
  player.facingX = Math.cos(car.angle);
  player.facingY = Math.sin(car.angle);
}

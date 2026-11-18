// Mobil: fisika mengemudi dan lalu lintas kota. Mobil lalu lintas mengikuti
// jalan, berbelok di simpang, dan mengerem saat ada mobil di depannya.
// Mobil pemain memakai fisika yang sama, hanya dikendalikan tombol.

import { CAR, WORLD } from './config.js';
import { hitsBuilding, isRoadAt, nearestJunction, nearestRoadPoint } from './city.js';

let nextCarId = 1;

/** Membuat satu mobil. kind: sedan, taksi, van, sport, truk, polisi. */
export function createCar(kind, x, y, angle, colorOverride) {
  const spec = CAR.kinds[kind] || CAR.kinds.sedan;
  return {
    id: nextCarId,
    kind,
    x, y,
    angle,
    speed: 0,
    hp: spec.hp,
    maxHp: spec.hp,
    color: colorOverride || spec.color,
    driver: kind === 'polisi' ? 'polisi' : 'lalu-lintas',
    // Tujuan lalu lintas: simpang berikutnya yang dituju.
    target: null,
    waitAtLight: 0,
    wrecked: false,
    smoking: false,
    brakeLight: false,
    // Jeda singkat antar benturan supaya satu sentuhan tidak menghancurkan mobil.
    damageCooldown: 0,
  };
}

/** Batas sudut ke [-PI, PI]. */
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Geser mobil oleh tabrakan dengan gedung (pantul ringan, kecepatan berkurang). */
function collideWithBuildings(car) {
  const hit = hitsBuilding(thisCity, car.x, car.y, CAR.length / 2);
  if (!hit) return false;
  const cx = Math.max(hit.x, Math.min(car.x, hit.x + hit.w));
  const cy = Math.max(hit.y, Math.min(car.y, hit.y + hit.h));
  const dx = car.x - cx;
  const dy = car.y - cy;
  const dist = Math.hypot(dx, dy) || 1;
  car.x = cx + (dx / dist) * (CAR.length / 2);
  car.y = cy + (dy / dist) * (CAR.length / 2);
  car.speed *= 0.4;
  return true;
}

let thisCity = null;
export function setCityForVehicles(city) {
  thisCity = city;
}

/**
 * Majukan satu mobil dengan masukan mengemudi (gas -1..1, belok -1..1).
 * Mengembalikan true bila menabrak gedung atau keluar batas.
 */
export function driveCar(car, dt, throttle, steer) {
  const spec = CAR.kinds[car.kind];
  if (car.wrecked) {
    car.speed *= Math.max(0, 1 - dt * 3);
    return false;
  }
  car.speed += throttle * spec.accel * dt;
  car.speed -= car.speed * 0.55 * dt;
  if (car.speed > spec.top) car.speed = spec.top;
  if (car.speed < -spec.top * 0.45) car.speed = -spec.top * 0.45;
  const grip = Math.min(1, Math.abs(car.speed) / 120 + 0.35);
  car.angle += steer * spec.turn * grip * dt * (car.speed >= 0 ? 1 : -1);
  if (car.damageCooldown > 0) car.damageCooldown -= dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;
  // Tetap di dalam dunia (pantai barat adalah batas air).
  if (car.x < WORLD.waterEdge + 20) { car.x = WORLD.waterEdge + 20; car.speed *= 0.3; }
  if (car.x > WORLD.width - 24) { car.x = WORLD.width - 24; car.speed *= 0.3; }
  if (car.y < 24) { car.y = 24; car.speed *= 0.3; }
  if (car.y > WORLD.height - 24) { car.y = WORLD.height - 24; car.speed *= 0.3; }
  if (thisCity) {
    if (collideWithBuildings(car)) {
      // Benturan gedung hanya melukai sekali per 0,5 detik.
      if (car.damageCooldown <= 0) {
        car.hp -= Math.abs(car.speed) * 0.02 + 2;
        car.damageCooldown = 0.5;
        if (car.hp <= 0) wreckCar(car);
      }
    }
  }
  car.smoking = car.hp < car.maxHp * 0.35;
  return false;
}

/** Mobil hancur: tidak bisa dikendarai lagi, berasap. */
export function wreckCar(car) {
  car.wrecked = true;
  car.speed = 0;
  car.smoking = true;
}

/** Pilih simpang acak yang jauh dari posisi sekarang sebagai tujuan baru. */
function pickTarget(car, dice) {
  for (let tries = 0; tries < 8; tries += 1) {
    const junction = nearestJunction(
      dice.range(WORLD.sandEdge + 100, WORLD.width - 100),
      dice.range(100, WORLD.height - 100),
    );
    const dist = Math.hypot(junction.x - car.x, junction.y - car.y);
    if (dist > 300) return junction;
  }
  return nearestJunction(car.x + 400, car.y);
}

/**
 * Kemudi lalu lintas: arahkan mobil ke simpang tujuannya, tetap di jalur
 * kanan jalan, dan rem bila ada mobil lain tepat di depan.
 */
export function trafficSteer(car, dt, cars, dice) {
  if (!car.target) car.target = pickTarget(car, dice);
  const dx = car.target.x - car.x;
  const dy = car.target.y - car.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 70) {
    car.target = pickTarget(car, dice);
    return { throttle: 0.4, steer: 0 };
  }
  // Tetap di jalur: arahkan ke simpang tujuan.
  const wantAngle = Math.atan2(dy, dx);
  const angleDiff = wrapAngle(wantAngle - car.angle);
  let steer = Math.max(-1, Math.min(1, angleDiff * 2.2));
  let throttle = 0.55;
  // Rem bila ada mobil lain di depan dalam jarak dekat.
  for (const other of cars) {
    if (other === car || other.wrecked) continue;
    const ox = other.x - car.x;
    const oy = other.y - car.y;
    const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
    const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 78 && side < 30) {
      throttle = -0.9;
      car.brakeLight = true;
      break;
    }
    car.brakeLight = false;
  }
  // Pelan di tikungan tajam.
  if (Math.abs(angleDiff) > 0.9) throttle = 0.15;
  // Jangan masuk ke pasir pantai: belok kembali ke jalan.
  if (car.x < WORLD.sandEdge + 60 && Math.cos(car.angle) < 0) {
    steer = 1;
    throttle = 0.4;
  }
  return { throttle, steer };
}

/** Taruh mobil lalu lintas baru di jalan, menghadap sepanjang jalan. */
export function spawnTrafficCar(dice, kinds) {
  const onVertical = dice.chance(0.5);
  let x;
  let y;
  let angle;
  if (onVertical) {
    const rx = dice.pick([420, 840, 1260, 1680, 2100, 2520, 2940, 3360]);
    x = rx + dice.pick([-1, 1]) * 22;
    y = dice.range(120, WORLD.height - 120);
    angle = dice.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
  } else {
    const ry = dice.pick([360, 760, 1160, 1560, 1960, 2360]);
    x = dice.range(WORLD.sandEdge + 120, WORLD.width - 120);
    y = ry + dice.pick([-1, 1]) * 22;
    angle = dice.chance(0.5) ? 0 : Math.PI;
  }
  const kind = dice.pick(kinds);
  const car = createCar(kind, x, y, angle);
  car.speed = CAR.trafficSpeed * dice.range(0.7, 1.05);
  car.target = pickTarget(car, dice);
  return car;
}

/** Taruh mobil parkir di tepi jalan atau di tempat parkir. */
export function spawnParkedCar(dice, x, y, angle) {
  const kind = dice.pick(['sedan', 'sedan', 'taksi', 'van', 'sport']);
  const car = createCar(kind, x, y, angle);
  car.driver = 'parkir';
  car.speed = 0;
  return car;
}

/** Jarak antara dua mobil (pusat ke pusat, dikurangi panjang mobil). */
export function carsOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.hypot(dx, dy);
  return dist < CAR.length * 0.85;
}

/** Dorong dua mobil yang bertabrakan supaya tidak saling menembus. */
export function separateCars(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.hypot(dx, dy) || 1;
  const push = (CAR.length * 0.85 - dist) / 2;
  if (push <= 0) return;
  const nx = dx / dist;
  const ny = dy / dist;
  a.x += nx * push;
  a.y += ny * push;
  b.x -= nx * push;
  b.y -= ny * push;
  const hitSpeed = Math.abs(a.speed - b.speed);
  // Posisi selalu dipisah supaya mobil tidak saling menembus; potongan
  // kecepatan dan kerusakan hanya sekali per 0,5 detik (kalau tidak,
  // satu sentuhan menahan mobil sampai berhenti total).
  if (hitSpeed > 120) {
    if (a.damageCooldown <= 0) {
      a.speed *= 0.55;
      a.hp -= hitSpeed * 0.03;
      a.damageCooldown = 0.5;
      if (a.hp <= 0) wreckCar(a);
    }
    if (b.damageCooldown <= 0) {
      b.speed *= 0.55;
      b.hp -= hitSpeed * 0.03;
      b.damageCooldown = 0.5;
      if (b.hp <= 0) wreckCar(b);
    }
  }
}

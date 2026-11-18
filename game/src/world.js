// Dunia Solara Bay: semua keadaan permainan dalam satu tempat, dan satu
// langkah waktu yang memajukan semuanya — pemain, mobil, pejalan kaki,
// polisi, peluru, partikel, dan misi.

import { CAR, MISSIONS, PLACES, PLAYER, WANTED } from './config.js';
import { buildCity, hitsBuilding, randomRoadPoint, randomSidewalkPoint } from './city.js';
import { makeDice } from './random.js';
import { createPlayer, exitCar, inPunchArc, regenPlayer, tryPunch, tryShoot, walkPlayer } from './player.js';
import {
  driveCar, separateCars, setCityForVehicles, spawnParkedCar, spawnTrafficCar, trafficSteer, wreckCar,
} from './vehicles.js';
import { createPedestrian, knockDown, scarePedestrian, setCityForPedestrians, updatePedestrian } from './pedestrians.js';
import {
  addHeat, applyBusted, chaseSteer, clearWanted, createWanted, policeRam, setWanted, updateOfficer, updateWanted,
} from './police.js';
import { createMissionState, failMission, missionStartPoint, showToast, startMission, updateMissions } from './missions.js';
import { EVENT_ENTER, EVENT_PUNCH } from './input.js';

export const EVENT_NONE = 0;
export const EVENT_BUSTED = 1;
export const EVENT_DEAD = 2;
export const EVENT_MISSION_DONE = 4;
export const EVENT_STORY_DONE = 8;

const STEP = 1 / 60;

/** Membuat dunia baru dari sebuah biji. */
export function createWorld(seed) {
  const city = buildCity();
  setCityForVehicles(city);
  setCityForPedestrians(city);
  const world = {
    city,
    seed,
    time: 0,
    dice: makeDice(seed),
    player: createPlayer(PLACES.rumahRosa.x, PLACES.rumahRosa.y + 80),
    cars: [],
    peds: [],
    policeCars: [],
    bullets: [],
    particles: [],
    skids: [],
    pickups: [],
    wanted: createWanted(),
    missions: createMissionState(),
    camera: { x: PLACES.rumahRosa.x, y: PLACES.rumahRosa.y + 80, zoom: 1 },
    stats: { stolen: 0, shots: 0, missions: 0, earned: 0 },
    audio: null,
    onMissionComplete: () => {},
    onMissionFailed: () => {},
    demo: false,
    lastEvent: EVENT_NONE,
  };
  // Tingkat buron bisa diatur dari misi dan adegan lewat world.setWanted.
  world.setWanted = (level) => setWanted(world.wanted, level);
  resetWorld(world, seed);
  return world;
}

/** Mengisi ulang dunia: mobil, pejalan kaki, dan uang tunai tersebar. */
export function resetWorld(world, seed) {
  world.seed = seed;
  world.dice = makeDice(seed);
  world.time = 0;
  world.player = createPlayer(PLACES.rumahRosa.x, PLACES.rumahRosa.y + 80);
  world.cars = [];
  world.peds = [];
  world.policeCars = [];
  world.bullets = [];
  world.particles = [];
  world.skids = [];
  world.pickups = [];
  world.wanted = createWanted();
  world.missions = createMissionState();
  world.stats = { stolen: 0, shots: 0, missions: 0, earned: 0 };
  world.camera = { x: world.player.x, y: world.player.y, zoom: 1 };
  // Lalu lintas awal di sekitar pemain.
  for (let i = 0; i < 14; i += 1) {
    world.cars.push(spawnTrafficCar(world.dice, ['sedan', 'sedan', 'taksi', 'van', 'sport', 'truk']));
  }
  // Mobil parkir di tepi jalan.
  const parkedSpots = [
    [1000, 760, 0], [1500, 1160, Math.PI / 2], [2100, 760, 0], [2600, 1560, Math.PI / 2],
    [840, 1300, Math.PI / 2], [2940, 1160, 0], [1260, 1900, Math.PI / 2], [1680, 2000, 0],
  ];
  for (const [x, y, angle] of parkedSpots) {
    world.cars.push(spawnParkedCar(world.dice, x, y, angle));
  }
  // Pejalan kaki.
  for (let i = 0; i < 26; i += 1) {
    world.peds.push(createPedestrian(world.dice));
  }
  // Uang tunai tersebar untuk dijelajahi.
  for (let i = 0; i < 8; i += 1) {
    spawnPickup(world);
  }
}

/** Taruh satu bundel uang di trotoar acak. */
function spawnPickup(world) {
  const spot = randomSidewalkPoint(world.dice);
  world.pickups.push({ x: spot.x, y: spot.y, amount: world.dice.int(50, 150), bob: 0 });
}

/** Ledakan partikel di sebuah titik. */
export function spawnExplosion(world, x, y) {
  for (let i = 0; i < 26; i += 1) {
    const angle = world.dice.range(0, Math.PI * 2);
    const speed = world.dice.range(40, 260);
    world.particles.push({
      x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: world.dice.range(0.4, 1.1), maxLife: 1.1,
      color: world.dice.pick(['#ff9f43', '#ff6b35', '#feca57', '#576574']),
      size: world.dice.range(3, 9),
    });
  }
}

/** Percikan kecil (pukulan, tembakan kena dinding, uang diambil). */
export function spawnSparks(world, x, y, color, count = 8) {
  for (let i = 0; i < count; i += 1) {
    const angle = world.dice.range(0, Math.PI * 2);
    const speed = world.dice.range(30, 160);
    world.particles.push({
      x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: world.dice.range(0.2, 0.5), maxLife: 0.5,
      color, size: world.dice.range(2, 4),
    });
  }
}

/** Mobil terdekat dari pemain (kaki atau mobil) dalam jarak tertentu. */
export function nearestCar(world, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of world.cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - world.player.x, car.y - world.player.y);
    if (d < bestDist) { bestDist = d; best = car; }
  }
  return best;
}

/**
 * Satu langkah waktu (1/60 detik). Masukan: objek input dengan axes(),
 * takeClick(), takeEvents(), dan mouse(). Mengembalikan bendera EVENT_*.
 */
export function stepWorld(world, dt, input) {
  world.time += dt;
  const player = world.player;
  // Dunia hanya mengambil E (masuk mobil) dan F (pukul); layar sudah
  // mengambil jeda, bantuan, simpan, dan suara duluan.
  const events = input.takeEvents(EVENT_ENTER | EVENT_PUNCH);
  const axes = input.axes();
  let result = EVENT_NONE;

  // --- Pemain: jalan kaki atau mengemudi ---
  if (player.inCar) {
    const car = player.inCar;
    // Gas sebanding dengan sumbu Y: W = gas penuh, S = mundur/rem.
    // (Masukan skrip memakai nilai pecahan untuk mengikuti arus lalu lintas.)
    const throttle = -axes.y;
    const steer = axes.x;
    driveCar(car, dt, throttle, steer);
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.speed = car.speed;
    // Jejak ban saat belok keras dalam kecepatan tinggi.
    if (Math.abs(car.speed) > 240 && Math.abs(steer) > 0.6) {
      world.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 1.4 });
    }
    if (car.wrecked) {
      exitCar(player, car);
      showToast(world.missions, 'Mobilmu hancur!');
    }
    if (world.audio) world.audio.engine(Math.min(1, Math.abs(car.speed) / CAR.kinds[car.kind].top));
  } else {
    walkPlayer(player, dt, axes, world.city);
    regenPlayer(player, dt);
    if (world.audio) world.audio.engine(0);
  }

  // --- Masuk / keluar mobil (E) ---
  if (events & EVENT_ENTER) {
    if (player.inCar) {
      exitCar(player, player.inCar);
    } else {
      const car = nearestCar(world, 62);
      if (car) {
        const wasParked = car.driver === 'parkir';
        const wasTraffic = car.driver === 'lalu-lintas';
        car.driver = 'pemain';
        player.inCar = car;
        if (wasTraffic) {
          // Sopirnya kabur jadi pejalan kaki.
          const driver = createPedestrian(world.dice, car.x + 30, car.y + 30);
          scarePedestrian(driver, car.x, car.y);
          world.peds.push(driver);
          addHeat(world.wanted, WANTED.stealHeat);
          world.stats.stolen += 1;
          showToast(world.missions, 'Mobil dicuri! Polisi mungkin memperhatikanmu.');
        } else if (!wasParked) {
          addHeat(world.wanted, WANTED.stealHeat);
        }
        if (world.audio) world.audio.click();
      }
    }
  }

  // --- Pukul (F) ---
  if (events & EVENT_PUNCH && tryPunch(player)) {
    if (world.audio) world.audio.punch();
    let hitSomething = false;
    for (const ped of world.peds) {
      if (ped.state !== 'jatuh' && inPunchArc(player, ped.x, ped.y)) {
        knockDown(ped);
        addHeat(world.wanted, WANTED.punchHeat);
        spawnSparks(world, ped.x, ped.y, '#feca57', 6);
        hitSomething = true;
      }
    }
    for (const officer of world.wanted.officers) {
      if (inPunchArc(player, officer.x, officer.y)) {
        addHeat(world.wanted, WANTED.punchHeat * 2);
        spawnSparks(world, officer.x, officer.y, '#feca57', 6);
        hitSomething = true;
      }
    }
    for (const car of world.cars) {
      if (Math.hypot(car.x - player.x, car.y - player.y) < 52) {
        car.hp -= 4;
        spawnSparks(world, player.x + player.facingX * 30, player.y + player.facingY * 30, '#dfe6e9', 4);
        hitSomething = true;
      }
    }
    if (!hitSomething) {
      // Pukulan ke udara tetap menakut-nakuti pejalan kaki di dekatnya.
      for (const ped of world.peds) {
        if (Math.hypot(ped.x - player.x, ped.y - player.y) < 120) scarePedestrian(ped, player.x, player.y);
      }
    }
  }

  // --- Tembak (klik tetikus) ---
  if (input.takeClick() && tryShoot(player)) {
    const mouse = input.mouse();
    const worldMouse = screenToWorld(world, mouse.x, mouse.y);
    const dx = worldMouse.x - player.x;
    const dy = worldMouse.y - player.y;
    const len = Math.hypot(dx, dy) || 1;
    world.bullets.push({
      x: player.x + (dx / len) * 20,
      y: player.y + (dy / len) * 20,
      vx: (dx / len) * PLAYER.bulletSpeed,
      vy: (dy / len) * PLAYER.bulletSpeed,
      life: PLAYER.bulletRange / PLAYER.bulletSpeed,
    });
    player.angle = Math.atan2(dy, dx);
    player.facingX = dx / len;
    player.facingY = dy / len;
    world.stats.shots += 1;
    addHeat(world.wanted, WANTED.shootHeat);
    if (world.audio) world.audio.shoot();
    for (const ped of world.peds) {
      if (Math.hypot(ped.x - player.x, ped.y - player.y) < 260) scarePedestrian(ped, player.x, player.y);
    }
  }

  // --- Peluru ---
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      const building = hitsBuilding(world.city, b.x, b.y, 2);
      if (building) {
        spawnSparks(world, b.x, b.y, '#dfe6e9', 3);
        dead = true;
      }
    }
    if (!dead) {
      for (const car of world.cars) {
        if (car.wrecked) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
          car.hp -= PLAYER.shootDamage;
          spawnSparks(world, b.x, b.y, '#ff9f43', 6);
          if (car.hp <= 0) {
            wreckCar(car);
            spawnExplosion(world, car.x, car.y);
            if (world.audio) world.audio.explosion();
            if (car === player.inCar) exitCar(player, car);
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const ped of world.peds) {
        if (ped.state !== 'jatuh' && Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
          knockDown(ped);
          addHeat(world.wanted, WANTED.killHeat);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of world.policeCars) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
          car.hp -= PLAYER.shootDamage;
          spawnSparks(world, b.x, b.y, '#ff9f43', 6);
          addHeat(world.wanted, WANTED.killHeat);
          if (car.hp <= 0) {
            wreckCar(car);
            spawnExplosion(world, car.x, car.y);
            if (world.audio) world.audio.explosion();
          }
          dead = true;
          break;
        }
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }

  // --- Lalu lintas ---
  for (const car of world.cars) {
    if (car === player.inCar || car.driver === 'pemain' || car.driver === 'parkir' || car.driver === 'rival' || car.driver === 'blokade') continue;
    const steer = trafficSteer(car, dt, world.cars, world.dice);
    driveCar(car, dt, steer.throttle, steer.steer);
  }
  // Tabrakan antar mobil.
  for (let i = 0; i < world.cars.length; i += 1) {
    for (let j = i + 1; j < world.cars.length; j += 1) {
      const a = world.cars[i];
      const b = world.cars[j];
      if (a.wrecked || b.wrecked) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (dx * dx + dy * dy < 42 * 42) {
        separateCars(a, b);
        if (Math.abs(a.speed) + Math.abs(b.speed) > 200 && world.audio) world.audio.crash();
      }
    }
  }
  // Jaga jumlah lalu lintas: buang yang jauh, tambah yang dekat.
  for (let i = world.cars.length - 1; i >= 0; i -= 1) {
    const car = world.cars[i];
    if (car.driver === 'lalu-lintas' && Math.hypot(car.x - player.x, car.y - player.y) > 1500) {
      world.cars.splice(i, 1);
    }
  }
  while (world.cars.filter((c) => c.driver === 'lalu-lintas').length < 12) {
    const spot = randomRoadPoint(world.dice);
    const car = spawnTrafficCar(world.dice, ['sedan', 'sedan', 'taksi', 'van', 'sport', 'truk']);
    car.x = player.x + (spot.x - player.x) * 0.5;
    car.y = player.y + (spot.y - player.y) * 0.5;
    world.cars.push(car);
  }

  // --- Polisi ---
  const busted = updateWanted(world.wanted, dt, player, world.policeCars, world.dice, (event) => {
    if (event === 'sirene' && world.audio) world.audio.siren(true);
  });
  // Buron padam: mobil polisi bubar dan kembali jadi lalu lintas biasa.
  if (world.wanted.level === 0 && world.policeCars.length > 0) {
    for (const car of world.policeCars) {
      car.driver = 'lalu-lintas';
      car.target = null;
      world.cars.push(car);
    }
    world.policeCars.length = 0;
    world.wanted.officers.length = 0;
    world.wanted.roadblocks = [];
  }
  for (const car of world.policeCars) {
    if (car.driver === 'blokade' || car.wrecked) continue;
    const steer = chaseSteer(car, dt, player, world.dice);
    driveCar(car, dt, steer.throttle, steer.steer);
    if (player.inCar) policeRam(car, player.inCar, (event) => {
      if (event === 'tabrak' && world.audio) world.audio.crash();
    });
  }
  for (const officer of world.wanted.officers) {
    updateOfficer(officer, dt, player);
  }
  if (world.wanted.level === 0 && world.audio) world.audio.siren(false);
  if (busted === 'busted') {
    if (world.audio) world.audio.busted();
    applyBusted(player);
    clearWanted(world.wanted);
    if (world.missions.active) failMission(world.missions, world, 'Kamu tertangkap polisi');
    return EVENT_BUSTED;
  }

  // --- Pejalan kaki ---
  for (const ped of world.peds) {
    updatePedestrian(ped, dt, world.dice);
  }
  for (let i = world.peds.length - 1; i >= 0; i -= 1) {
    const ped = world.peds[i];
    if (Math.hypot(ped.x - player.x, ped.y - player.y) > 1600) world.peds.splice(i, 1);
  }
  while (world.peds.length < 24) {
    world.peds.push(createPedestrian(world.dice));
  }

  // --- Mobil pemain menabrak pejalan kaki ---
  if (player.inCar && Math.abs(player.inCar.speed) > 120) {
    for (const ped of world.peds) {
      if (ped.state !== 'jatuh' && Math.hypot(ped.x - player.x, ped.y - player.y) < 26) {
        knockDown(ped);
        addHeat(world.wanted, WANTED.killHeat);
        player.inCar.speed *= 0.6;
      }
    }
  }

  // --- Uang tersebar ---
  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = world.pickups[i];
    pickup.bob += dt * 4;
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 34) {
      player.money += pickup.amount;
      world.stats.earned += pickup.amount;
      spawnSparks(world, pickup.x, pickup.y, '#f2c94c', 10);
      if (world.audio) world.audio.cash();
      showToast(world.missions, `Menemukan uang tunai +$${pickup.amount}`);
      world.pickups.splice(i, 1);
      spawnPickup(world);
    }
  }

  // --- Partikel dan jejak ban ---
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - dt * 2);
    p.vy *= Math.max(0, 1 - dt * 2);
    p.life -= dt;
    if (p.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.skids.length - 1; i >= 0; i -= 1) {
    world.skids[i].life -= dt;
    if (world.skids[i].life <= 0) world.skids.splice(i, 1);
  }

  // --- Misi ---
  const missionsBefore = world.missions.completed;
  updateMissions(world.missions, world, dt);
  if (world.missions.completed > missionsBefore) {
    world.stats.missions += 1;
    if (world.audio) world.audio.missionWin();
    if (world.missions.completed >= MISSIONS.length) {
      result |= EVENT_STORY_DONE;
    } else {
      result |= EVENT_MISSION_DONE;
    }
  }

  // --- Kamera mengikuti pemain ---
  const targetZoom = player.inCar ? 0.82 : 1;
  world.camera.zoom += (targetZoom - world.camera.zoom) * Math.min(1, dt * 3);
  world.camera.x += (player.x - world.camera.x) * Math.min(1, dt * 6);
  world.camera.y += (player.y - world.camera.y) * Math.min(1, dt * 6);

  // --- Pemain tumbang ---
  if (player.health <= 0) {
    if (world.audio) world.audio.explosion();
    return EVENT_DEAD;
  }
  return result;
}

/** Ubah posisi tetikus di layar menjadi posisi di dunia. */
export function screenToWorld(world, screenX, screenY) {
  const viewW = 1280;
  const viewH = 720;
  const cam = world.camera;
  return {
    x: cam.x + (screenX - viewW / 2) / cam.zoom,
    y: cam.y + (screenY - viewH / 2) / cam.zoom,
  };
}

/** Atur tingkat buron dari luar (misi, adegan). */
export function setWantedLevel(world, level) {
  setWanted(world.wanted, level);
}

/** Apakah pemain berada di dekat titik mulai misi (Rumah Mama Rosa)? */
export function nearMissionStart(world) {
  const start = missionStartPoint();
  return Math.hypot(world.player.x - start.x, world.player.y - start.y) < 110;
}

/** Coba mulai misi berikutnya bila pemain berada di titik mulai. */
export function tryStartMission(world) {
  if (!nearMissionStart(world)) return null;
  if (world.missions.active) return null;
  const intro = startMission(world.missions, world);
  if (intro) showToast(world.missions, intro);
  return intro;
}

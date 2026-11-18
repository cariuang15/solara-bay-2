// Peta kota Solara Bay: jalan, blok bangunan, taman, pohon palem, dan
// tempat-tempat bernama. Peta dibangun sekali dari biji tetap, jadi kota
// yang sama muncul di setiap permainan dan setiap screenshot.

import { COLORS, PLACES, ROADS_X, ROADS_Y, WORLD } from './config.js';
import { makeDice } from './random.js';

const CITY_SEED = 20261118;

/** Jarak dari titik ke sebuah ruas jalan (garis tengah jalan). */
function distanceToRoad(x, y) {
  let best = Infinity;
  for (const rx of ROADS_X) best = Math.min(best, Math.abs(x - rx));
  for (const ry of ROADS_Y) best = Math.min(best, Math.abs(y - ry));
  return best;
}

/** Apakah titik ini berada di atas jalan (aspal)? */
export function isRoadAt(x, y) {
  if (x < WORLD.sandEdge) return false;
  return distanceToRoad(x, y) <= WORLD.roadWidth / 2;
}

/** Apakah titik ini berada di air (laut di barat)? */
export function isWaterAt(x, y) {
  return x < WORLD.waterEdge;
}

/** Apakah titik ini berada di pasir pantai? */
export function isSandAt(x, y) {
  return x >= WORLD.waterEdge && x < WORLD.sandEdge;
}

/** Titik jalan terdekat dari sebuah posisi (proyeksi ke garis tengah jalan). */
export function nearestRoadPoint(x, y) {
  let bestX = x;
  let bestY = y;
  let best = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < best) { best = d; bestX = rx; bestY = y; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < best) { best = d; bestX = x; bestY = ry; }
  }
  return { x: bestX, y: bestY };
}

/** Perpotongan jalan terdekat (simpang) dari sebuah posisi. */
export function nearestJunction(x, y) {
  let bx = ROADS_X[0];
  let by = ROADS_Y[0];
  let best = Infinity;
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      const d = (rx - x) * (rx - x) + (ry - y) * (ry - y);
      if (d < best) { best = d; bx = rx; by = ry; }
    }
  }
  return { x: bx, y: by };
}

/** Membangun seluruh isi kota: gedung, taman, palem, dan tempat parkir. */
export function buildCity() {
  const dice = makeDice(CITY_SEED);
  const buildings = [];
  const parks = [];
  const palms = [];
  const parkingLots = [];

  const left = WORLD.sandEdge + 30;
  const top = 40;
  const right = WORLD.width - 40;
  const bottom = WORLD.height - 40;

  // Blok di antara jalan-jalan: isi dengan gedung, taman, atau parkir.
  for (let xi = 0; xi < ROADS_X.length; xi += 1) {
    const x0 = xi === 0 ? left : ROADS_X[xi - 1] + WORLD.roadWidth / 2 + 14;
    const x1 = ROADS_X[xi] - WORLD.roadWidth / 2 - 14;
    for (let yi = 0; yi < ROADS_Y.length; yi += 1) {
      const y0 = yi === 0 ? top : ROADS_Y[yi - 1] + WORLD.roadWidth / 2 + 14;
      const y1 = ROADS_Y[yi] - WORLD.roadWidth / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const kind = dice.roll();
      if (kind < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let p = 0; p < 5; p += 1) {
          palms.push({ x: dice.range(x0 + 20, x1 - 20), y: dice.range(y0 + 20, y1 - 20) });
        }
        continue;
      }
      if (kind < 0.24) {
        parkingLots.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        continue;
      }
      // Gedung: satu besar atau dua sampai empat kecil dalam satu blok.
      // Jangan pernah menutupi titik bernama (rumah, toko, dermaga, dsb):
      // pemain harus bisa berdiri tepat di titik misi.
      const count = dice.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const bw = dice.range(90, Math.max(95, (x1 - x0) / count - 16));
        const bh = dice.range(80, Math.max(85, y1 - y0 - 16));
        const bx = x0 + ((x1 - x0 - bw) / Math.max(1, count)) * b + dice.range(4, 10);
        const by = y0 + dice.range(6, Math.max(7, y1 - y0 - bh - 4));
        let coversPlace = false;
        for (const key of Object.keys(PLACES)) {
          const place = PLACES[key];
          if (place.x > bx - 30 && place.x < bx + bw + 30 && place.y > by - 30 && place.y < by + bh + 30) {
            coversPlace = true;
            break;
          }
        }
        if (coversPlace) continue;
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: dice.pick(COLORS.roof),
          tall: dice.chance(0.3),
          pool: dice.chance(0.18),
        });
      }
    }
  }

  // Palem di sepanjang garis pantai.
  for (let y = 60; y < WORLD.height - 60; y += 130) {
    palms.push({ x: dice.range(170, 270), y: y + dice.range(-20, 20) });
  }
  // Palem di beberapa trotoar kota.
  for (let i = 0; i < 40; i += 1) {
    const rx = dice.pick(ROADS_X);
    const ry = dice.pick(ROADS_Y);
    palms.push({
      x: rx + dice.pick([-1, 1]) * (WORLD.roadWidth / 2 + 16),
      y: ry + dice.range(-160, 160),
    });
  }

  // Gedung-gedung penting diberi atap khas supaya mudah dikenali.
  const landmark = (place, color, w = 150, h = 110) => {
    buildings.push({
      x: place.x - w / 2, y: place.y - h / 2, w, h, color, tall: true, pool: false, landmark: place.label,
    });
  };
  landmark(PLACES.bank, '#d9a441');
  landmark(PLACES.kasino, '#9a6b9e');
  landmark(PLACES.kantorPolisi, '#4a7d96');
  landmark(PLACES.rumahSakit, '#e8e4da');

  return { buildings, parks, palms, parkingLots };
}

/** Apakah lingkaran (x, y, r) menabrak gedung? */
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

/** Dorong titik keluar dari gedung terdekat (geser di dinding). */
export function pushOutOfBuildings(city, x, y, r) {
  const b = hitsBuilding(city, x, y, r);
  if (!b) return { x, y, hit: false };
  const overlapLeft = x + r - b.x;
  const overlapRight = b.x + b.w - (x - r);
  const overlapTop = y + r - b.y;
  const overlapBottom = b.y + b.h - (y - r);
  const smallest = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
  if (smallest === overlapLeft) return { x: b.x - r, y, hit: true };
  if (smallest === overlapRight) return { x: b.x + b.w + r, y, hit: true };
  if (smallest === overlapTop) return { x, y: b.y - r, hit: true };
  return { x, y: b.y + b.h + r, hit: true };
}

/** Titik jalan acak untuk menaruh mobil lalu lintas atau pejalan kaki. */
export function randomRoadPoint(dice) {
  if (dice.chance(0.5)) {
    return { x: dice.pick(ROADS_X) + dice.range(-18, 18), y: dice.range(80, WORLD.height - 80) };
  }
  return { x: dice.range(WORLD.sandEdge + 60, WORLD.width - 80), y: dice.pick(ROADS_Y) + dice.range(-18, 18) };
}

/** Titik trotoar acak (di samping jalan) untuk pejalan kaki. */
export function randomSidewalkPoint(dice) {
  const onVertical = dice.chance(0.5);
  if (onVertical) {
    const rx = dice.pick(ROADS_X);
    return {
      x: rx + dice.pick([-1, 1]) * (WORLD.roadWidth / 2 + 14),
      y: dice.range(80, WORLD.height - 80),
    };
  }
  const ry = dice.pick(ROADS_Y);
  return {
    x: dice.range(WORLD.sandEdge + 60, WORLD.width - 80),
    y: ry + dice.pick([-1, 1]) * (WORLD.roadWidth / 2 + 14),
  };
}

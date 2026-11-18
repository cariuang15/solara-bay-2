// Menggambar saja: keadaan dunia dan layar masuk, piksel keluar.
// Area logis 1280x720 diskalakan ke jendela; kamera mengikuti pemain
// dan menjauh sedikit saat mengemudi. Semua teks di layar berbahasa Indonesia.

import { CAR, COLORS, MISSIONS, PLACES, ROADS_X, ROADS_Y, WANTED, WORLD } from './config.js';
import { currentObjective } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_HELP = 'help';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_STORY = 'story';

const VIEW_W = 1280;
const VIEW_H = 720;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Gambar mobil dari atas: badan membulat, kaca, lampu, dan lampu polisi. */
function drawCarShape(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const halfL = CAR.length / 2;
  const halfW = CAR.width / 2;
  // Bayangan.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.roundRect(-halfL + 3, -halfW + 4, CAR.length, CAR.width, 8);
  ctx.fill();
  // Badan.
  ctx.fillStyle = car.wrecked ? '#3a3f47' : car.color;
  ctx.beginPath();
  ctx.roundRect(-halfL, -halfW, CAR.length, CAR.width, 8);
  ctx.fill();
  // Mobil pemain digarisbawahi putih supaya mudah ditemukan.
  if (car.driver === 'pemain') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  // Kaca depan dan belakang.
  ctx.fillStyle = '#b8d4e8';
  ctx.fillRect(halfL - 16, -halfW + 4, 8, CAR.width - 8);
  ctx.fillRect(-halfL + 6, -halfW + 4, 8, CAR.width - 8);
  // Atap.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-halfL + 16, -halfW + 5, CAR.length - 34, CAR.width - 10);
  // Lampu depan (kuning) dan rem (merah saat mengerem).
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(halfL - 2, -halfW + 3, 3, 5);
  ctx.fillRect(halfL - 2, halfW - 8, 3, 5);
  ctx.fillStyle = car.brakeLight ? '#ff3b30' : '#c0392b';
  ctx.fillRect(-halfL - 1, -halfW + 3, 3, 5);
  ctx.fillRect(-halfL - 1, halfW - 8, 3, 5);
  // Mobil polisi: garis putih dan lampu berkedip.
  if (car.kind === 'polisi') {
    ctx.fillStyle = '#f5f6fa';
    ctx.fillRect(-6, -halfW, 12, CAR.width);
    ctx.fillStyle = '#1c2733';
    ctx.font = 'bold 9px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('POLISI', 0, -halfW - 4);
    const blink = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = blink ? '#ff3b30' : '#2e86de';
    ctx.beginPath();
    ctx.arc(-4, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#2e86de' : '#ff3b30';
    ctx.beginPath();
    ctx.arc(4, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Asap bila rusak.
  if (car.smoking && !car.wrecked) {
    ctx.fillStyle = 'rgba(90,90,90,0.5)';
    ctx.beginPath();
    ctx.arc(-halfL + 6, 0, 6 + Math.sin(time * 9) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Gambar pejalan kaki dari atas: badan kecil dengan bayangan dan ayunan langkah. */
function drawPedestrian(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'jatuh') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 2, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.bob) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5d7b0';
  ctx.beginPath();
  ctx.arc(4 + bob * 0.4, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Gambar Leo: jaket merah, topi, dan arah hadap. */
function drawPlayer(ctx, player, time) {
  if (player.inCar) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  // Berkedip sebentar setelah terluka.
  if (player.hurtTimer > 0 && Math.floor(time * 12) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(player.angle);
  // Badan (jaket merah) dan kepala.
  ctx.fillStyle = '#d63031';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5d7b0';
  ctx.beginPath();
  ctx.arc(5, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // Topi.
  ctx.fillStyle = '#2d3436';
  ctx.beginPath();
  ctx.arc(3, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2d3436';
  ctx.fillRect(8, -6, 5, 12);
  // Pukulan: tinju terayun ke depan.
  if (player.punchTimer > 0) {
    ctx.fillStyle = '#f5d7b0';
    ctx.beginPath();
    ctx.arc(20, -4, 5, 0, Math.PI * 2);
    ctx.arc(20, 4, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_W, height / VIEW_H);
    view.x = (width - VIEW_W * view.scale) / 2;
    view.y = (height - VIEW_H * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align = 'left', weight = '') {
    const key = size + weight;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  /** Gambar tanah: laut, pasir, rumput kota, blok, taman, dan jalan. */
  function drawGround(world) {
    const cam = world.camera;
    const halfW = VIEW_W / 2 / cam.zoom + 60;
    const halfH = VIEW_H / 2 / cam.zoom + 60;
    const x0 = Math.max(0, cam.x - halfW);
    const x1 = Math.min(WORLD.width, cam.x + halfW);
    const y0 = Math.max(0, cam.y - halfH);
    const y1 = Math.min(WORLD.height, cam.y + halfH);

    // Dasar rumput kota.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Laut (barat) dengan ombak bergerak.
    ctx.fillStyle = COLORS.waterDeep;
    ctx.fillRect(x0, y0, Math.max(0, Math.min(x1, WORLD.waterEdge) - x0), y1 - y0);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(Math.max(x0, 30), y0, Math.max(0, Math.min(x1, WORLD.waterEdge) - Math.max(x0, 30)), y1 - y0);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
      const wave = Math.sin(world.time * 1.6 + y * 0.05) * 8;
      ctx.beginPath();
      ctx.moveTo(Math.max(x0, 60), y + wave);
      ctx.quadraticCurveTo(Math.max(x0, 100), y + wave + 10, Math.max(x0, WORLD.waterEdge - 8), y + wave);
      ctx.stroke();
    }
    // Pasir pantai.
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(Math.max(x0, WORLD.waterEdge), y0, Math.max(0, Math.min(x1, WORLD.sandEdge) - Math.max(x0, WORLD.waterEdge)), y1 - y0);

    // Blok kota (tanah antar jalan).
    ctx.fillStyle = COLORS.block;
    for (const b of world.city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);
    }
    // Taman.
    ctx.fillStyle = COLORS.park;
    for (const park of world.city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Jalan: aspal, trotoar, dan garis tengah putus-putus.
    ctx.fillStyle = COLORS.sidewalk;
    for (const rx of ROADS_X) {
      if (rx < x0 - 80 || rx > x1 + 80) continue;
      ctx.fillRect(rx - WORLD.roadWidth / 2 - 10, y0, WORLD.roadWidth + 20, y1 - y0);
    }
    for (const ry of ROADS_Y) {
      if (ry < y0 - 80 || ry > y1 + 80) continue;
      ctx.fillRect(x0, ry - WORLD.roadWidth / 2 - 10, x1 - x0, WORLD.roadWidth + 20);
    }
    ctx.fillStyle = COLORS.asphalt;
    for (const rx of ROADS_X) {
      if (rx < x0 - 80 || rx > x1 + 80) continue;
      ctx.fillRect(rx - WORLD.roadWidth / 2, y0, WORLD.roadWidth, y1 - y0);
    }
    for (const ry of ROADS_Y) {
      if (ry < y0 - 80 || ry > y1 + 80) continue;
      ctx.fillRect(x0, ry - WORLD.roadWidth / 2, x1 - x0, WORLD.roadWidth);
    }
    ctx.fillStyle = COLORS.asphaltLine;
    for (const rx of ROADS_X) {
      if (rx < x0 - 80 || rx > x1 + 80) continue;
      for (let y = Math.floor(y0 / 60) * 60; y < y1; y += 60) {
        ctx.fillRect(rx - 2, y, 4, 28);
      }
    }
    for (const ry of ROADS_Y) {
      if (ry < y0 - 80 || ry > y1 + 80) continue;
      for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) {
        ctx.fillRect(x, ry - 2, 28, 4);
      }
    }
    // Zebra di tiap simpang.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        if (rx < x0 - 80 || rx > x1 + 80 || ry < y0 - 80 || ry > y1 + 80) continue;
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(rx - WORLD.roadWidth / 2 + 8, ry + i * 12 - 3, 16, 6);
          ctx.fillRect(rx + WORLD.roadWidth / 2 - 24, ry + i * 12 - 3, 16, 6);
        }
      }
    }
  }

  /** Gedung, palem, dan label tempat penting. */
  function drawCityDetails(world) {
    const cam = world.camera;
    const halfW = VIEW_W / 2 / cam.zoom + 80;
    const halfH = VIEW_H / 2 / cam.zoom + 80;
    const x0 = cam.x - halfW;
    const x1 = cam.x + halfW;
    const y0 = cam.y - halfH;
    const y1 = cam.y + halfH;

    for (const b of world.city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      // Bayangan gedung (matahari dari barat daya).
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(b.x, b.y, b.w, 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      if (b.tall) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
      }
      if (b.pool) {
        ctx.fillStyle = '#4db2e8';
        ctx.beginPath();
        ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, 14, 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (b.landmark) {
        text(b.landmark, b.x + b.w / 2, b.y - 8, 13, '#2d3436', 'center', 'bold');
      }
    }
    for (const palm of world.city.palms) {
      if (palm.x < x0 || palm.x > x1 || palm.y < y0 || palm.y > y1) continue;
      ctx.fillStyle = COLORS.trunk;
      ctx.fillRect(palm.x - 2, palm.y - 2, 4, 10);
      ctx.fillStyle = COLORS.palm;
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(palm.x + Math.cos(a) * 9, palm.y + Math.sin(a) * 7, 9, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Label tempat bernama.
    ctx.font = `bold 13px ${FONT}`;
    for (const key of Object.keys(PLACES)) {
      const place = PLACES[key];
      if (place.x < x0 || place.x > x1 || place.y < y0 || place.y > y1) continue;
      if (key === 'bank' || key === 'kasino' || key === 'kantorPolisi' || key === 'rumahSakit') continue;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(place.label, place.x, place.y - 14);
    }
  }

  /** Penanda misi: lingkaran berdenyut dan tiang cahaya di titik tujuan. */
  function drawMissionMarker(world) {
    const objective = currentObjective(world.missions);
    if (!objective.point) return;
    const point = objective.point;
    const pulse = 1 + Math.sin(world.time * 4) * 0.15;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect(point.x - 3, point.y - 320, 6, 320);
    ctx.restore();
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 44 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
    ctx.fill();
    text('★', point.x, point.y - 52, 22, '#f2c94c', 'center', 'bold');
  }

  /** Pos balapan: lingkaran bernomor di pantai. */
  function drawRaceCheckpoints(world) {
    const active = world.missions.active;
    if (!active || active.def.id !== 5) return;
    const step = active.def.stages[active.stage];
    if (!step || step.kind !== 'race') return;
    step.checkpoints.forEach((cp, index) => {
      const done = index < active.checkpoints;
      const current = index === active.checkpoints;
      ctx.fillStyle = done ? '#2ecc71' : current ? '#f2c94c' : '#dfe6e9';
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, current ? 26 : 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 2;
      ctx.stroke();
      text(String(index + 1), cp.x, cp.y + 6, 18, '#2d3436', 'center', 'bold');
    });
  }

  /** Semua makhluk dan kendaraan di dunia. */
  function drawEntities(world) {
    const cam = world.camera;
    const halfW = VIEW_W / 2 / cam.zoom + 100;
    const halfH = VIEW_H / 2 / cam.zoom + 100;
    const visible = (x, y) => x > cam.x - halfW && x < cam.x + halfW && y > cam.y - halfH && y < cam.y + halfH;

    // Jejak ban.
    for (const skid of world.skids) {
      if (!visible(skid.x, skid.y)) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, skid.life * 0.4);
      ctx.translate(skid.x, skid.y);
      ctx.rotate(skid.angle);
      ctx.fillStyle = '#222';
      ctx.fillRect(-14, -12, 28, 3);
      ctx.fillRect(-14, 9, 28, 3);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Uang tersebar: berkilau.
    for (const pickup of world.pickups) {
      if (!visible(pickup.x, pickup.y)) continue;
      const bobY = Math.sin(pickup.bob) * 3;
      ctx.fillStyle = '#f2c94c';
      ctx.save();
      ctx.translate(pickup.x, pickup.y + bobY);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
      text('$', pickup.x, pickup.y + bobY - 12, 14, '#f2c94c', 'center', 'bold');
    }

    for (const car of world.cars) {
      if (!visible(car.x, car.y)) continue;
      drawCarShape(ctx, car, world.time);
    }
    for (const car of world.policeCars) {
      if (!visible(car.x, car.y)) continue;
      drawCarShape(ctx, car, world.time);
    }
    for (const ped of world.peds) {
      if (!visible(ped.x, ped.y)) continue;
      drawPedestrian(ctx, ped);
    }
    // Polisi jalan kaki: seragam biru gelap.
    for (const officer of world.wanted.officers) {
      if (!visible(officer.x, officer.y)) continue;
      ctx.save();
      ctx.translate(officer.x, officer.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(2, 3, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(officer.angle);
      ctx.fillStyle = '#1e3799';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5d7b0';
      ctx.beginPath();
      ctx.arc(4, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e3799';
      ctx.beginPath();
      ctx.arc(2, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    drawPlayer(ctx, world.player, world.time);

    // Peluru: garis terang pendek.
    ctx.strokeStyle = '#ffeaa7';
    ctx.lineWidth = 3;
    for (const b of world.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Partikel.
    for (const p of world.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** HUD: uang, nyawa, bintang buron, tujuan misi, dan minimap. */
  function drawHud(world, ui) {
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Panel kiri atas: uang, misi, dan nyawa — tiga baris tanpa tumpang tindih.
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    ctx.beginPath();
    ctx.roundRect(16, 14, 280, 72, 10);
    ctx.fill();
    text(`$${world.player.money}`, 30, 44, 26, '#f2c94c', 'left', 'bold');
    text(`Misi ${world.missions.completed}/${MISSIONS.length}`, 180, 42, 15, '#dfe6e9');
    // Bar nyawa.
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(30, 56, 170, 12);
    ctx.fillStyle = world.player.health > 30 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(30, 56, 170 * Math.max(0, world.player.health) / 100, 12);
    text('NYAWA', 210, 68, 11, '#dfe6e9');

    // Bintang buron kanan atas.
    const level = world.wanted.level;
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    ctx.beginPath();
    ctx.roundRect(VIEW_W - 230, 14, 214, 44, 10);
    ctx.fill();
    for (let i = 0; i < WANTED.maxLevel; i += 1) {
      const filled = i < level;
      const blink = filled && world.wanted.bustTimer > 0 && Math.floor(world.time * 6) % 2 === 0;
      text('★', VIEW_W - 214 + i * 40, 46, 30, filled ? (blink ? '#ff6b35' : '#f2c94c') : '#576574', 'left', 'bold');
    }
    if (level > 0) text('BURON', VIEW_W - 214, 52, 11, '#ff6b35', 'left', 'bold');

    // Tujuan misi kiri bawah — lebar panel mengikuti panjang teks.
    const objective = currentObjective(world.missions);
    const objLabel = '◎ ' + objective.text;
    ctx.font = `16px ${FONT}`;
    const objWidth = Math.min(680, ctx.measureText(objLabel).width + 28);
    ctx.fillStyle = 'rgba(20,24,32,0.72)';
    ctx.beginPath();
    ctx.roundRect(16, VIEW_H - 66, objWidth, 50, 10);
    ctx.fill();
    text(objLabel, 30, VIEW_H - 34, 16, '#ffffff');

    // Kecepatan saat mengemudi — di kanan bawah, di kiri minimap.
    if (world.player.inCar) {
      const kmh = Math.round(Math.abs(world.player.inCar.speed) * 0.55);
      text(`${kmh} km/j`, VIEW_W - 250, VIEW_H - 28, 24, '#ffffff', 'right', 'bold');
      text(world.player.inCar.kind === 'polisi' ? 'Mobil Polisi' : `Mobil ${world.player.inCar.kind}`, VIEW_W - 250, VIEW_H - 54, 13, '#dfe6e9', 'right');
    }

    // Petunjuk konteks — pil kecil di tengah atas, jauh dari panel lain.
    let hint = 'WASD jalan • Shift lari • F pukul • Klik tembak • P jeda • H bantuan • M suara';
    if (!world.player.inCar) {
      const near = world.cars.some((c) => !c.wrecked && Math.hypot(c.x - world.player.x, c.y - world.player.y) < 62);
      if (near) hint = 'Tekan E untuk masuk mobil';
      else if (world.missions.active === null && Math.hypot(world.player.x - PLACES.rumahRosa.x, world.player.y - PLACES.rumahRosa.y) < 110) {
        hint = 'Tekan E untuk mulai misi berikutnya';
      }
    } else {
      hint = 'WASD mengemudi • E keluar mobil • P jeda • H bantuan';
    }
    ctx.font = `13px ${FONT}`;
    const hintWidth = ctx.measureText(hint).width + 28;
    ctx.fillStyle = 'rgba(20,24,32,0.6)';
    ctx.beginPath();
    ctx.roundRect(VIEW_W / 2 - hintWidth / 2, 12, hintWidth, 26, 13);
    ctx.fill();
    text(hint, VIEW_W / 2, 30, 13, 'rgba(255,255,255,0.9)', 'center');

    // Spanduk misi dan pesan kecil.
    if (world.missions.banner) {
      ctx.fillStyle = 'rgba(20,24,32,0.8)';
      ctx.beginPath();
      ctx.roundRect(VIEW_W / 2 - 300, 96, 600, 56, 12);
      ctx.fill();
      text(world.missions.banner.text, VIEW_W / 2, 132, 26, '#f2c94c', 'center', 'bold');
    }
    if (world.missions.toast) {
      ctx.fillStyle = 'rgba(20,24,32,0.72)';
      const toastText = world.missions.toast.text;
      ctx.beginPath();
      ctx.roundRect(VIEW_W / 2 - Math.min(420, toastText.length * 4.5 + 20), 164, Math.min(840, toastText.length * 9 + 40), 36, 10);
      ctx.fill();
      text(toastText, VIEW_W / 2, 188, 15, '#ffffff', 'center');
    }
    // Hitungan tertangkap.
    if (world.wanted.bustTimer > 0) {
      text('POLISI MENANGKAPMU!', VIEW_W / 2, 240, 30, '#ff3b30', 'center', 'bold');
    }
    // Suara mati.
    if (ui.muted) text('SUARA MATI (M)', VIEW_W - 250, VIEW_H - 80, 13, '#dfe6e9', 'right');
    if (ui.saveNote) text(ui.saveNote, VIEW_W / 2, VIEW_H - 40, 14, '#2ecc71', 'center', 'bold');

    drawMinimap(world);
  }

  /** Minimap: seluruh kota kecil di pojok kanan bawah. */
  function drawMinimap(world) {
    const mw = 210;
    const mh = 152;
    const mx = VIEW_W - mw - 16;
    const my = VIEW_H - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = 'rgba(20,24,32,0.78)';
    ctx.beginPath();
    ctx.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(mx, my, WORLD.waterEdge * sx, mh);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(mx + WORLD.waterEdge * sx, my, (WORLD.sandEdge - WORLD.waterEdge) * sx, mh);
    ctx.strokeStyle = '#3d434d';
    ctx.lineWidth = 2;
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(mx + rx * sx, my);
      ctx.lineTo(mx + rx * sx, my + mh);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(mx, my + ry * sy);
      ctx.lineTo(mx + mw, my + ry * sy);
      ctx.stroke();
    }
    // Titik misi berdenyut.
    const objective = currentObjective(world.missions);
    if (objective.point) {
      const pulse = 3 + Math.sin(world.time * 5) * 1.5;
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(mx + objective.point.x * sx, my + objective.point.y * sy, pulse + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Polisi: titik biru. Pemain: panah putih.
    ctx.fillStyle = '#74b9ff';
    for (const car of world.policeCars) {
      ctx.beginPath();
      ctx.arc(mx + car.x * sx, my + car.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.save();
    ctx.translate(mx + world.player.x * sx, my + world.player.y * sy);
    ctx.rotate(world.player.angle);
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 6, my - 6, mw + 12, mh + 12);
    text('SOLARA BAY', mx + mw / 2, my - 12, 11, '#ffffff', 'center', 'bold');
  }

  /** Panel tengah untuk layar menu dan akhir. */
  function drawPanel(title, lines, prompt, accent = '#f2c94c') {
    const width = 640;
    const lineHeight = 30;
    const height = 150 + lines.length * lineHeight + 60;
    const x = (VIEW_W - width) / 2;
    const y = (VIEW_H - height) / 2;
    ctx.fillStyle = 'rgba(16,20,28,0.88)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 16);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    text(title, VIEW_W / 2, y + 66, 44, accent, 'center', 'bold');
    lines.forEach((line, i) => {
      text(line, VIEW_W / 2, y + 120 + i * lineHeight, 18, '#dfe6e9', 'center');
    });
    if (prompt) text(prompt, VIEW_W / 2, y + height - 28, 18, '#f2c94c', 'center', 'bold');
  }

  function drawTitle(world, ui) {
    drawPanel('SOLARA BAY', [
      'Kota pantai. Uang cepat. Polisi di mana-mana.',
      'Kamu Leo Marín. Mama Rosa punya enam pekerjaan untukmu.',
      'Jelajahi kota, curi mobil, kabur dari polisi, selesaikan cerita.',
      '',
      'WASD jalan & mengemudi • E masuk/keluar mobil • F pukul • Klik tembak',
      'Shift lari • P jeda • H bantuan • M suara • L simpan',
      '',
      ui.saveExists ? 'Simpanan ditemukan — tekan Lanjutkan untuk main dari simpanan.' : 'Tidak ada simpanan. Mulai dari awal.',
    ], ui.saveExists ? 'Enter: Mulai  •  E: Lanjutkan simpanan' : 'Tekan Enter untuk mulai');
  }

  function drawPaused() {
    drawPanel('JEDA', [
      'Permainan berhenti. Kota menunggumu.',
      'L — Simpan permainan   •   M — Suara   •   H — Bantuan',
    ], 'Tekan P untuk lanjut');
  }

  function drawHelp() {
    drawPanel('BANTUAN', [
      'WASD / Panah — jalan kaki dan mengemudi',
      'E — masuk / keluar mobil    •    F — pukul',
      'Klik tetikus — tembak ke arah kursor',
      'Shift — lari    •    P — jeda    •    M — suara    •    L — simpan',
      'Curi mobil dengan E di dekat mobil. Polisi datang bila bintang naik.',
      'Misi dimulai di Rumah Mama Rosa (tanda R di peta).',
      'Uang tunai tersebar di trotoar — ambil selagi jalan.',
    ], 'Tekan H atau P untuk kembali');
  }

  function drawOver(world, ui) {
    drawPanel('KAMU TUMBANG', [
      `Leo dibawa ke rumah sakit. Uangmu: $${world.player.money}.`,
      `Misi selesai: ${world.missions.completed}/${MISSIONS.length} • Mobil dicuri: ${world.stats.stolen}`,
    ], 'Tekan Enter untuk bangkit lagi', '#e74c3c');
  }

  function drawBusted(world) {
    drawPanel('TERTANGKAP!', [
      'Polisi membawamu ke rumah sakit. Sebagian uangmu disita.',
      `Uangmu sekarang: $${world.player.money}.`,
    ], 'Tekan Enter untuk lanjut', '#ff6b35');
  }

  function drawStory(world) {
    drawPanel('CERITA SELESAI!', [
      'Leo dan Mama Rosa akhirnya bebas. Solara Bay milik kalian.',
      `Uang: $${world.player.money} • Misi: ${world.missions.completed}/6 • Mobil dicuri: ${world.stats.stolen}`,
      'Kota tetap terbuka — jelajahi, balapan, dan cari uang sesukamu.',
    ], 'Tekan Enter untuk terus bermain', '#2ecc71');
  }

  /** Gambar satu bingkai penuh untuk layar yang diminta. */
  function draw(world, screen, ui) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#10141c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    if (screen === SCREEN_TITLE) {
      // Latar judul: kota dari atas dengan lalu lintas berjalan.
      ctx.save();
      ctx.translate(VIEW_W / 2, VIEW_H / 2);
      ctx.scale(world.camera.zoom, world.camera.zoom);
      ctx.translate(-world.camera.x, -world.camera.y);
      drawGround(world);
      drawCityDetails(world);
      drawEntities(world);
      ctx.restore();
      ctx.fillStyle = 'rgba(10,14,22,0.45)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawTitle(world, ui);
      return;
    }

    // Dunia dari kamera pemain.
    ctx.save();
    ctx.translate(VIEW_W / 2, VIEW_H / 2);
    ctx.scale(world.camera.zoom, world.camera.zoom);
    ctx.translate(-world.camera.x, -world.camera.y);
    drawGround(world);
    drawCityDetails(world);
    drawMissionMarker(world);
    drawRaceCheckpoints(world);
    drawEntities(world);
    ctx.restore();

    drawHud(world, ui);
    if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_HELP) drawHelp();
    else if (screen === SCREEN_OVER) drawOver(world, ui);
    else if (screen === SCREEN_BUSTED) drawBusted(world);
    else if (screen === SCREEN_STORY) drawStory(world);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize };
}

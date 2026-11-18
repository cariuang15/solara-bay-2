// Simpanan permainan di peramban (localStorage): uang, misi yang selesai,
// posisi Leo, dan pengaturan suara. Gagal menyimpan tidak pernah
// menghentikan permainan — simpanan hanya tidak bertahan.

import { SAVE_KEY } from './config.js';

/** Baca simpanan; null bila tidak ada atau rusak. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

/** Tulis keadaan permainan ke simpanan. Mengembalikan true bila berhasil. */
export function saveGame(world, muted) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      money: world.player.money,
      missions: world.missions.completed,
      health: world.player.health,
      x: world.player.x,
      y: world.player.y,
      stolen: world.stats.stolen,
      earned: world.stats.earned,
      muted: !!muted,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Terapkan simpanan ke dunia yang sudah dibuat. */
export function applySave(world, data) {
  if (!data) return;
  if (typeof data.money === 'number') world.player.money = data.money;
  if (typeof data.missions === 'number') {
    world.missions.completed = Math.max(0, Math.min(6, data.missions));
  }
  if (typeof data.health === 'number') world.player.health = data.health;
  if (typeof data.x === 'number' && typeof data.y === 'number') {
    world.player.x = data.x;
    world.player.y = data.y;
    world.camera.x = data.x;
    world.camera.y = data.y;
  }
  if (typeof data.stolen === 'number') world.stats.stolen = data.stolen;
  if (typeof data.earned === 'number') world.stats.earned = data.earned;
}

/** Hapus simpanan. */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Abaikan.
  }
}

// Angka acak berbiji (seeded): biji yang sama selalu memberi urutan yang sama,
// sehingga adegan screenshot bisa diulang persis dan permainan terasa adil.

/** Membuat fungsi acak dari sebuah biji bilangan bulat. */
export function makeRandom(seed) {
  let state = (seed >>> 0) || 1;
  // Algoritme mulberry32: kecil, cepat, dan cukup merata untuk game ini.
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Objek pembantu di atas satu fungsi acak: rentang, pilihan, dan acak urutan. */
export function makeDice(seed) {
  const roll = makeRandom(seed);
  return {
    /** Bilangan 0..1. */
    roll,
    /** Bilangan dalam [min, max). */
    range(min, max) {
      return min + roll() * (max - min);
    },
    /** Bilangan bulat dalam [min, max]. */
    int(min, max) {
      return min + Math.floor(roll() * (max - min + 1));
    },
    /** Satu unsur acak dari daftar. */
    pick(list) {
      return list[Math.floor(roll() * list.length)];
    },
    /** Benar dengan peluang p (0..1). */
    chance(p) {
      return roll() < p;
    },
  };
}

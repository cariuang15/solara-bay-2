// Solara Bay — pintu masuk entry gta6-01 (Node 22, pustaka standar saja).
//
// Game-nya ada di folder game/ di samping berkas ini: berkas statis polos
// (game/index.html beserta modul-modul ES-nya, tanpa pustaka dan tanpa
// permintaan jaringan) yang bisa dibuka di peramban desktop. Program ini
// menyerahkan game itu: menyalin game/ dan screenshots/ dari samping
// berkas ini ke /output, lalu menulis /output/dossier.json — ringkasan
// yang dibaca juri — dengan pustaka make.fun yang ikut disertakan.
//
// Di luar wadah penilai, MAKEFUN_OUTPUT_DIR menggantikan /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Mainkan dulu di mesin sendiri dengan `node serve.ts`,
// lalu buka http://localhost:8080.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Folder tempat berkas ini berada, dan folder keluaran yang dituju.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Batas-batas penilai (sesuai gate.json): teks dossier dibatasi
// 163.840 byte; sisanya menolak entry yang memang akan ditolak penilai
// (lebih dari 4 screenshot atau satu di atas 256 KiB; game/ lebih dari
// 993 berkas atau 48 MiB; ada path di bawah game/ yang lebih panjang
// dari 1000 byte).
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

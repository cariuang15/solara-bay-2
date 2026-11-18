// Uji main Solara Bay secara otomatis di Chrome headless: jalan, curi
// mobil, mengemudi, tembak, pukul, jeda, bantuan, buron, keenam misi,
// tertangkap, dan simpan. Keluar 1 bila ada yang gagal.
// Jalankan dari repo: node tools/playtest.mjs
import { spawn } from 'node:child_process';
import { launchChrome, Tab, sleep } from './cdp.mjs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}${detail ? ' — ' + detail : ''}`);
}

const server = spawn('node', ['serve.ts', '--port', '8080'], { cwd: root, stdio: 'ignore' });
await sleep(1500);

let chrome = null;
try {
  chrome = await launchChrome();
  const tab = await Tab.create('http://127.0.0.1:8080/?seed=99');
  await tab.send('Network.enable');
  const externalRequests = [];
  tab.ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Network.requestWillBeSent') {
      const url = message.params.request.url;
      if (!url.startsWith('http://127.0.0.1:8080') && !url.startsWith('data:')) {
        externalRequests.push(url);
      }
    }
  });
  await sleep(2000);

  const state = async () => tab.evaluate(`(() => {
    const w = window.__solara.world;
    return {
      screen: window.__solara.screen(),
      x: Math.round(w.player.x), y: Math.round(w.player.y),
      money: w.player.money, health: Math.round(w.player.health),
      inCar: !!w.player.inCar,
      speed: w.player.inCar ? Math.round(w.player.inCar.speed) : 0,
      wanted: w.wanted.level, heat: Math.round(w.wanted.heat),
      policeCars: w.policeCars.length, officers: w.wanted.officers.length,
      missionsDone: w.missions.completed,
      missionActive: w.missions.active ? w.missions.active.def.id : 0,
      missionStage: w.missions.active ? w.missions.active.stage : -1,
      cars: w.cars.length, peds: w.peds.length,
      bullets: w.bullets.length, shots: w.stats.shots,
    };
  })()`);

  // 1. Judul tampil, tanpa error konsol saat muat.
  let s = await state();
  check('Layar judul tampil', s.screen === 'title', s.screen);
  check('Tidak ada error konsol saat muat', tab.consoleErrors.length === 0, tab.consoleErrors.join(' | '));

  // 2. Mulai permainan.
  await tab.press('Enter', 'Enter');
  await sleep(600);
  s = await state();
  check('Enter memulai permainan', s.screen === 'play', s.screen);

  // 3. Jalan kaki dengan WASD.
  const before = await state();
  await tab.hold('KeyW', 'w', 900);
  await tab.hold('KeyD', 'd', 500);
  s = await state();
  check('WASD menggerakkan Leo', Math.hypot(s.x - before.x, s.y - before.y) > 60, `pindah ${Math.round(Math.hypot(s.x - before.x, s.y - before.y))}px`);

  // 4. Curi mobil parkir: teleport ke samping mobil parkir lalu tekan E.
  await tab.evaluate(`(() => {
    const w = window.__solara.world;
    const parked = w.cars.find((c) => c.driver === 'parkir' && !c.wrecked);
    w.player.x = parked.x + 40; w.player.y = parked.y;
    w.camera.x = w.player.x; w.camera.y = w.player.y;
    return parked.kind;
  })()`);
  await sleep(300);
  await tab.press('KeyE', 'e');
  await sleep(400);
  s = await state();
  check('E masuk ke mobil parkir', s.inCar, `inCar=${s.inCar}`);

  // 5. Mengemudi: gas dan belok.
  const driveBefore = await state();
  await tab.hold('KeyW', 'w', 1500);
  s = await state();
  check('Mobil melaju saat gas', Math.abs(s.speed) > 80, `kecepatan ${s.speed}`);
  check('Mobil berpindah tempat', Math.hypot(s.x - driveBefore.x, s.y - driveBefore.y) > 150, `pindah ${Math.round(Math.hypot(s.x - driveBefore.x, s.y - driveBefore.y))}px`);

  // 6. Keluar mobil.
  await tab.press('KeyE', 'e');
  await sleep(400);
  s = await state();
  check('E keluar dari mobil', !s.inCar, `inCar=${s.inCar}`);

  // 7. Tembak: klik ke arah kanan atas layar.
  const shotsBefore = (await state()).shots;
  await tab.click(1000, 200);
  await sleep(400);
  s = await state();
  check('Klik menembak', s.shots > shotsBefore, `tembakan ${shotsBefore} -> ${s.shots}`);
  check('Tembakan menaikkan panas buron', s.heat > 0 || s.wanted > 0, `panas ${s.heat}`);

  // 8. Pukul (F) — tidak boleh error.
  await tab.press('KeyF', 'f');
  await sleep(300);
  s = await state();
  check('F memukul tanpa error', tab.consoleErrors.length === 0, tab.consoleErrors.join(' | '));

  // 9. Jeda dan bantuan.
  await tab.press('KeyP', 'p');
  await sleep(300);
  s = await state();
  check('P menjeda', s.screen === 'paused', s.screen);
  await tab.press('KeyP', 'p');
  await sleep(300);
  s = await state();
  check('P melanjutkan', s.screen === 'play', s.screen);
  await tab.press('KeyH', 'h');
  await sleep(300);
  s = await state();
  check('H membuka bantuan', s.screen === 'help', s.screen);
  await tab.press('KeyH', 'h');
  await sleep(300);
  s = await state();
  check('H menutup bantuan', s.screen === 'play', s.screen);

  // 10. Buron: naikkan ke 3 bintang, polisi harus mengejar.
  await tab.evaluate(`(() => { const w = window.__solara.world; w.setWanted(3); return true; })()`);
  await sleep(2000);
  s = await state();
  check('Buron 3 bintang memunculkan polisi', s.policeCars >= 2 && s.wanted === 3, `${s.policeCars} mobil polisi, bintang ${s.wanted}`);
  // Bersihkan buron supaya polisi jalan kaki tidak menangkap Leo di tengah tes.
  await tab.evaluate(`(() => {
    const w = window.__solara.world;
    w.setWanted(0); w.wanted.heat = 0;
    w.policeCars.length = 0; w.wanted.officers.length = 0;
    return true;
  })()`);
  await sleep(300);
  s = await state();
  check('Buron hilang setelah dibersihkan', s.wanted === 0 && s.policeCars === 0, `bintang ${s.wanted}`);

  // 11. Simpan (L) dan muat simpanan.
  await tab.press('KeyL', 'l');
  await sleep(400);
  const saved = await tab.evaluate(`window.localStorage.getItem('solara-bay-save-v1')`);
  check('L menyimpan permainan', !!saved && JSON.parse(saved).money === (await state()).money, saved ? `uang ${JSON.parse(saved).money}` : 'kosong');

  // 12. Misi 1: mulai di Rumah Rosa, antar ke dermaga lalu toko.
  await tab.evaluate(`(() => {
    const w = window.__solara.world;
    w.setWanted(0); w.wanted.heat = 0; w.policeCars.length = 0; w.wanted.officers.length = 0;
    w.player.x = 980; w.player.y = 1860; w.camera.x = 980; w.camera.y = 1860;
    return true;
  })()`);
  await sleep(300);
  await tab.press('Enter', 'Enter');
  await sleep(400);
  s = await state();
  check('Misi 1 dimulai di Rumah Rosa', s.missionActive === 1 && s.missionStage === 0, `misi ${s.missionActive} tahap ${s.missionStage}`);
  await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = 2100; w.player.y = 2480; w.camera.x = 2100; w.camera.y = 2480; return true; })()`);
  await sleep(500);
  s = await state();
  check('Misi 1 tahap 2 (antar ke toko)', s.missionActive === 1 && s.missionStage === 1, `tahap ${s.missionStage}`);
  await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = 980; w.player.y = 1760; w.camera.x = 980; w.camera.y = 1760; return true; })()`);
  await sleep(500);
  s = await state();
  check('Misi 1 selesai + dibayar', s.missionsDone === 1 && s.money >= 400, `misi ${s.missionsDone}, uang $${s.money}`);

  // 13. Misi 2: kabur ke Rumah Aman dengan buron 2.
  await tab.press('Enter', 'Enter');
  await sleep(400);
  s = await state();
  check('Misi 2 dimulai (buron 2)', s.missionActive === 2 && s.wanted >= 2, `misi ${s.missionActive}, bintang ${s.wanted}`);
  await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = 700; w.player.y = 560; w.camera.x = 700; w.camera.y = 560; return true; })()`);
  await sleep(500);
  s = await state();
  check('Misi 2 selesai', s.missionsDone === 2, `misi ${s.missionsDone}`);

  // 14. Misi 3: bank (tahan 4 detik) lalu kabur ke Rosa.
  await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = 980; w.player.y = 1860; w.camera.x = 980; w.camera.y = 1860; return true; })()`);
  await sleep(300);
  await tab.press('Enter', 'Enter');
  await sleep(400);
  await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = 1680; w.player.y = 785; w.camera.x = 1680; w.camera.y = 785; return true; })()`);
  await sleep(500);
  s = await state();
  check('Misi 3 tahap brankas', s.missionActive === 3 && s.missionStage === 1, `tahap ${s.missionStage}`);
  await sleep(4500);
  s = await state();
  check('Brankas terbuka setelah 4 detik', s.missionActive === 3 && s.missionStage === 2, `tahap ${s.missionStage}`);
  await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = 980; w.player.y = 1860; w.camera.x = 980; w.camera.y = 1860; return true; })()`);
  await sleep(500);
  s = await state();
  check('Misi 3 selesai', s.missionsDone === 3, `misi ${s.missionsDone}`);

  // 15. Misi 4: jemput Dani di plaza, antar ke Rumah Aman.
  await tab.press('Enter', 'Enter');
  await sleep(400);
  await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = 1680; w.player.y = 1300; w.camera.x = 1680; w.camera.y = 1300; return true; })()`);
  await sleep(500);
  s = await state();
  check('Misi 4 tahap antar Dani', s.missionActive === 4 && s.missionStage === 1, `tahap ${s.missionStage}`);
  await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = 700; w.player.y = 560; w.camera.x = 700; w.camera.y = 560; return true; })()`);
  await sleep(500);
  s = await state();
  check('Misi 4 selesai', s.missionsDone === 4, `misi ${s.missionsDone}`);

  // 16. Misi 5: balapan pantai — lewati 4 pos.
  await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = 980; w.player.y = 1860; w.camera.x = 980; w.camera.y = 1860; return true; })()`);
  await sleep(300);
  await tab.press('Enter', 'Enter');
  await sleep(400);
  s = await state();
  check('Misi 5 dimulai (balapan)', s.missionActive === 5, `misi ${s.missionActive}`);
  for (const [x, y] of [[240, 900], [240, 1500], [240, 2100], [240, 2440]]) {
    await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = ${x}; w.player.y = ${y}; w.camera.x = ${x}; w.camera.y = ${y}; return true; })()`);
    await sleep(400);
  }
  s = await state();
  check('Misi 5 selesai (balapan dimenangkan)', s.missionsDone === 5, `misi ${s.missionsDone}`);

  // 17. Misi 6: kasino (tahan 6 detik) lalu kabur ke marina.
  await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = 980; w.player.y = 1860; w.camera.x = 980; w.camera.y = 1860; return true; })()`);
  await sleep(300);
  await tab.press('Enter', 'Enter');
  await sleep(400);
  await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = 2940; w.player.y = 505; w.camera.x = 2940; w.camera.y = 505; return true; })()`);
  await sleep(500);
  s = await state();
  check('Misi 6 tahap brankas kasino', s.missionActive === 6 && s.missionStage === 1, `tahap ${s.missionStage}`);
  await sleep(6500);
  s = await state();
  check('Brankas kasino terbuka (6 detik)', s.missionActive === 6 && s.missionStage === 2, `tahap ${s.missionStage}`);
  check('Buron naik ke 5 saat kabur', s.wanted === 5, `bintang ${s.wanted}`);
  await tab.evaluate(`(() => { const w = window.__solara.world; w.player.x = 220; w.player.y = 2320; w.camera.x = 220; w.camera.y = 2320; return true; })()`);
  await sleep(800);
  s = await state();
  check('Cerita selesai (layar akhir)', s.screen === 'story' && s.missionsDone === 6, `layar ${s.screen}, misi ${s.missionsDone}`);
  await tab.press('Enter', 'Enter');
  await sleep(400);
  s = await state();
  check('Lanjut main bebas setelah cerita', s.screen === 'play', s.screen);

  // 18. Tertangkap: buron + polisi jalan kaki di samping Leo.
  await tab.evaluate(`(() => {
    const w = window.__solara.world;
    w.setWanted(2);
    w.wanted.officers.push({ x: w.player.x + 10, y: w.player.y, angle: 0, speed: 0 });
    return true;
  })()`);
  await sleep(2500);
  s = await state();
  check('Tertangkap polisi (layar busted)', s.screen === 'busted', `layar ${s.screen}`);
  await tab.press('Enter', 'Enter');
  await sleep(400);
  s = await state();
  check('Bangun lagi setelah tertangkap', s.screen === 'play', s.screen);

  // 19. Tidak ada permintaan jaringan eksternal.
  check('Nol permintaan jaringan eksternal', externalRequests.length === 0, externalRequests.join(', '));
  check('Tidak ada error konsol selama tes', tab.consoleErrors.length === 0, tab.consoleErrors.join(' | '));

  await tab.close();
} finally {
  if (chrome) chrome.kill();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lulus.`);
if (failed.length > 0) process.exit(1);
console.log('Semua pemeriksaan lulus.');

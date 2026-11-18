// Solara Bay — pengaturan dunia, angka permainan, dan naskah misi.
// Semua teks di dalam game berbahasa Indonesia. Kota ini fiktif dan orisinal.

export const WORLD = {
  width: 3600,
  height: 2600,
  // Pantai di sisi barat: laut, lalu pasir, lalu kota.
  waterEdge: 140,
  sandEdge: 300,
  roadWidth: 96,
  lane: 26,
};

export const ROADS_X = [420, 840, 1260, 1680, 2100, 2520, 2940, 3360];
export const ROADS_Y = [360, 760, 1160, 1560, 1960, 2360];

// Lokasi bernama di kota (x, y dalam piksel dunia).
export const PLACES = {
  rumahRosa: { x: 980, y: 1860, label: 'Rumah Mama Rosa' },
  tokoRosa: { x: 980, y: 1760, label: 'Toko Rosa' },
  bank: { x: 1680, y: 700, label: 'Bank Teluk' },
  bankPintu: { x: 1680, y: 785, label: 'Pintu Bank' },
  dermaga: { x: 2100, y: 2480, label: 'Dermaga' },
  kasino: { x: 2940, y: 420, label: 'Kasino Cahaya' },
  kasinoPintu: { x: 2940, y: 505, label: 'Pintu Kasino' },
  marina: { x: 220, y: 2320, label: 'Marina' },
  rumahSakit: { x: 1260, y: 1240, label: 'Rumah Sakit' },
  kantorPolisi: { x: 2520, y: 1240, label: 'Kantor Polisi' },
  rumahAman: { x: 700, y: 560, label: 'Rumah Aman' },
  plaza: { x: 1680, y: 1300, label: 'Plaza Merdeka' },
  balapStart: { x: 240, y: 420, label: 'Garis Start' },
};

export const PLAYER = {
  radius: 13,
  walkSpeed: 165,
  runSpeed: 265,
  health: 100,
  punchDamage: 30,
  punchRange: 46,
  punchArc: 1.1,
  shootDamage: 34,
  bulletSpeed: 760,
  bulletRange: 560,
};

export const CAR = {
  // Per jenis mobil: akselerasi, kecepatan puncak, belok, dan nyawa.
  kinds: {
    sedan: { accel: 260, top: 330, turn: 2.6, hp: 100, color: '#c94f43', label: 'Sedan' },
    taksi: { accel: 270, top: 340, turn: 2.7, hp: 100, color: '#f2b705', label: 'Taksi' },
    van: { accel: 190, top: 260, turn: 2.1, hp: 140, color: '#7d8aa0', label: 'Van' },
    sport: { accel: 380, top: 470, turn: 3.1, hp: 80, color: '#2e86de', label: 'Sport' },
    truk: { accel: 160, top: 230, turn: 1.8, hp: 180, color: '#5d6d7e', label: 'Truk' },
    polisi: { accel: 340, top: 430, turn: 3.0, hp: 160, color: '#1c2733', label: 'Polisi' },
  },
  width: 26,
  length: 48,
  trafficSpeed: 150,
};

export const WANTED = {
  // Panas 0..100 di tiap tingkat; naik karena kejahatan, turun saat bersembunyi.
  maxLevel: 5,
  decayPerSecond: 2.2,
  decayHiddenBonus: 3.0,
  stealHeat: 14,
  punchHeat: 10,
  shootHeat: 12,
  killHeat: 22,
  // Jumlah mobil polisi yang mengejar di tiap tingkat.
  policeCars: [0, 1, 2, 3, 4, 5],
  // Jumlah polisi jalan kaki di tiap tingkat.
  officers: [0, 0, 1, 2, 3, 4],
  bustSeconds: 1.4,
};

export const MISSIONS = [
  {
    id: 1,
    title: 'Paket untuk Rosa',
    pay: 400,
    intro: 'Mama Rosa: "Leo, ambil paketku di dermaga, lalu antar ke tokoku. Jangan sampai rusak!"',
    stages: [
      { kind: 'goto', text: 'Ambil paket di Dermaga', at: 'dermaga', radius: 90 },
      { kind: 'goto', text: 'Antar paket ke Toko Rosa', at: 'tokoRosa', radius: 90 },
    ],
  },
  {
    id: 2,
    title: 'Kabur dari Razia',
    pay: 600,
    intro: 'Mama Rosa: "Polisi menggelar razia! Mereka sudah mengincarmu. Kabur ke Rumah Aman, jangan sampai ketangkap!"',
    wanted: 2,
    stages: [
      { kind: 'escape', text: 'Kabur ke Rumah Aman tanpa tertangkap', at: 'rumahAman', radius: 100 },
    ],
  },
  {
    id: 3,
    title: 'Tarik Tunai Bank',
    pay: 1200,
    intro: 'Mama Rosa: "Bank Teluk menyimpan uangku. Masuk, ambil tasnya, lalu bawa pulang. Polisi pasti datang!"',
    stages: [
      { kind: 'goto', text: 'Pergi ke Bank Teluk', at: 'bank', radius: 90 },
      { kind: 'hold', text: 'Buka brankas — tahan di dekat pintu (4 detik)', at: 'bankPintu', radius: 70, seconds: 4 },
      { kind: 'goto', text: 'Bawa uangnya ke Rumah Mama Rosa', at: 'rumahRosa', radius: 90, wanted: 3 },
    ],
  },
  {
    id: 4,
    title: 'Jemput Dani',
    pay: 800,
    intro: 'Mama Rosa: "Keponakanku Dani terjebak di Plaza Merdeka. Jemput dia, antar ke Rumah Aman. Polisi mengawasi plaza!"',
    stages: [
      { kind: 'goto', text: 'Jemput Dani di Plaza Merdeka', at: 'plaza', radius: 90, wanted: 2 },
      { kind: 'goto', text: 'Antar Dani ke Rumah Aman', at: 'rumahAman', radius: 100 },
    ],
  },
  {
    id: 5,
    title: 'Balapan Pantai',
    pay: 1500,
    intro: 'Mama Rosa: "Para pembalap pantai menantangmu. Menang, dan nama kita harum di Solara Bay!"',
    stages: [
      {
        kind: 'race', text: 'Balapan pantai — lewati semua pos sebelum rival!',
        checkpoints: [
          { x: 240, y: 900 },
          { x: 240, y: 1500 },
          { x: 240, y: 2100 },
          { x: 240, y: 2440 },
        ],
      },
    ],
  },
  {
    id: 6,
    title: 'Skor Terakhir',
    pay: 2500,
    intro: 'Mama Rosa: "Ini dia, Leo. Kasino Cahaya. Ambil semuanya, lalu kabur ke kapal di Marina. Setelah ini kita bebas!"',
    stages: [
      { kind: 'goto', text: 'Pergi ke Kasino Cahaya', at: 'kasino', radius: 90 },
      { kind: 'hold', text: 'Buka brankas kasino — tahan di dekat pintu (6 detik)', at: 'kasinoPintu', radius: 70, seconds: 6 },
      { kind: 'goto', text: 'Kabur ke kapal di Marina!', at: 'marina', radius: 100, wanted: 5 },
    ],
  },
];

export const SAVE_KEY = 'solara-bay-save-v1';

export const COLORS = {
  grass: '#b9cf8e',
  block: '#d9d2bd',
  sidewalk: '#cfc7ae',
  asphalt: '#3d434d',
  asphaltLine: '#e8c95a',
  sand: '#f0d9a0',
  water: '#3f9fd8',
  waterDeep: '#2b7fb8',
  park: '#8fbf6f',
  roof: ['#c96f4a', '#4a7d96', '#d9a441', '#7d9b6a', '#9a6b9e', '#b0563f', '#5f8a7a', '#a87c4f'],
  palm: '#3f9153',
  trunk: '#8a6b45',
};

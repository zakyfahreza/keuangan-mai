/**
 * DATA LAYER - Laporan Keuangan Masjid Al-Ikhlas Adi Sucipto
 * Semua operasi CRUD dan kalkulasi keuangan
 */

const DB_COLLECTION = 'transaksi';
const INFO_KEY = 'masjid_info';
const AUTH_KEY = 'masjid_auth';

// ─── Inisialisasi Data Awal ────────────────────────────────────────────────
async function initData() {
  if (!localStorage.getItem(INFO_KEY)) {
    localStorage.setItem(INFO_KEY, JSON.stringify({
      nama: 'Masjid Al-Ikhlas Adi Sucipto',
      alamat: 'Jl. Adi Sucipto, Surakarta',
      kontak: ''
    }));
  }
  if (!localStorage.getItem(AUTH_KEY)) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ users: DEFAULT_USERS }));
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────
// Default 3 Users
const DEFAULT_USERS = [
  { username: 'Bendahara Akhwat', password: 'adminmai13245' },
  { username: 'Bendahara Ikhwan', password: 'adminmai13245' },
  { username: 'Ketua Takmir', password: 'adminmai13245' }
];

function getUsers() {
  const auth = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
  return auth.users || DEFAULT_USERS;
}

function setPassword(username, newPass) {
  const users = getUsers();
  const idx = users.findIndex(u => u.username === username);
  if (idx !== -1) {
    users[idx].password = newPass;
    localStorage.setItem(AUTH_KEY, JSON.stringify({ users }));
  }
}

function isLoggedIn() {
  return sessionStorage.getItem('masjid_logged_in') === 'true';
}

function getLoggedInUser() {
  return sessionStorage.getItem('masjid_user') || 'Admin';
}

function login(username, pass) {
  const users = getUsers();
  const user = users.find(u => u.username === username && u.password === pass);
  if (user) {
    sessionStorage.setItem('masjid_logged_in', 'true');
    sessionStorage.setItem('masjid_user', user.username);
    return true;
  }
  return false;
}

function logout() {
  sessionStorage.removeItem('masjid_logged_in');
  sessionStorage.removeItem('masjid_user');
}

// ─── Info Masjid ──────────────────────────────────────────────────────────
let cachedInfo = null;
let infoListeners = [];

db.collection('info').doc('main').onSnapshot(doc => {
  if (doc.exists) {
    cachedInfo = doc.data();
  } else {
    cachedInfo = {
      nama: 'Masjid Al-Ikhlas Adi Sucipto',
      alamat: 'Jl. Adi Sucipto, Surakarta',
      kontak: ''
    };
  }
  infoListeners.forEach(cb => cb(cachedInfo));
});

async function getInfo() {
  if (cachedInfo === null) {
    await new Promise(r => {
      const check = setInterval(() => {
        if (cachedInfo !== null) { clearInterval(check); r(); }
      }, 50);
    });
  }
  return cachedInfo;
}

async function setInfo(info) {
  await db.collection('info').doc('main').set(info);
}

// ─── CRUD Transaksi ───────────────────────────────────────────────────────
// ─── CRUD Transaksi ───────────────────────────────────────────────────────
let cachedTransaksi = null;
let transaksiListeners = [];

db.collection(DB_COLLECTION).onSnapshot(snapshot => {
  const list = [];
  snapshot.forEach(doc => {
    list.push({ id: doc.id, ...doc.data() });
  });
  cachedTransaksi = list;
  transaksiListeners.forEach(cb => cb(cachedTransaksi));
}, error => {
  console.error("Firebase Snapshot Error:", error);
  if (typeof showToast !== 'undefined') showToast('Gagal memuat data!', 'error');
});

function onTransaksiChanged(cb) {
  transaksiListeners.push(cb);
}

function onInfoChanged(cb) {
  infoListeners.push(cb);
}

async function getAllTransaksi() {
  if (cachedTransaksi === null) {
    await new Promise(r => {
      const check = setInterval(() => {
        if (cachedTransaksi !== null) { clearInterval(check); r(); }
      }, 50);
    });
  }
  return cachedTransaksi;
}

async function getTransaksiByPeriode(bulan, tahun) {
  let list = await getAllTransaksi();
  return list.filter(t => {
    const d = new Date(t.tanggal);
    if (bulan === 'all') return d.getFullYear() === parseInt(tahun);
    return d.getMonth() === parseInt(bulan) && d.getFullYear() === parseInt(tahun);
  }).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
}

async function addTransaksi(data) {
  // We use our uuid or let firestore generate, but let's just let firestore generate the ID
  const docRef = await db.collection(DB_COLLECTION).add(data);
  return { id: docRef.id, ...data };
}

async function editTransaksi(id, data) {
  await db.collection(DB_COLLECTION).doc(id).update(data);
  return true;
}

async function deleteTransaksi(id) {
  await db.collection(DB_COLLECTION).doc(id).delete();
}

// ─── Kalkulasi ────────────────────────────────────────────────────────────
function kalkulasi(transaksiList) {
  let pemasukan = 0, pengeluaran = 0;
  transaksiList.forEach(t => {
    if (t.jenis === 'pemasukan') pemasukan += t.nominal;
    else pengeluaran += t.nominal;
  });
  return { pemasukan, pengeluaran, saldo: pemasukan - pengeluaran };
}

async function getStatistikBulanan(tahun) {
  const list = await getAllTransaksi();
  const all = list.filter(t => new Date(t.tanggal).getFullYear() === parseInt(tahun));
  const stats = [];
  for (let m = 0; m < 12; m++) {
    const bulanData = all.filter(t => new Date(t.tanggal).getMonth() === m);
    const { pemasukan, pengeluaran } = kalkulasi(bulanData);
    stats.push({ bulan: getNamaBulanSingkat(m), pemasukan, pengeluaran });
  }
  return stats;
}

// ─── Sync antar Tab ──────────────────────────────────────────────────────
function triggerSync() {
  // Not needed for Firestore
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function formatDate(date) {
  const d = new Date(date);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatTanggal(dateStr) {
  const d = new Date(dateStr);
  return d.getDate() + ' ' + getNamaBulan(d.getMonth()) + ' ' + d.getFullYear();
}

function formatRupiah(nominal) {
  return 'Rp ' + nominal.toLocaleString('id-ID');
}

function getNamaBulan(m) {
  const b = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return b[m];
}

function getNamaBulanSingkat(m) {
  const b = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
  return b[m];
}

async function getPeriodeOptions() {
  const all = await getAllTransaksi();
  const tahunSet = new Set(all.map(t => new Date(t.tanggal).getFullYear()));
  const currentYear = new Date().getFullYear();
  tahunSet.add(currentYear);
  return Array.from(tahunSet).sort((a, b) => b - a);
}

// Init
initData();

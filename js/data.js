/**
 * DATA LAYER - Laporan Keuangan Masjid Al-Ikhlas Adi Sucipto
 * Semua operasi CRUD dan kalkulasi keuangan
 */

const DB_KEY = 'masjid_keuangan_transaksi';
const INFO_KEY = 'masjid_info';
const AUTH_KEY = 'masjid_auth';

// ─── Inisialisasi Data Awal ────────────────────────────────────────────────
function initData() {
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
  if (!localStorage.getItem(DB_KEY)) {
    // Sample data
    const now = new Date();
    const bulanIni = now.getMonth();
    const tahunIni = now.getFullYear();

    const sampleData = [
      { id: uuid(), jenis: 'pemasukan', tanggal: formatDate(new Date(tahunIni, bulanIni, 7)), nominal: 1250000, kategori: 'Infaq Jumat', keterangan: 'Infaq Jumat, 7 ' + getNamaBulan(bulanIni) + ' ' + tahunIni },
      { id: uuid(), jenis: 'pemasukan', tanggal: formatDate(new Date(tahunIni, bulanIni, 14)), nominal: 975000, kategori: 'Infaq Jumat', keterangan: 'Infaq Jumat, 14 ' + getNamaBulan(bulanIni) + ' ' + tahunIni },
      { id: uuid(), jenis: 'pemasukan', tanggal: formatDate(new Date(tahunIni, bulanIni, 10)), nominal: 500000, kategori: 'Donasi', keterangan: 'Donasi pembangunan masjid' },
      { id: uuid(), jenis: 'pemasukan', tanggal: formatDate(new Date(tahunIni, bulanIni, 3)), nominal: 200000, kategori: 'Wakaf', keterangan: 'Wakaf Al-Quran' },
      { id: uuid(), jenis: 'pengeluaran', tanggal: formatDate(new Date(tahunIni, bulanIni, 8)), nominal: 350000, kategori: 'Operasional', keterangan: 'Listrik & air bulan ini' },
      { id: uuid(), jenis: 'pengeluaran', tanggal: formatDate(new Date(tahunIni, bulanIni, 12)), nominal: 150000, kategori: 'Operasional', keterangan: 'Beli sabun & peralatan kebersihan' },
      { id: uuid(), jenis: 'pengeluaran', tanggal: formatDate(new Date(tahunIni, bulanIni, 15)), nominal: 250000, kategori: 'Sosial', keterangan: 'Bantuan warga dhuafa' },
    ];
    localStorage.setItem(DB_KEY, JSON.stringify(sampleData));
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
function getInfo() {
  return JSON.parse(localStorage.getItem(INFO_KEY) || '{}');
}

function setInfo(info) {
  localStorage.setItem(INFO_KEY, JSON.stringify(info));
  triggerSync();
}

// ─── CRUD Transaksi ───────────────────────────────────────────────────────
function getAllTransaksi() {
  return JSON.parse(localStorage.getItem(DB_KEY) || '[]');
}

function getTransaksiByPeriode(bulan, tahun) {
  return getAllTransaksi().filter(t => {
    const d = new Date(t.tanggal);
    if (bulan === 'all') return d.getFullYear() === parseInt(tahun);
    return d.getMonth() === parseInt(bulan) && d.getFullYear() === parseInt(tahun);
  }).sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
}

function addTransaksi(data) {
  const list = getAllTransaksi();
  const transaksi = { id: uuid(), ...data };
  list.push(transaksi);
  localStorage.setItem(DB_KEY, JSON.stringify(list));
  triggerSync();
  return transaksi;
}

function editTransaksi(id, data) {
  const list = getAllTransaksi();
  const idx = list.findIndex(t => t.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...data };
    localStorage.setItem(DB_KEY, JSON.stringify(list));
    triggerSync();
    return true;
  }
  return false;
}

function deleteTransaksi(id) {
  const list = getAllTransaksi().filter(t => t.id !== id);
  localStorage.setItem(DB_KEY, JSON.stringify(list));
  triggerSync();
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

function getStatistikBulanan(tahun) {
  const all = getAllTransaksi().filter(t => new Date(t.tanggal).getFullYear() === parseInt(tahun));
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
  localStorage.setItem('masjid_sync', Date.now().toString());
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

function getPeriodeOptions() {
  const all = getAllTransaksi();
  const tahunSet = new Set(all.map(t => new Date(t.tanggal).getFullYear()));
  const currentYear = new Date().getFullYear();
  tahunSet.add(currentYear);
  return Array.from(tahunSet).sort((a, b) => b - a);
}

// Init
initData();

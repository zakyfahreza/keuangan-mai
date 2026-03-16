/**
 * ADMIN JS - Laporan Keuangan Masjid Al-Ikhlas Adi Sucipto
 */

// ─── State ────────────────────────────────────────────────────────────────
let editId = null;
let activeSection = 'dashboard';
let filterBulan = new Date().getMonth();
let filterTahun = new Date().getFullYear();

// ─── Init ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        showLogin();
    } else {
        showApp();
    }
});

function showLogin() {
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('app-section').style.display = 'none';
}

function showApp() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'flex';
    initFilter();
    renderDashboard();
    renderRiwayat();
    setPageTitle('Dashboard');
    updateUserInfo();
}

function updateUserInfo() {
    const user = getLoggedInUser();
    const avatar = document.querySelector('.user-avatar');
    const nameSpan = document.querySelector('.user-info span');

    if (nameSpan) nameSpan.textContent = user;
    if (avatar) avatar.textContent = user.split(' ').map(n => n[0]).join('').substring(0, 2);
}

// ─── Login ────────────────────────────────────────────────────────────────
function doLogin() {
    const username = document.getElementById('user-input').value;
    const pass = document.getElementById('pass-input').value;
    if (login(username, pass)) {
        showApp();
    } else {
        const err = document.getElementById('login-err');
        err.style.display = 'block';
        err.textContent = '❌ Username atau Password salah!';
        document.getElementById('pass-input').value = '';
        document.getElementById('pass-input').focus();
    }
}

function doLogout() {
    logout();
    showLogin();
    document.getElementById('pass-input').value = '';
    document.getElementById('login-err').style.display = 'none';
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.getElementById('login-section').style.display !== 'none') {
        doLogin();
    }
});

// ─── Navigasi ─────────────────────────────────────────────────────────────
function showSection(name) {
    activeSection = name;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById('sec-' + name).classList.add('active');
    document.querySelector('[data-nav="' + name + '"]').classList.add('active');
    const titles = { dashboard: 'Dashboard', transaksi: 'Tambah Transaksi', riwayat: 'Riwayat Transaksi', pengaturan: 'Pengaturan' };
    setPageTitle(titles[name] || name);
    closeSidebar();
    if (name === 'dashboard') renderDashboard();
    if (name === 'riwayat') renderRiwayat();
    if (name === 'pengaturan') loadPengaturan();
}

function setPageTitle(t) {
    document.getElementById('topbar-title').textContent = t;
}

// ─── Mobile Sidebar ────────────────────────────────────────────────────────
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-backdrop').classList.toggle('open');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('open');
}

// ─── Filter Periode ────────────────────────────────────────────────────────
function initFilter() {
    const sel = document.getElementById('filter-tahun-riwayat');
    const selD = document.getElementById('filter-tahun-dash');
    const tahunList = getPeriodeOptions();
    [sel, selD].forEach(s => {
        if (!s) return;
        s.innerHTML = '';
        tahunList.forEach(t => {
            s.innerHTML += `<option value="${t}" ${t == filterTahun ? 'selected' : ''}>${t}</option>`;
        });
    });
    const selBulan = document.getElementById('filter-bulan-riwayat');
    if (selBulan) selBulan.value = filterBulan;
    const selBulanD = document.getElementById('filter-bulan-dash');
    if (selBulanD) selBulanD.value = filterBulan;
}

function getFilterValues(prefix) {
    const b = document.getElementById('filter-bulan-' + prefix);
    const t = document.getElementById('filter-tahun-' + prefix);
    return {
        bulan: b ? b.value : filterBulan,
        tahun: t ? t.value : filterTahun
    };
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
function renderDashboard() {
    const { bulan, tahun } = getFilterValues('dash');
    const list = getTransaksiByPeriode(bulan, tahun);
    const { pemasukan, pengeluaran, saldo } = kalkulasi(list);

    document.getElementById('dash-pemasukan').textContent = formatRupiah(pemasukan);
    document.getElementById('dash-pengeluaran').textContent = formatRupiah(pengeluaran);
    document.getElementById('dash-saldo').textContent = formatRupiah(saldo);
    document.getElementById('dash-saldo').style.color = saldo >= 0 ? 'var(--emas)' : 'var(--merah)';

    // Transaksi terbaru di dashboard
    const tbl = document.getElementById('dash-recent-tbody');
    const recent = list.slice(0, 5);
    if (recent.length === 0) {
        tbl.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="es-icon">📋</div><p>Belum ada transaksi periode ini</p></div></td></tr>`;
        return;
    }
    tbl.innerHTML = recent.map(t => `
    <tr>
      <td>${formatTanggal(t.tanggal)}</td>
      <td><span class="badge badge-${t.jenis}">${t.jenis === 'pemasukan' ? '⬆ Pemasukan' : '⬇ Pengeluaran'}</span></td>
      <td>${t.kategori}</td>
      <td>${t.keterangan || '-'}<br><small style="color:var(--abu-4); display:block; margin-top:4px;">👤 ${t.user || 'Sistem'}</small></td>
    </tr>
  `).join('');

    renderChart(parseInt(tahun));
}

// ─── Chart Sederhana ────────────────────────────────────────────────────────
function renderChart(tahun) {
    const canvas = document.getElementById('chart-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const stats = getStatistikBulanan(tahun);
    const W = canvas.offsetWidth || 700;
    const H = 200;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...stats.map(s => Math.max(s.pemasukan, s.pengeluaran)), 1);
    const barW = Math.floor((W - 40) / 12 / 2 - 4);
    const padLeft = 20;

    stats.forEach((s, i) => {
        const x = padLeft + i * ((W - padLeft) / 12);
        const hP = (s.pemasukan / maxVal) * (H - 40);
        const hK = (s.pengeluaran / maxVal) * (H - 40);

        // Bar pemasukan (hijau)
        ctx.fillStyle = '#2d7a4f';
        ctx.beginPath();
        ctx.roundRect(x, H - 20 - hP, barW, hP, [3, 3, 0, 0]);
        ctx.fill();

        // Bar pengeluaran (merah)
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(x + barW + 2, H - 20 - hK, barW, hK, [3, 3, 0, 0]);
        ctx.fill();

        // Label bulan
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.bulan, x + barW, H - 4);
    });

    // Legenda
    ctx.fillStyle = '#2d7a4f';
    ctx.fillRect(W - 140, 8, 12, 12);
    ctx.fillStyle = '#475569';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Pemasukan', W - 124, 19);

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(W - 60, 8, 12, 12);
    ctx.fillStyle = '#475569';
    ctx.fillText('Pengeluaran', W - 44, 19);
}

// ─── Form Tambah Transaksi ─────────────────────────────────────────────────
function setJenis(jenis) {
    const btnMasuk = document.getElementById('btn-jenis-masuk');
    const btnKeluar = document.getElementById('btn-jenis-keluar');
    const input = document.getElementById('input-jenis');
    input.value = jenis;

    btnMasuk.className = 'jenis-btn';
    btnKeluar.className = 'jenis-btn';
    if (jenis === 'pemasukan') btnMasuk.classList.add('active-masuk');
    else btnKeluar.classList.add('active-keluar');

    // Update opsi kategori
    renderKategoriOptions(jenis);
}

const KATEGORI = {
    pemasukan: ['Infaq Jumat', 'Donasi', 'Zakat', 'Wakaf', 'Lainnya'],
    pengeluaran: ['Operasional', 'Pembangunan', 'Sosial', 'Mukafaah', 'Insentif Imam/Muadzin', 'Lainnya']
};

function renderKategoriOptions(jenis) {
    const sel = document.getElementById('input-kategori');
    sel.innerHTML = KATEGORI[jenis].map(k => `<option value="${k}">${k}</option>`).join('');
}

function resetForm() {
    editId = null;
    document.getElementById('form-transaksi').reset();
    document.getElementById('input-jenis').value = 'pemasukan';
    document.getElementById('input-tanggal').value = new Date().toISOString().split('T')[0];
    setJenis('pemasukan');
    document.getElementById('form-title').textContent = '➕ Tambah Transaksi';
    document.getElementById('btn-simpan').textContent = 'Simpan Transaksi';
    removeBukti();
}

function submitTransaksi() {
    const jenis = document.getElementById('input-jenis').value;
    const tanggal = document.getElementById('input-tanggal').value;
    const nominal = parseInt(document.getElementById('input-nominal').value.replace(/\D/g, ''));
    const kategori = document.getElementById('input-kategori').value;
    const keterangan = document.getElementById('input-keterangan').value.trim();

    if (!tanggal || !nominal || nominal <= 0) {
        showToast('Tanggal dan nominal wajib diisi!', 'error');
        return;
    }

    const bukti = document.getElementById('input-bukti-base64').value;
    const data = { jenis, tanggal, nominal, kategori, keterangan, bukti, user: getLoggedInUser() };

    if (editId) {
        editTransaksi(editId, data);
        showToast('✅ Transaksi berhasil diperbarui!', 'success');
        editId = null;
    } else {
        addTransaksi(data);
        showToast('✅ Transaksi berhasil disimpan!', 'success');
    }

    resetForm();
    showSection('riwayat');
}

// Format nominal input dengan titik ribuan & upload file handler
document.addEventListener('DOMContentLoaded', () => {
    const nominalInput = document.getElementById('input-nominal');
    if (nominalInput) {
        nominalInput.addEventListener('input', function () {
            let val = this.value.replace(/\D/g, '');
            if (val) this.value = parseInt(val).toLocaleString('id-ID');
        });
    }

    const uploadInput = document.getElementById('input-bukti');
    if (uploadInput) {
        uploadInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (file) {
                // Batasi max ukuran file (opsional, misal 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    showToast('Ukuran gambar maksimal 2MB!', 'error');
                    this.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = function (evt) {
                    document.getElementById('input-bukti-base64').value = evt.target.result;
                    document.getElementById('bukti-preview').src = evt.target.result;
                    document.getElementById('bukti-preview-container').style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }
});

function removeBukti() {
    const fileInput = document.getElementById('input-bukti');
    if (fileInput) fileInput.value = '';
    const baseInput = document.getElementById('input-bukti-base64');
    if (baseInput) baseInput.value = '';
    const container = document.getElementById('bukti-preview-container');
    if (container) container.style.display = 'none';
}

// ─── Riwayat Transaksi ─────────────────────────────────────────────────────
function renderRiwayat() {
    const { bulan, tahun } = getFilterValues('riwayat');
    const list = getTransaksiByPeriode(bulan, tahun);
    const { pemasukan, pengeluaran, saldo } = kalkulasi(list);

    document.getElementById('riwayat-pemasukan').textContent = formatRupiah(pemasukan);
    document.getElementById('riwayat-pengeluaran').textContent = formatRupiah(pengeluaran);
    document.getElementById('riwayat-saldo').textContent = formatRupiah(saldo);

    const tbody = document.getElementById('riwayat-tbody');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="es-icon">📋</div><p>Belum ada transaksi pada periode ini</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(t => `
    <tr>
      <td>${formatTanggal(t.tanggal)}</td>
      <td><span class="badge badge-${t.jenis}">${t.jenis === 'pemasukan' ? '⬆ Pemasukan' : '⬇ Pengeluaran'}</span></td>
      <td>${t.kategori}</td>
      <td class="td-nominal ${t.jenis}">${t.jenis === 'pemasukan' ? '+' : '-'} ${formatRupiah(t.nominal)}</td>
      <td>
        ${t.keterangan || '-'}
        ${t.bukti ? `<br><button class="btn btn-secondary btn-sm" onclick="lihatBukti('${t.id}')" style="margin-top:6px; padding:4px 8px; font-size:11px; background:var(--abu-1); color:var(--abu-5);">📄 Lihat Bukti</button>` : ''}
        <br><small style="color:var(--abu-4); display:block; margin-top:4px;">👤 ${t.user || 'Sistem'}</small>
      </td>
      <td>
        <button class="aksi-btn aksi-edit" onclick="editTransaksiUI('${t.id}')">✏️ Edit</button>
        <button class="aksi-btn aksi-hapus" onclick="confirmHapus('${t.id}')">🗑 Hapus</button>
      </td>
    </tr>
  `).join('');
}

function editTransaksiUI(id) {
    const all = getAllTransaksi();
    const t = all.find(x => x.id === id);
    if (!t) return;

    editId = id;
    showSection('transaksi');

    document.getElementById('input-jenis').value = t.jenis;
    document.getElementById('input-tanggal').value = t.tanggal;
    document.getElementById('input-nominal').value = t.nominal.toLocaleString('id-ID');
    setJenis(t.jenis);
    // Tunggu render kategori selesai lalu set nilai
    setTimeout(() => {
        document.getElementById('input-kategori').value = t.kategori;
        document.getElementById('input-keterangan').value = t.keterangan || '';

        if (t.bukti) {
            document.getElementById('input-bukti-base64').value = t.bukti;
            document.getElementById('bukti-preview').src = t.bukti;
            document.getElementById('bukti-preview-container').style.display = 'block';
        } else {
            removeBukti();
        }
    }, 50);

    document.getElementById('form-title').textContent = '✏️ Edit Transaksi';
    document.getElementById('btn-simpan').textContent = 'Perbarui Transaksi';
}

// ─── Modal Konfirmasi Hapus & Bukti ─────────────────────────────────────────
let hapusId = null;

function lihatBukti(id) {
    const all = getAllTransaksi();
    const t = all.find(x => x.id === id);
    if (t && t.bukti) {
        document.getElementById('modal-bukti-img').src = t.bukti;
        openModal('modal-bukti');
    }
}

function confirmHapus(id) {
    hapusId = id;
    openModal('modal-hapus');
}

function doHapus() {
    if (hapusId) {
        deleteTransaksi(hapusId);
        hapusId = null;
        closeModal('modal-hapus');
        renderRiwayat();
        showToast('🗑 Transaksi berhasil dihapus', 'success');
    }
}

// ─── Modal ────────────────────────────────────────────────────────────────
function openModal(id) {
    document.getElementById(id).classList.add('open');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

// ─── Pengaturan ────────────────────────────────────────────────────────────
function loadPengaturan() {
    const info = getInfo();
    document.getElementById('set-nama').value = info.nama || '';
    document.getElementById('set-alamat').value = info.alamat || '';
    document.getElementById('set-kontak').value = info.kontak || '';
}

function savePengaturan() {
    setInfo({
        nama: document.getElementById('set-nama').value.trim(),
        alamat: document.getElementById('set-alamat').value.trim(),
        kontak: document.getElementById('set-kontak').value.trim(),
    });
    showToast('✅ Pengaturan disimpan!', 'success');
}

function savePassword() {
    const lama = document.getElementById('pass-lama').value;
    const baru = document.getElementById('pass-baru').value;
    const konfirm = document.getElementById('pass-konfirm').value;

    const currentUser = getLoggedInUser();
    const users = getUsers();
    const userData = users.find(u => u.username === currentUser);

    if (!userData || lama !== userData.password) {
        showToast('Password lama tidak sesuai!', 'error'); return;
    }
    if (!baru || baru.length < 4) {
        showToast('Password baru minimal 4 karakter!', 'error'); return;
    }
    if (baru !== konfirm) {
        showToast('Konfirmasi password tidak cocok!', 'error'); return;
    }

    setPassword(currentUser, baru);
    document.getElementById('pass-lama').value = '';
    document.getElementById('pass-baru').value = '';
    document.getElementById('pass-konfirm').value = '';
    showToast('✅ Password berhasil diubah!', 'success');
}

// ─── Toast ────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast');
    const el = document.createElement('div');
    el.className = 'toast-item ' + type;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => {
        el.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => el.remove(), 300);
    }, 3000);
}

// ─── Init form fields ──────────────────────────────────────────────────────
window.addEventListener('load', () => {
    if (isLoggedIn()) {
        document.getElementById('input-tanggal').value = new Date().toISOString().split('T')[0];
        setJenis('pemasukan');
    }
});

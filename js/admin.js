/**
 * ADMIN JS - Laporan Keuangan Masjid Al-Ikhlas Adi Sucipto
 */

// ─── State ────────────────────────────────────────────────────────────────
let editId = null;
let activeSection = 'dashboard';
let filterBulan = new Date().getMonth();
let filterTahun = new Date().getFullYear();

// ─── Init ─────────────────────────────────────────────────────────────────
let listenerRegistered = false;

document.addEventListener('DOMContentLoaded', async () => {
    // Auto-fill saved credentials if Remember Me was previously checked
    const savedUsername = localStorage.getItem('masjid_saved_username');
    const savedPassword = localStorage.getItem('masjid_saved_password');
    if (savedUsername && savedPassword) {
        const sel = document.getElementById('user-input');
        const passInput = document.getElementById('pass-input');
        const cb = document.getElementById('remember-me');
        if (sel) sel.value = savedUsername;
        if (passInput) passInput.value = savedPassword;
        if (cb) cb.checked = true;
    }

    if (!isLoggedIn()) {
        showLogin();
    } else {
        await showApp();
    }
});

function showLogin() {
    document.getElementById('login-section').style.display = 'flex';
    document.getElementById('app-section').style.display = 'none';
}

async function showApp() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'flex';
    await initFilter();

    // Register listener once only
    if (!listenerRegistered) {
        listenerRegistered = true;
        onTransaksiChanged(async () => {
            if (typeof activeSection !== 'undefined') {
                if (activeSection === 'dashboard') await renderDashboard();
                if (activeSection === 'riwayat') await renderRiwayat();
            }
        });
    }

    await renderDashboard();
    await renderRiwayat();
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
    const remember = document.getElementById('remember-me').checked;

    if (login(username, pass)) {
        // Save or clear credentials based on checkbox
        if (remember) {
            localStorage.setItem('masjid_saved_username', username);
            localStorage.setItem('masjid_saved_password', pass);
        } else {
            localStorage.removeItem('masjid_saved_username');
            localStorage.removeItem('masjid_saved_password');
        }
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
    // Clear stored credentials on logout
    localStorage.removeItem('masjid_saved_username');
    localStorage.removeItem('masjid_saved_password');
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
async function showSection(name) {
    activeSection = name;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    document.getElementById('sec-' + name).classList.add('active');
    document.querySelector('[data-nav="' + name + '"]').classList.add('active');
    const titles = { dashboard: 'Dashboard', transaksi: 'Tambah Transaksi', riwayat: 'Riwayat Transaksi', pengaturan: 'Pengaturan' };
    setPageTitle(titles[name] || name);
    closeSidebar();
    if (name === 'dashboard') await renderDashboard();
    if (name === 'riwayat') await renderRiwayat();
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
async function initFilter() {
    const sel = document.getElementById('filter-tahun-riwayat');
    const selD = document.getElementById('filter-tahun-dash');
    const tahunList = await getPeriodeOptions();
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
function kalkulasiMetode(list) {
    let tunai = 0, rekening = 0;
    list.forEach(t => {
        if (t.metode === 'rekening') rekening += t.nominal;
        else tunai += t.nominal;
    });
    return { tunai, rekening };
}

async function renderDashboard() {
    const { bulan, tahun } = getFilterValues('dash');
    const list = await getTransaksiByPeriode(bulan, tahun);
    const { pemasukan, pengeluaran, saldo } = kalkulasi(list);
    const { tunai, rekening } = kalkulasiMetode(list);

    document.getElementById('dash-pemasukan').textContent = formatRupiah(pemasukan);
    document.getElementById('dash-pengeluaran').textContent = formatRupiah(pengeluaran);
    document.getElementById('dash-saldo').textContent = formatRupiah(saldo);
    document.getElementById('dash-saldo').style.color = saldo >= 0 ? 'var(--emas)' : 'var(--merah)';
    document.getElementById('dash-tunai').textContent = formatRupiah(tunai);
    document.getElementById('dash-rekening').textContent = formatRupiah(rekening);


    // Transaksi terbaru di dashboard
    const tbl = document.getElementById('dash-recent-tbody');
    const recent = list.slice(0, 5);
    if (recent.length === 0) {
        tbl.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="es-icon">📋</div><p>Belum ada transaksi periode ini</p></div></td></tr>`;
    } else {
        tbl.innerHTML = recent.map(t => `
        <tr>
          <td>${formatTanggal(t.tanggal)}</td>
          <td><span class="badge badge-${t.jenis}">${t.jenis === 'pemasukan' ? '⬆ Pemasukan' : '⬇ Pengeluaran'}</span></td>
          <td>${t.kategori}</td>
          <td>${formatRupiah(t.nominal)}</td>
          <td><span class="badge badge-metode-${t.metode || 'tunai'}">${t.metode === 'rekening' ? '🏦 Rekening' : '💵 Tunai'}</span></td>
          <td>${t.keterangan || '-'}<br><small style="color:var(--abu-4); display:block; margin-top:4px;">👤 ${t.user || 'Sistem'}</small></td>
        </tr>
      `).join('');
    }

    await renderChart(parseInt(tahun));
}

// ─── Chart Sederhana ────────────────────────────────────────────────────────
async function renderChart(tahun) {
    const canvas = document.getElementById('chart-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const stats = await getStatistikBulanan(tahun);
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
    document.getElementById('input-metode').value = 'tunai';
    document.getElementById('input-tanggal').value = new Date().toISOString().split('T')[0];
    setJenis('pemasukan');
    document.getElementById('form-title').textContent = '➕ Tambah Transaksi';
    document.getElementById('btn-simpan').textContent = 'Simpan Transaksi';
    removeBukti();
}

async function submitTransaksi() {
    const jenis = document.getElementById('input-jenis').value;
    const tanggal = document.getElementById('input-tanggal').value;
    const nominal = parseInt(document.getElementById('input-nominal').value.replace(/\D/g, ''));
    const kategori = document.getElementById('input-kategori').value;
    const keterangan = document.getElementById('input-keterangan').value.trim();
    const metode = document.getElementById('input-metode').value;

    if (!tanggal || !nominal || nominal <= 0) {
        showToast('Tanggal dan nominal wajib diisi!', 'error');
        return;
    }

    const bukti = document.getElementById('input-bukti-base64').value;
    const data = { jenis, tanggal, nominal, kategori, keterangan, bukti, metode, user: getLoggedInUser() };

    if (editId) {
        await editTransaksi(editId, data);
        showToast('✅ Transaksi berhasil diperbarui!', 'success');
        editId = null;
    } else {
        await addTransaksi(data);
        showToast('✅ Transaksi berhasil disimpan!', 'success');
    }

    resetForm();
    await showSection('riwayat');
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
let lastRiwayatList = [];

async function renderRiwayat() {
    const { bulan, tahun } = getFilterValues('riwayat');
    const list = await getTransaksiByPeriode(bulan, tahun);
    lastRiwayatList = list;
    const { pemasukan, pengeluaran, saldo } = kalkulasi(list);
    const { tunai, rekening } = kalkulasiMetode(list);

    document.getElementById('riwayat-pemasukan').textContent = formatRupiah(pemasukan);
    document.getElementById('riwayat-pengeluaran').textContent = formatRupiah(pengeluaran);
    document.getElementById('riwayat-saldo').textContent = formatRupiah(saldo);
    document.getElementById('riwayat-tunai').textContent = formatRupiah(tunai);
    document.getElementById('riwayat-rekening').textContent = formatRupiah(rekening);


    const tbody = document.getElementById('riwayat-tbody');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="es-icon">📋</div><p>Belum ada transaksi pada periode ini</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(t => `
    <tr>
      <td>${formatTanggal(t.tanggal)}</td>
      <td><span class="badge badge-${t.jenis}">${t.jenis === 'pemasukan' ? '⬆ Pemasukan' : '⬇ Pengeluaran'}</span></td>
      <td>${t.kategori}</td>
      <td class="td-nominal ${t.jenis}">${t.jenis === 'pemasukan' ? '+' : '-'} ${formatRupiah(t.nominal)}</td>
      <td><span class="badge badge-metode-${t.metode || 'tunai'}">${t.metode === 'rekening' ? '🏦 Rekening' : '💵 Tunai'}</span></td>
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

async function editTransaksiUI(id) {
    const all = await getAllTransaksi();
    const t = all.find(x => x.id === id);
    if (!t) return;

    editId = id;
    await showSection('transaksi');

    document.getElementById('input-jenis').value = t.jenis;
    document.getElementById('input-tanggal').value = t.tanggal;
    document.getElementById('input-nominal').value = t.nominal.toLocaleString('id-ID');
    setJenis(t.jenis);
    setTimeout(() => {
        const sel = document.getElementById('input-metode');
        if (sel) sel.value = t.metode || 'tunai';
    }, 10);
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

async function lihatBukti(id) {
    const all = await getAllTransaksi();
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

async function doHapus() {
    if (hapusId) {
        await deleteTransaksi(hapusId);
        hapusId = null;
        closeModal('modal-hapus');
        await renderRiwayat();
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
async function loadPengaturan() {
    const info = await getInfo();
    document.getElementById('set-nama').value = info.nama || '';
    document.getElementById('set-alamat').value = info.alamat || '';
    document.getElementById('set-kontak').value = info.kontak || '';
}

async function savePengaturan() {
    await setInfo({
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

// ─── Download PDF ──────────────────────────────────────────────────────────
async function downloadPDF() {
    if (!lastRiwayatList || lastRiwayatList.length === 0) {
        showToast('Tidak ada data transaksi untuk diunduh!', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Info masjid
    const info = await getInfo();
    const namaMasjid = info.nama || 'Masjid Al-Ikhlas Adi Sucipto';
    const alamat = info.alamat || '';

    // Periode
    const bulanEl = document.getElementById('filter-bulan-riwayat');
    const tahunEl = document.getElementById('filter-tahun-riwayat');
    const namaBulanArr = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const bulanVal = bulanEl ? bulanEl.value : 'all';
    const tahunVal = tahunEl ? tahunEl.value : new Date().getFullYear();
    const periodeTeks = bulanVal === 'all'
        ? `Tahun ${tahunVal}`
        : `${namaBulanArr[parseInt(bulanVal)]} ${tahunVal}`;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(namaMasjid, 148, 14, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(alamat, 148, 20, { align: 'center' });
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`LAPORAN KEUANGAN — ${periodeTeks.toUpperCase()}`, 148, 27, { align: 'center' });
    doc.setDrawColor(45, 122, 79);
    doc.setLineWidth(0.7);
    doc.line(14, 30, 283, 30);

    // Ringkasan
    const list = lastRiwayatList;
    const { pemasukan, pengeluaran, saldo } = kalkulasi(list);
    const { tunai, rekening } = kalkulasiMetode(list);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const ringkasan = [
        ['Total Pemasukan', formatRupiah(pemasukan)],
        ['Total Pengeluaran', formatRupiah(pengeluaran)],
        ['Saldo Bersih', formatRupiah(saldo)],
        ['Total Tunai', formatRupiah(tunai)],
        ['Total Transfer Rekening', formatRupiah(rekening)],
    ];
    let rx = 14, ry = 35;
    ringkasan.forEach(([label, nilai]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label + ':', rx, ry);
        doc.setFont('helvetica', 'normal');
        doc.text(nilai, rx + 52, ry);
        rx += 55;
    });

    // Tabel transaksi
    const rows = list.map((t, i) => [
        i + 1,
        formatTanggal(t.tanggal),
        t.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
        t.kategori,
        formatRupiah(t.nominal),
        t.metode === 'rekening' ? 'Rekening' : 'Tunai',
        t.keterangan || '-',
        t.user || 'Sistem',
    ]);

    doc.autoTable({
        startY: 47,
        head: [['No', 'Tanggal', 'Jenis', 'Kategori', 'Nominal', 'Metode', 'Keterangan', 'Dicatat Oleh']],
        body: rows,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [45, 122, 79], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 250, 247] },
        columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: 28 },
            2: { cellWidth: 24 },
            3: { cellWidth: 28 },
            4: { cellWidth: 32, halign: 'right' },
            5: { cellWidth: 22 },
            6: { cellWidth: 'auto' },
            7: { cellWidth: 34 },
        },
        margin: { left: 14, right: 14 },
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(150);
        doc.text(`Halaman ${p} dari ${pageCount}   •   Dicetak: ${new Date().toLocaleString('id-ID')}`, 148, doc.internal.pageSize.height - 6, { align: 'center' });
        doc.setTextColor(0);
    }

    const fileName = `Laporan_Keuangan_${periodeTeks.replace(/ /g, '_')}.pdf`;
    doc.save(fileName);
    showToast(`✅ PDF berhasil diunduh: ${fileName}`, 'success');
}

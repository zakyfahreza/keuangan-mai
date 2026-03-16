/**
 * PUBLIK JS - Laporan Keuangan Masjid Al-Ikhlas Adi Sucipto
 * Halaman jamaah: live view + ekspor PDF
 */

let pubFilterBulan = new Date().getMonth();
let pubFilterTahun = new Date().getFullYear();

// ─── Init ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await initPubFilter();
    await renderPubInfo();
    await renderPublik();
    listenSync();
});

// ─── Sync real-time antar tab ─────────────────────────────────────────────
function listenSync() {
    // Listen for realtime updates on transactions
    db.collection(DB_COLLECTION).onSnapshot(async () => {
        await renderPublik();
    });

    // Listen for realtime updates on info
    db.collection('info').doc('main').onSnapshot(async () => {
        await renderPubInfo();
    });
}

// ─── Info Masjid ──────────────────────────────────────────────────────────
async function renderPubInfo() {
    const info = await getInfo();
    document.getElementById('pub-nama').textContent = info.nama || 'Masjid Al-Ikhlas Adi Sucipto';
    document.getElementById('pub-alamat').textContent = info.alamat || '';
}

// ─── Filter ───────────────────────────────────────────────────────────────
async function initPubFilter() {
    const selTahun = document.getElementById('pub-filter-tahun');
    const tahunList = await getPeriodeOptions();
    selTahun.innerHTML = '';
    tahunList.forEach(t => {
        selTahun.innerHTML += `<option value="${t}" ${t == pubFilterTahun ? 'selected' : ''}>${t}</option>`;
    });
    document.getElementById('pub-filter-bulan').value = pubFilterBulan;
    updatePeriodeLabel();
}

async function onPubFilterChange() {
    pubFilterBulan = document.getElementById('pub-filter-bulan').value;
    pubFilterTahun = document.getElementById('pub-filter-tahun').value;
    updatePeriodeLabel();
    await renderPublik();
}

function updatePeriodeLabel() {
    const bulanNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const bLabel = pubFilterBulan === 'all' ? 'Semua Bulan' : bulanNames[parseInt(pubFilterBulan)];
    document.getElementById('pub-periode-label').textContent = `📅 Laporan ${bLabel} ${pubFilterTahun}`;
}

// ─── Render Utama ─────────────────────────────────────────────────────────
async function renderPublik() {
    const list = await getTransaksiByPeriode(pubFilterBulan, pubFilterTahun);
    const { pemasukan, pengeluaran, saldo } = kalkulasi(list);

    // Summary cards
    document.getElementById('pub-pemasukan').textContent = formatRupiah(pemasukan);
    document.getElementById('pub-pengeluaran').textContent = formatRupiah(pengeluaran);
    document.getElementById('pub-saldo').textContent = formatRupiah(saldo);
    document.getElementById('pub-saldo').style.color = saldo >= 0 ? '#f7e9c6' : '#fecaca';
    document.getElementById('pub-jumlah-transaksi').textContent = `${list.length} transaksi`;

    // Tabel transaksi
    const tbody = document.getElementById('pub-tbody');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="es-icon">📭</div><p>Belum ada data transaksi pada periode ini</p></div></td></tr>`;
    } else {
        tbody.innerHTML = list.map(t => `
      <tr>
        <td>${formatTanggal(t.tanggal)}</td>
        <td><span class="badge badge-${t.jenis}">${t.jenis === 'pemasukan' ? '⬆ Pemasukan' : '⬇ Pengeluaran'}</span></td>
        <td>${t.kategori}</td>
        <td class="td-nominal ${t.jenis}">${t.jenis === 'pemasukan' ? '+' : '-'} ${formatRupiah(t.nominal)}</td>
      </tr>
    `).join('');
    }

    // Chart
    await renderPubChart();

    // Statistik kategori
    renderKategoriBreakdown(list);
}

// ─── Bar Chart Publik ─────────────────────────────────────────────────────
async function renderPubChart() {
    const canvas = document.getElementById('pub-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.parentElement.clientWidth - 48 || 600;
    const H = 220;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const stats = await getStatistikBulanan(parseInt(pubFilterTahun));
    const maxVal = Math.max(...stats.map(s => Math.max(s.pemasukan, s.pengeluaran)), 1);
    const slotW = (W - 24) / 12;
    const barW = Math.max(Math.floor(slotW / 2 - 4), 4);

    // Grid lines
    for (let i = 1; i <= 4; i++) {
        const y = H - 26 - ((H - 46) * i / 4);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16, y);
        ctx.lineTo(W - 8, y);
        ctx.stroke();
    }

    stats.forEach((s, i) => {
        const x = 16 + i * slotW + (slotW - barW * 2 - 3) / 2;
        const hP = (s.pemasukan / maxVal) * (H - 46);
        const hK = (s.pengeluaran / maxVal) * (H - 46);

        // Bar pemasukan
        if (hP > 0) {
            const grad = ctx.createLinearGradient(0, H - 26 - hP, 0, H - 26);
            grad.addColorStop(0, '#3ca068');
            grad.addColorStop(1, '#2d7a4f');
            ctx.fillStyle = grad;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, H - 26 - hP, barW, hP, [4, 4, 0, 0]);
            else ctx.rect(x, H - 26 - hP, barW, hP);
            ctx.fill();
        }

        // Bar pengeluaran
        if (hK > 0) {
            const grad2 = ctx.createLinearGradient(0, H - 26 - hK, 0, H - 26);
            grad2.addColorStop(0, '#f87171');
            grad2.addColorStop(1, '#dc2626');
            ctx.fillStyle = grad2;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x + barW + 3, H - 26 - hK, barW, hK, [4, 4, 0, 0]);
            else ctx.rect(x + barW + 3, H - 26 - hK, barW, hK);
            ctx.fill();
        }

        // Label bulan
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.bulan, x + barW, H - 6);
    });
}

// ─── Kategori Breakdown ───────────────────────────────────────────────────
function renderKategoriBreakdown(list) {
    const pemasukanByKat = {}, pengeluaranByKat = {};
    let totalP = 0, totalK = 0;

    list.forEach(t => {
        if (t.jenis === 'pemasukan') {
            pemasukanByKat[t.kategori] = (pemasukanByKat[t.kategori] || 0) + t.nominal;
            totalP += t.nominal;
        } else {
            pengeluaranByKat[t.kategori] = (pengeluaranByKat[t.kategori] || 0) + t.nominal;
            totalK += t.nominal;
        }
    });

    function renderKatList(obj, total, jenis) {
        const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) return '<div class="empty-state" style="padding:24px"><p>Tidak ada data</p></div>';
        return entries.map(([kat, val]) => {
            const pct = total > 0 ? (val / total * 100).toFixed(0) : 0;
            return `<div class="kat-item ${jenis}">
        <span class="kat-name">${kat}</span>
        <div class="kat-bar-wrap"><div class="kat-bar" style="width:${pct}%"></div></div>
        <span class="kat-nilai">${formatRupiah(val)}</span>
      </div>`;
        }).join('');
    }

    document.getElementById('kat-pemasukan-list').innerHTML = renderKatList(pemasukanByKat, totalP, 'pemasukan');
    document.getElementById('kat-pengeluaran-list').innerHTML = renderKatList(pengeluaranByKat, totalK, 'pengeluaran');
}

// ─── Ekspor PDF ────────────────────────────────────────────────────────────
async function exportPDF() {
    const btnExport = document.getElementById('btn-pdf');
    btnExport.disabled = true;
    btnExport.innerHTML = '⏳ Menyiapkan PDF...';

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const info = await getInfo();
        const list = await getTransaksiByPeriode(pubFilterBulan, pubFilterTahun);
        const { pemasukan, pengeluaran, saldo } = kalkulasi(list);
        const bulanNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const periodeLabel = pubFilterBulan === 'all'
            ? 'Semua Bulan ' + pubFilterTahun
            : bulanNames[parseInt(pubFilterBulan)] + ' ' + pubFilterTahun;

        // ── Header Background ──
        doc.setFillColor(26, 71, 49);
        doc.rect(0, 0, 210, 38, 'F');

        // ── Nama Masjid ──
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(info.nama || 'Masjid Al-Ikhlas Adi Sucipto', 14, 16);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(info.alamat || '', 14, 22);

        // ── Judul Laporan ──
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('LAPORAN KEUANGAN — ' + periodeLabel.toUpperCase(), 14, 30);

        // ── Tanggal Cetak ──
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 220, 180);
        const tglCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.text('Dicetak: ' + tglCetak, 210 - 14, 16, { align: 'right' });

        // ── Ringkasan Box ──
        doc.setTextColor(30, 41, 59);
        let yPos = 46;

        const cards = [
            { label: 'Total Pemasukan', nilai: formatRupiah(pemasukan), color: [232, 245, 238] },
            { label: 'Total Pengeluaran', nilai: formatRupiah(pengeluaran), color: [254, 226, 226] },
            { label: 'Saldo Bersih', nilai: formatRupiah(saldo), color: saldo >= 0 ? [247, 233, 198] : [254, 226, 226] },
        ];

        const cardW = 58;
        cards.forEach((c, i) => {
            const cx = 14 + i * (cardW + 4);
            doc.setFillColor(...c.color);
            doc.roundedRect(cx, yPos, cardW, 20, 3, 3, 'F');
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(c.label, cx + 4, yPos + 7);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(i === 0 ? 45 : i === 1 ? 220 : 150, i === 0 ? 122 : i === 1 ? 38 : 120, i === 0 ? 79 : i === 1 ? 38 : 58);
            doc.text(c.nilai, cx + 4, yPos + 15);
        });

        yPos += 28;

        // ── Tabel Transaksi ──
        if (list.length > 0 && doc.autoTable) {
            doc.autoTable({
                startY: yPos,
                head: [['Tanggal', 'Jenis', 'Kategori', 'Nominal']],
                body: list.map(t => [
                    formatTanggal(t.tanggal),
                    t.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
                    t.kategori,
                    (t.jenis === 'pemasukan' ? '+ ' : '- ') + formatRupiah(t.nominal)
                ]),
                styles: { fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: [26, 71, 49], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 32 },
                    1: { cellWidth: 30 },
                    2: { cellWidth: 60 },
                    3: { cellWidth: 60, halign: 'right' }
                },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 3) {
                        const val = data.cell.raw;
                        data.cell.styles.textColor = val.startsWith('+') ? [45, 122, 79] : [220, 38, 38];
                    }
                },
                margin: { left: 14, right: 14 }
            });

            // Footer total
            const finalY = doc.lastAutoTable.finalY + 6;
            doc.setFillColor(26, 71, 49);
            doc.rect(14, finalY, 182, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('TOTAL SALDO BERSIH', 18, finalY + 6.5);
            doc.text(formatRupiah(saldo), 196, finalY + 6.5, { align: 'right' });
        } else {
            doc.setFontSize(10);
            doc.setTextColor(148, 163, 184);
            doc.text('Tidak ada data transaksi untuk periode ini.', 105, yPos + 10, { align: 'center' });
        }

        // ── Footer halaman ──
        const pgH = doc.internal.pageSize.height;
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(`${info.nama || 'Masjid Al-Ikhlas Adi Sucipto'} | Laporan Keuangan ${periodeLabel}`, 105, pgH - 8, { align: 'center' });

        // ── Simpan ──
        const filename = `Laporan-Keuangan-${periodeLabel.replace(/ /g, '-')}.pdf`;
        doc.save(filename);
    } catch (err) {
        console.error('PDF Error:', err);
        alert('Gagal membuat PDF. Pastikan koneksi internet tersedia untuk memuat library jsPDF.');
    }

    btnExport.disabled = false;
    btnExport.innerHTML = '📄 Ekspor PDF';
}

// ─── Salin Nomor Rekening ─────────────────────────────────────────────────
function copyRekening() {
    const noRek = '731392212 4'; // tanpa strip
    const btn = document.getElementById('copy-rek-btn');

    const teks = '7313922124'; // angka murni tanpa strip/spasi

    function onCopied() {
        btn.classList.add('copied');
        btn.innerHTML = '✅ Tersalin!';
        setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = '📋 Salin Nomor Rekening';
        }, 2500);
    }

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(teks).then(onCopied).catch(() => fallbackCopy(teks, onCopied));
    } else {
        fallbackCopy(teks, onCopied);
    }
}

function fallbackCopy(text, cb) {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0';
    document.body.appendChild(el);
    el.select();
    try { document.execCommand('copy'); cb(); } catch (e) { }
    document.body.removeChild(el);
}

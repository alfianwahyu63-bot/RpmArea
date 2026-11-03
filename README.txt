SALESPULSE AREA 12 TOKO • IMPORT LAPORAN CHAT WA v3.0
==================================================
Sistem tetap membaca file target area.xlsx (sheet TARGET PERTOKO dan LIST ITEM).
Fitur tambahan: input penjualan melalui tempel teks WhatsApp PLU/QTY.

CARA PAKAI:
1. Pilih bulan dan minggu (Senin–Minggu) sesuai periode laporan.
2. Pastikan target dan katalog toko sudah diupload dari file Excel.
3. Buka Input 7 Hari > Tempel Laporan RPM/PLU.
4. Pilih tanggal penjualan yang dimaksud (Wajib; periode WA hanyalah periode minggu).
5. Tempel laporan WA (header Toko: SC94, ✅ Brand, PLU/QTY, Total/QTY).
6. Klik Periksa Laporan. Sistem cek toko, minggu, PLU, jumlah Total per brand.
7. Setelah valid, klik Simpan QTY ke Tanggal Dipilih. Ada dialog konfirmasi.

Perhatian:
- Baris PLU/ kosong = 0, termasuk 408445/.
- Baris Total/ adalah validasi, bukan PLU.
- Default mode Ganti QTY: paste ulang tidak menduplikasi hitungan.
- Mode Tambahkan hanya untuk data tambahan, jangan dipakai untuk paste ulang.
- PLU di luar katalog diblokir secara default. Jika produk baru, centang opsi
  menambah PLU baru dengan HPP 0, lalu segera isi HPP untuk menghitung Sub NS.
- PLU yang tidak disebut dalam chat tidak diubah (bisa edit manual).
- Format WA tidak memuat tanggal harian, maka harus memilih tanggal pada UI.
- Tanggal/periode berbeda dari minggu yang dipilih diblokir.
- Semua mutasi via save() yang sama sehingga event Cloud Sync tetap dipicu
  bila pengguna sudah login dan cloud aktif.
- Data dari file:// tersimpan di perangkat/browser, tidak otomatis sync.
- Jika sinkronisasi cloud belum diaktifkan, tetap tersedia backup JSON.

DEPLOY PWA:
- Backup JSON dulu.
- Upload seluruh isi ZIP (bukan ZIP) ke ROOT repository baru/yang dipakai area.
- Jangan menimpa aplikasi MonitoringRPM per brand yang sudah berjalan.
- Di cloud, pastikan firebase-config.js/workspaceId sudah sesuai proyek area.
- Service Worker cache naik ke v3-wa1 untuk mengambil asset terbaru.

NAVIGASI V5: 4 ikon SVG interaktif dengan teks jelas, aktif gradien, responsive. Rumus, data, WA, Excel, ekspor PNG, Cloud JS tidak diubah.

# V15 — Pemantauan Input Harian per Toko

- Dashboard menampilkan status input toko per tanggal (7 hari dalam minggu terpilih).
- Sudah input ditentukan bila tanggal tersebut memiliki QTY >0 (termasuk data lama), atau ada catatan input WA/manual/0 QTY yang disimpan eksplisit.
- Semua QTY=0 dari data lama tidak otomatis dinyatakan sudah input karena tidak bisa dibedakan dari belum diisi.
- Menyimpan laporan WA, termasuk laporan 0 QTY, mencatat status tanggal. Mengubah QTY manual menjadi angka atau 0 dengan sengaja juga mencatat status.
- Tombol '0 QTY ✓' untuk toko tanpa penjualan; tanda tersebut tidak mengubah data penjualan.
- Tombol Input menuju toko dan tanggal pilihan.
- Tabel ringkasan menampilkan Sudah Input / Belum Input / Total Toko dengan filter dan progress.
- Metadata store.reportedDays tersimpan di dokumen store Firestore yang sudah ada sehingga dapat tersinkron antar HP dengan izin cloud yang benar.
- Edit toko, impor Excel ulang, backup/restore dan cloud load menjaga metadata.
- Perubahan visual tetap dikendalikan tab Setelan; status input harian bisa ditampilkan/disembunyikan.
- Jangan menghapus data aplikasi / cache penyimpanan, lakukan Backup JSON sebelum update.

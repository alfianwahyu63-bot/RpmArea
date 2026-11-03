# RpmArea UI V8 — Progres Simpan Cloud

Perubahan dari UI V7:

- Menambahkan progress bar nyata ke modal **Sinkronisasi Cloud** (angka 0–100% dan jumlah dokumen yang sudah dikonfirmasi Firestore).
- Proses penulisan Firestore sekarang dibagi menjadi batch maks. 80 dokumen agar unggahan besar terlihat progresnya, bukan sekadar tulisan “Menyimpan...”.
- Saat banyak perubahan tersimpan, akan muncul “80 / 241 data berhasil” dan “Sisa 161 data”, disertai persentase serta animasi proses.
- Setelah semua batch selesai, progress menampilkan 100% dan status “Semua data berhasil disimpan”.
- Bila offline, menampilkan proses terjeda dan jumlah data yang masih menunggu koneksi (dalam sesi aktif).
- Bila Firestore menolak batch, progress tidak berpura-pura 100%; aplikasi akan mencoba lagi otomatis.
- Badge header **Cloud: 33%** selama menyimpan, lalu **Cloud: Aktif** setelah sukses.
- Memperbaiki tombol “Unggah data lokal ke area” yang sebelumnya bisa terlihat walaupun sudah berstatus `hidden` karena CSS.
- Nama cache PWA dinaikkan ke v8 agar pembaruan HTML, CSS, dan cloud.js lebih mudah terbaca setelah deploy.

**Penting:** Persentase dihitung dari berapa dokumen yang benar-benar telah mendapat konfirmasi commit server. Ini bukan persen byte/koneksi. Jika hanya satu dokumen yang diperbarui, progress akan meloncat 0 → 100% setelah Firestore mengonfirmasi penyimpanan. Tidak ada data atau rumus KPI yang diubah.

## Cara pasang

1. Backup JSON RpmArea dulu.
2. Upload semua isi folder `RpmArea-main` dari ZIP ini ke akar repository GitHub, menggantikan file versi sebelumnya.
3. Tunggu deploy GitHub Pages, kemudian refresh aplikasi/PWA; tutup-buka PWA bila versi lama masih muncul.
4. Login cloud seperti biasa. Buka dialog **Sinkronisasi Cloud**, lalu lakukan perubahan data. Progress akan tampil otomatis.

**Catatan validasi:** Alur progress diuji di Chromium menggunakan mock Firebase untuk memeriksa batch, angka status, dan tampilan mobile. Operasi tulis ke proyek Firebase asli belum diuji di lingkungan ini.

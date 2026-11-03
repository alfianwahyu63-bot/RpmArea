# RpmArea V17 — Sinkronisasi Ulang Aman

V17 melanjutkan V16 (fitur V15, V14, V13, termasuk tema, Setelan, input WhatsApp, resume PNG, indikator input harian, dan pengaturan lintas HP tetap dipertahankan).

## Perubahan

- Tombol **🔄 Sinkronisasi Ulang Aman** muncul di dialog Cloud saat sinkronisasi tertahan karena data HP dan Cloud berbeda.
- Mengambil ulang koleksi dari **Firestore server** (bukan cache), menilai lagi perbedaannya.
- Jika data sudah identik, membuka kembali sinkronisasi tanpa menulis ulang semua dokumen.
- Jika perbedaan bisa digabung, menampilkan jumlah dokumen, QTY yang hanya ada di HP, QTY yang hanya ada di Cloud, dan penanda laporan harian yang hanya ada di HP.
- Setelah persetujuan eksplisit dan backup, hanya dokumen berbeda yang aman digabung yang diperbarui dalam **transaksi Firestore**. Tidak ada penghapusan data, overwrite HPP/target/brand/deskripsi, atau menimpa perbedaan QTY yang keduanya sudah positif.
- Setiap dokumen dibaca ulang di dalam transaksi dan dibandingkan dengan hasil cek sebelumnya. Jika Cloud berubah selama operasi, transaksi dibatalkan.
- Memeriksa ulang seluruh data dari Firestore setelah transaksi. **Baru** menerapkan gabungan ke data HP setelah hasil diverifikasi dan cadangan lokal IndexedDB berhasil.
- Transaksi aman dibatasi maksimal 200 dokumen berbeda per proses. Konflik rumit tetap ditahan untuk pemeriksaan manual.

## PENTING: Koreksi nol

Dalam kasus 0 vs QTY positif, tombol menyarankan mempertahankan angka positif. Ini masuk akal untuk penjualan yang belum diunggah, **tetapi nilai 0 mungkin memang koreksi yang disengaja**. Jika demikian jangan konfirmasi, kirim dua backup untuk analisis manual.

## Pengujian

- Diuji menggunakan dua backup 3 November 2026: 864 dokumen dan 87 PLU berbeda (136 QTY yang hanya ada di HP).
- Diuji simulasi tambahan 8 penanda laporan harian berbeda sehingga total menjadi 95 dokumen; rencana gabungan terdeteksi tanpa menghapus data.
- Simulasi QTY yang hanya ada di Cloud memastikan nilai tetap disimpan.
- Simulasi QTY positif yang berlainan di kedua sisi membatalkan proses.
- Sintaks JS lulus pemeriksaan Node.js. **Transaksi langsung di Firebase pengguna belum diuji**.

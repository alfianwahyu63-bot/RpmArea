# RpmArea V11 — Pengaturan Global Multi-HP

## Apa yang diperbaiki

- Tema, teks (termasuk centang Tampil/Sembunyi), visual, dan komponen dashboard kini disinkronkan terpisah dari rekap penjualan.
- Perubahan UI dikirim ke **1 dokumen** Firestore `workspaces/rpm-area-12/records/area_config`, bukan 865 dokumen PLU/toko.
- Perubahan dicatat dahulu dalam localStorage sebagai *pending UI*; refresh saat menunggu Firebase tidak menghilangkan perubahan lokal.
- Ketika Firestore mengonfirmasi penulisan, status menjadi **Tersimpan di Firebase**. Saat offline atau ditolak aturan Firestore, status jelas dan perubahan lokal dipertahankan.
- HP lain dalam workspace yang sama otomatis memuat pengaturan terbaru setelah dokumen dikonfirmasi di server.
- Konfigurasi lama dari V8–V10 tanpa revisi V11 **tidak diterapkan otomatis**, sehingga tidak mengubah pilihan yang saat ini ada di HP menjadi default.
- Perubahan UI tidak memanggil ulang fungsi upload penjualan 865 data, dan event UI di collection listener tidak memuat ulang data penjualan.
- `sw.js` memperbarui versi cache PWA.

## Cara memakai

1. Sebelum update, gunakan **Backup data & pengaturan** dan simpan file JSON.
2. Upload seluruh isi folder `RpmArea-main` (bukan ZIP-nya) ke GitHub repository yang sudah ada.
3. Buka aplikasi, lalu perbarui aplikasi pada semua HP (jika perlu, tutup-buka kembali PWA).
4. Pastikan tiap HP login ke Firebase dengan anggota workspace `rpm-area-12` yang diizinkan.
5. Dari HP utama, masuk **Pengaturan**; edit teks/tema atau matikan checkbox sesuai kebutuhan.
6. Lihat indikator **Tampilan seragam untuk semua HP**. Tekan **Jadikan tampilan HP ini untuk semua HP** untuk pertama kalinya atau untuk memaksakan pengaturan HP ini ke area.
7. Tunggu hingga tertulis **Tersimpan di Firebase**. HP lain akan memperbarui tampilan setelah tersambung.

## Perhatian

- Sinkronisasi pengaturan **belum diuji terhadap proyek Firestore produksi**. Pastikan Firestore Rules mengizinkan akun editor menulis dan membaca dokumen `workspaces/rpm-area-12/records/area_config`.
- Proses upload dan pemulihan data 865 PLU berbeda dari sinkronisasi pengaturan UI. V11 tidak menyelesaikan masalah izin/koneksi Firestore yang terpisah dari pengaturan.
- Perubahan yang belum berhasil dikonfirmasi server tetap lokal hingga tersedia koneksi dan izin.
- Jangan hapus data situs, uninstall PWA, atau menjalankan versi lama di sebagian HP ketika menguji sinkronisasi. Versi lama masih bisa menimpa konfigurasi bersama.
- Bila lebih dari satu HP mengedit setelan pada waktu hampir bersamaan, pengaturan dari perubahan terakhir yang berhasil ditulis di server yang berlaku.

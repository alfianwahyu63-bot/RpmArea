# RpmArea V18 — Tombol Sinkronisasi Ulang terlihat

- Versi ini dibuat dari V17, bukan kode lama. Tidak mengubah data toko/PLU/HPP/rumus POINT.
- Tombol Sinkronisasi Ulang Aman menjadi tombol lebar tepat di atas Backup Lokal dan Backup Cloud ketika terjadi konflik.
- Penanda V18 terlihat di judul modal agar mudah memastikan update sudah terpasang.
- Menggunakan cache-busting pada CSS dan JS, ditambah nama cache service worker baru.
- Jika HTML dari versi sebelumnya masih tertahan di cache tetapi JS V18 sudah terpasang, JS membuat tombol cadangan.
- Sinkronisasi tetap tidak otomatis menimpa: wajib konfirmasi, backup dua sisi, baca server terbaru, cek konflik, transaksi atomic, verifikasi setelah commit.

## Pemasangan
1. Backup Lokal dan Cloud pada versi sekarang.
2. Upload **isi** folder RpmArea-main ke root repository GitHub, bukan folder baru tersarang.
3. Tunggu deploy GitHub Pages selesai. Buka alamat Pages dengan `?v=18`, atau buka di tab privat (hanya untuk cek versi, jangan login/restore di tab privat jika belum backup).
4. Pastikan di atas judul Sinkronisasi Cloud terdapat tulisan V18 dan muncul tombol hijau besar.
5. Jika tombol tidak tampil, kemungkinan GitHub Pages masih menyajikan file versi lama; periksa file index.html di branch yang dipakai Pages.

**PERHATIAN:** Sebelum menekan tombol sinkronisasi ulang, cek dua backup dan hentikan input HP lain. Jika QTY 0 adalah koreksi yang disengaja, jangan setujui penggabungan otomatis.

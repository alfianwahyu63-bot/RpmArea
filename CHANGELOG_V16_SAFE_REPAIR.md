# RpmArea V16 — Pemulihan Konflik Cloud QTY 0

Fitur lama dari V15 dipertahankan seluruhnya.

## Kasus yang bisa diperbaiki lewat tombol
- Kode dokumen lokal dan cloud sama seluruhnya.
- Metadata store, brand, PLU, HPP, target, teks/tema sama.
- Satu-satunya selisih adalah QTY per hari, dengan QTY cloud = 0 dan lokal > 0.
- Tidak lebih dari 200 PLU berbeda dalam satu transaksi.
- Tindakan baru terjadi setelah konfirmasi manual dan backup.

## Cara pakai
1. Di V15 sekarang, unduh **Backup Lokal** dan **Backup Cloud** terlebih dahulu.
2. Instal V16 (backup file sebelum upload GitHub).
3. Pastikan HP yang memuat QTY paling lengkap adalah perangkat yang dipakai memulihkan.
4. Buka Cloud; cek jumlah konflik dan tombol **Pulihkan QTY 0 di Cloud**.
5. Cek file cadangan dan pilih konfirmasi.
6. Transaksi akan memeriksa ulang semua dokumen di Firebase; jika salah satu berubah, transaksi dibatalkan.
7. Pastikan status tersinkron. Jika tidak berhasil, jangan hapus cache atau data aplikasi.

**Peringatan:** Tidak bisa membedakan QTY cloud 0 yang merupakan koreksi disengaja dengan QTY 0 yang belum diisi. Periksa dan setujui nilai lokal sebelum menjalankan pemulihan. Pengujian langsung Firebase pengguna belum dilakukan.

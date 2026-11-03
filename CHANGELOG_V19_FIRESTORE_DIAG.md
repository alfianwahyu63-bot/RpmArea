# RPM AREA V19 — Diagnostik dan transport Firestore

## Perubahan
- Mempertahankan seluruh file UI dan logika V18; cloud.js diubah menggunakan `initializeFirestore(..., { experimentalForceLongPolling: true, experimentalLongPollingOptions:{timeoutSeconds:15} })` sebelum instansi dipakai.
- Tambahan tombol **Tes Baca & Tulis Firebase** pada modal Cloud. Langkah: baca dokumen member dari server, baca 1 dokumen toko dari server, tanya persetujuan untuk tes tulis metadata `updatedAt` saja.
- Tes baca dibatasi maksimum 20 detik per langkah dan tes tulis memberi peringatan bila 30 detik belum ada konfirmasi; operasi yang belum jelas **tidak** dikirim ulang otomatis. SDK dapat menyelesaikannya belakangan.
- Error `permission-denied` / `unauthenticated` ditampilkan apa adanya. Tidak ada perubahan QTY, target, HPP, atau reset data otomatis.
- Menandai progres sebagai terhenti (>45 detik) tanpa menebak persentase. Cache service worker V19.

## Prosedur aman
1. **Backup Lokal dan Backup Cloud**, simpan dua file. Jangan hapus cache/data browser.
2. Update isi repo melalui file ZIP V19 lalu buka aplikasi dengan query `?v=19` dan pastikan badge **V19**.
3. Buka Sinkronisasi Cloud > **Tes Baca & Tulis Firebase**. Setelah tes baca berhasil, konfirmasi tes tulis.
4. Jika **baca gagal**: periksa jaringan, login/role dan akses Firestore. Jika **baca sukses, tulis ditolak**: cek Security Rules (khusus path `workspaces/rpm-area-12/records`). Jika **tulis tak dikonfirmasi**: jangan mengulang upload saat penulisan sebelumnya masih tak pasti.
5. Jika tes baca-tulis sukses, sambung kembali melalui backup + **Sinkronisasi Ulang Aman**, hanya untuk konflik yang aman, dengan persetujuan manual.

## Batasan
Belum diverifikasi terhadap Firestore akun asli pengguna. Mengaktifkan long-polling adalah mitigasi kemungkinan masalah proxy/mobile, bukan jaminan penyelesaian semua masalah Firebase.

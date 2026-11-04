# RpmArea V22 — Peralihan Cloud ke Supabase

- Mengganti **Firebase Authentication + Firestore REST** di aplikasi utama dengan **Supabase Auth + PostgreSQL/PostgREST**.
- Menggunakan `supabase-config.js`, `supabase-rest.js`, dan `supabase-schema.sql`.
- Membatasi workspace dengan `rpm_members` + RLS dan RPC atomik `rpm_commit` (compare-and-swap dengan `expected_version`). Tidak ada penghapusan otomatis.
- Mempertahankan model data, tampilan, impor Excel/WhatsApp, ekspor, penyimpanan HP, audit konflik, dan polling perubahan setiap 90 detik.
- Mempertahankan halaman `recovery-firebase.html` untuk pembacaan cadangan Firebase lama **saja**, tidak dipanggil aplikasi utama.
- Memperbarui `recovery.html` agar dapat membaca cadangan lokal & Supabase tanpa menulis.
- Menggunakan namespace cache Service Worker V22 untuk meminta berkas aplikasi baru; data localStorage tidak dihapus.

## Belum termasuk

- Akun, URL, dan publishable key Supabase — harus diisi pemilik proyek.
- Transfer otomatis database lama dari Firebase (kuota 429 dapat menghalangi pembacaan lama).
- Pengujian end-to-end pada Supabase sungguhan sebelum kredensial proyek dan akun tersedia.
- Sinkronisasi push instan / Supabase Realtime. Aplikasi memeriksa delta setiap 90 detik.

Baca **MULAI_DI_SINI_V22.txt** sebelum deploy.

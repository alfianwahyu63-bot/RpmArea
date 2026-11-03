# RpmArea UI v7 — Personalization

**3 November 2026**

Pembaruan dilakukan pada proyek asli, tanpa mengganti perhitungan, fitur impor, atau kunci penyimpanan lokal.

## File yang berubah

- `index.html`: halaman Pengaturan, 5 navigasi, area dashboard yang bisa dikendalikan, dan tampilan baru.
- `app.js`: kamus teks dashboard (lebih dari 70 entri), teks dan tampilan yang bisa disimpan/reset, preset tema, kompatibilitas konfigurasi lama.
- `style.css`: desain dark-neon modern, responsif, bottom navigation mobile, komponen pengaturan.
- `sw.js`: nama cache PWA v7 untuk memperbarui resource statis.

## Penggunaan

1. **Pengaturan → Tema & Gaya:** pilih tema, efek glow, dan mode ringkas.
2. **Pengaturan → Edit Teks:** cari nama label, ubah tulisan, atau hilangkan dengan mematikan **Tampil**; gunakan tombol ↺ pada label untuk mengembalikannya.
3. **Pengaturan → Tampil / Sembunyi:** nonaktifkan komponen dashboard.
4. Gunakan **Lihat Dashboard** untuk meninjau perubahan.

**Catatan:** Nilai target dan aktual tidak dapat diedit dari pengaturan presentasi agar angka laporan tetap benar. Ubah data toko di `Master Toko & Excel`.

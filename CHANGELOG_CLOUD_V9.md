# RPM Area V9 — Sinkronisasi Lebih Responsif

- Penyimpanan **865 data** pada V8 terdiri dari 11 batch serial (maks. 80 dokumen/batch); angka 0% tampil sampai batch pertama mendapat konfirmasi server.
- V9 memakai **batch pembuka 25 dokumen** supaya progres pertama terlihat lebih cepat, lalu **maksimal 160 dokumen** per batch, mengurangi jumlah konfirmasi server pada unggahan banyak PLU.
- Saat Firebase belum merespons selama lebih dari 20 detik, tampil informasi lama menunggu (tanpa menampilkan persentase palsu). Kesalahan Firestore/Rules tetap ditampilkan bila ada.
- Event perubahan metadata Firestore tanpa perubahan dokumen tidak lagi memicu render ulang dashboard besar.
- Cache PWA dinaikkan ke v9.

**PENTING:** Jika sinkronisasi lama masih berjalan, jangan tutup PWA, logout, hapus cache, atau mengganti file sebelum membuat Backup JSON. Jika cloud terisi sebagian, gunakan backup lokal sebelum memulai sinkronisasi ulang. Semua pengaturan dan data perhitungan KPI dipertahankan.

Uji otomatis memakai mock Firestore berhasil. Perilaku pada Firebase asli dan kecepatan jaringan pengguna belum dapat diverifikasi.

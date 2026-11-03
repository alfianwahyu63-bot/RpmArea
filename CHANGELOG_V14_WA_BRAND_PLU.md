# RPM Area V14 – Urutan Brand & PLU dan Template WhatsApp

Dibangun dari **V13**, tidak dari versi lama. Seluruh fitur Setelan, tema, ekspor resume, dan pengaturan global tetap dipertahankan.

- Default Input: **Brand A–Z**, kemudian **PLU numerik kecil–besar** dalam tiap brand. Alternatif sort (deskripsi dan PLU) masih tersedia. Hanya tampilan yang diurutkan, urutan data asli dan isi QTY tidak diubah.
- Tombol **Salin Template WA** menghasilkan teks dari PLU toko yang dipilih, otomatis dikelompokkan Brand A–Z dan PLU ascending, dengan periode dan kode toko terpilih. Tidak perlu mengetik daftar PLU manual.
- Parser menerima `Format RPM per PLU`, `Periode: 2-8 Nov`, `Kode Toko: ...`, `✅*BANGO*`, PLU/QTY, format lama `Format RPM/PLU`, `Toko:`, Total/QTY.
- Jika `Kode Toko:` kosong, pratinjau menampilkan peringatan dan menggunakan toko yang dipilih; simpan tetap butuh konfirmasi eksplisit.
- Jika seluruh PLU/QTY kosong, simpan diblokir untuk mencegah overwrite QTY lama. PLU/0 tetap diterima sebagai angka nol. Jika hanya sebagian kosong, tampil peringatan bahwa PLU/ terbaca sebagai nol.
- Form laporan tidak mengubah data ketika hanya preview atau membuat template. Sinkronisasi cloud hanya berjalan jika benar-benar menyimpan QTY.
- Cache PWA dinaikkan ke v14.

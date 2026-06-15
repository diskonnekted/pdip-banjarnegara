# Rencana Restrukturisasi Database: "Single Source of Truth" (Satu Data Penduduk)

Dokumen ini memuat rencana perombakan arsitektur database agar tersentralisasi pada satu tabel utama (`penduduk`), sementara tabel lainnya hanya akan menyimpan atribut modifikasi atau ekstensi dari tabel penduduk tersebut.

## Tujuan Utama
- Menjadikan tabel `penduduk` sebagai fondasi seluruh data orang di dalam aplikasi.
- Memisahkan identitas dasar (Nama, NIK, Alamat) dengan atribut keanggotaan (KTA, Jabatan Partai).
- Memungkinkan aplikasi untuk menyimpan data seluruh warga (DPT) dan melacak siapa saja yang sudah direkrut menjadi kader atau simpatisan.

## Rencana Perubahan Struktur Database

### 1. [BARU] Tabel `penduduk`
Tabel ini akan menjadi jantung aplikasi, memuat *semua* orang.
- `nik` (VARCHAR 16, PRIMARY KEY)
- `nama` (VARCHAR 100)
- `jenis_kelamin` (VARCHAR 20)
- `kecamatan` (VARCHAR 50)
- `desa` (VARCHAR 50)
- `rt_rw` (VARCHAR 10)
- `tps` (VARCHAR 20)
- `phone` (VARCHAR 20)
- `lat`, `lng` (DOUBLE) - Untuk pemetaan lokasi rumah

### 2. [UBAH] Tabel `members` (Keanggotaan Tim Pemenangan)
Akan diubah fungsinya menjadi ekstensi dari tabel `penduduk`. Kolom identitas dasar akan dihapus karena sudah ada di `penduduk`.
- `id` (VARCHAR 50, PRIMARY KEY)
- `nik` (VARCHAR 16, FOREIGN KEY merujuk ke `penduduk.nik`)
- `kta_number` (VARCHAR 50)
- `role` (VARCHAR 30) - (Admin, Relawan, dll)
- `photo_url` (TEXT)
- `status`, `join_date`
- `parent_id` (Struktur jaringan referral)

### 3. [BARU] Tabel `simpatisan` (Target Pemilih)
Untuk mencatat warga biasa yang berhasil di-approach/didekati oleh relawan.
- `id` (VARCHAR 50, PRIMARY KEY)
- `nik` (VARCHAR 16, FOREIGN KEY merujuk ke `penduduk.nik`)
- `approach_status` (VARCHAR 30) - (Dukungan Penuh, Ragu-ragu, Menolak)
- `approach_kader_id` (Siapa relawan yang merekrut)
- `notes` (TEXT)

## Rencana Penyesuaian Aplikasi

### A. Backend (Node.js/Express)
1. **Modifikasi Endpoint Login:** Menyesuaikan query agar melakukan `JOIN` antara tabel `members` dan `penduduk` saat user login menggunakan NIK.
2. **Modifikasi Endpoint Pendaftaran Anggota:** 
   - Saat mendaftarkan anggota baru, sistem akan mengecek apakah NIK sudah ada di tabel `penduduk`.
   - Jika belum, insert ke `penduduk` lalu insert ke `members`.
   - Jika sudah ada (berarti dia sudah tercatat sebagai penduduk), cukup insert relasi ke `members` menggunakan NIK tersebut.
3. **Endpoint Master Data:** Membuat endpoint baru untuk CRUD (Create, Read, Update, Delete) master data `penduduk` secara mandiri.

### B. Frontend (React)
1. **Alur Form Pendaftaran:** Mengubah alur pendaftaran. User akan diminta memasukkan NIK terlebih dahulu, lalu sistem akan auto-fill (menarik data otomatis) dari tabel `penduduk` jika NIK tersebut ditemukan.
2. **Dashboard & Tabel Anggota:** Menyesuaikan variabel dan state hasil dari `JOIN` query di backend agar bisa merender Nama dan Alamat dengan benar.

---

**Catatan Migrasi:** Karena struktur tabel berubah total, jika saat ini sudah ada data di dalam tabel `members`, kita harus membuat skrip migrasi (migration script) untuk memindahkan NIK, Nama, dan alamat dari tabel `members` yang lama ke tabel `penduduk` yang baru agar data tidak hilang.

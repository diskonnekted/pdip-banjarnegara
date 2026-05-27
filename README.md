# 🛡️ Sistem Pemenangan Terintegrasi & Peta Kekuatan Kader (GIS)
### ✊ DPC PDI Perjuangan Kabupaten Banjarnegara

Aplikasi ini merupakan **Sistem Informasi Strategis & Pemetaan Spasial GIS** yang dirancang sebagai mesin pemenangan modern, transparan, dan akuntabel untuk DPC PDI Perjuangan Kabupaten Banjarnegara. Sistem ini dibangun dengan konsep pertahanan data berlapis guna melacak kekuatan riil partai di tingkat akar rumput, meniadakan manipulasi data, dan mengeliminasi para broker suara atau tim sukses fiktif (pemilu oportunis).

---

## 🌟 Fitur Utama & Modul Strategis

### 1. 🛡️ Sistem Keamanan & Anti-Broker Suara
Dirancang khusus untuk mematahkan klaim sepihak dari makelar politik (broker suara) yang sering menjual janji dukungan palsu dengan:
* **Verifikasi NIK Tunggal**: Mencegah duplikasi data anggota dan praktik pencatutan identitas.
* **Validasi Geografis (GPS Koordinat)**: Setiap kader dan anggota terdaftar dipetakan ke koordinat tempat tinggal yang riil. Klaim basis massa fiktif dapat langsung dibuktikan kebenarannya lewat peta GIS.
* **Audit Trail Log**: Pencatatan riwayat penambahan, modifikasi, dan penghapusan data secara mendetail demi menjaga kedaulatan data partai.

### 2. 🗺️ Pemetaan Spasial GIS & Batas Desa (GeoJSON)
* **Integrasi Peta Batas Desa Resmi**: Menampilkan poligon batas desa resmi Kabupaten Banjarnegara menggunakan file GeoJSON yang dimuat secara asinkron.
* **Interactive Hover & Klik**: Poligon desa akan berubah warna menjadi oranye/amber saat di-hover dan menampilkan popup nama Desa & Kecamatan saat di-klik.
* **Distribusi Kader Merata & Terklaster**: Penanda (pin) anggota disebar secara deterministik dan terklaster rapi di atas peta berdasarkan letak desa tugas masing-masing, mencegah penumpukan pin acak.

### 3. 👥 Database & Struktur Keanggotaan Berjenjang
* **Sistem Upline-Downline**: Menerapkan model perekrutan terstruktur sehingga garis tanggung jawab dari rekrutmen kader lapis bawah (downline) ke perekrut (upline) dapat dilacak secara instan.
* **Bagan Pohon Keanggotaan (Tree View)**: Visualisasi hierarkis perekrutan yang dilengkapi dengan **Paginasi Lokal Cabang** dan kontrol mini (`◀` / `▶`) agar bagan tidak memanjang berlebihan ke bawah.
* **Paginasi & Pencarian Tabel Anggota**: Tabel data keanggotaan memiliki paginasi dinamis (10 item per halaman) yang secara otomatis melakukan reset state ketika terjadi perubahan filter/pencarian.
* **Modal Detail Anggota Sirkular**: Klik profil memunculkan modal profil lengkap yang mencakup data upline/downline, total jaringan di bawahnya, dan tombol aksi cepat.

### 4. 🗳️ Pengawasan TPS & Quick Count (C1)
* **Laporan Hasil TPS**: Saksi terverifikasi dapat menginput data perolehan suara masing-masing paslon di TPS tugas mereka secara langsung.
* **Upload Bukti Fisik C1 Plano**: Mengunggah foto fisik bukti C1 Plano langsung dari lapangan untuk memitigasi potensi manipulasi suara di pleno kecamatan.

### 5. 🏠 Pengusulan Ranting PAC/Kecamatan
* **Usulan Kepengurusan Baru**: Koordinator Kecamatan (Korcam) dapat mengusulkan pembentukan ranting tingkat desa baru dengan dua mode: menunjuk kader terdaftar atau merekrut tokoh baru.
* **Approval DPC Real-time**: Pimpinan DPC/Super Admin dapat langsung menyetujui (memicu perayaan confetti dan merubah peran kader menjadi Ketua Ranting) atau menolak pengajuan tersebut di panel monitoring.

### 6. 🎓 Kaderisasi E-Learning & Sertifikasi
* **Modul Doktrin**: Pembelajaran mandiri materi Marhaenisme dan Strategi Rekrutmen Lapangan.
* **Kuis Kelulusan**: Kuis interaktif dengan nilai kelulusan wajib 100% untuk memperoleh sertifikat kelulusan kader secara digital.

### 7. 📦 Logistik & Jalur Komunikasi
* **Distribusi APK**: Pengajuan logistik kampanye (kaos, bendera, baliho) dengan pemantauan status pesanan (*Draft, Approved, Packed, Shipped, Delivered*).
* **Saluran Aspirasi DPRD**: Laporan aduan warga yang ditujukan langsung ke anggota legislatif fraksi PDIP DPRD Banjarnegara untuk ditanggapi.
* **Perpesanan Privat & Laporan Lapangan**: Ruang obrolan langsung internal antar-kader (dilengkapi typing simulator & auto-reply) dan pelaporan insiden lapangan tertarget.

### 8. 📱 Portal HP Khusus Mobile (Responsive Navigation)
Sistem secara otomatis mendeteksi perangkat mobile untuk memuat halaman khusus HP yang dioptimalkan untuk pergerakan kader di lapangan:
* **Bottom Navigation Bar**: Navigasi bawah modern (Beranda, Rekrut, Lapor, Pesan).
* **Perekrutan downline instan**: Form pendaftaran kader baru dengan integrasi foto identitas dan pengambilan koordinat GPS presisi secara *real-time* yang otomatis terkunci ke jaringan upline perekrut.
* **Siaran Pengumuman & Instuksi (Broadcast)**: Admin dan Pimpinan DPC dapat mengirimkan instruksi penting yang langsung tampil di halaman depan HP kader.
* **Timeline Laporan & Chat Secure**: Memungkinkan kader melaporkan insiden lapangan dengan cepat dan melakukan chat private antar-kader dengan notifikasi unread badge.

---

## 🛠️ Tech Stack & Dependencies

* **Core**: React 19 (TypeScript)
* **Bundler & Build Tool**: Vite
* **Styling**: Tailwind CSS & Vanilla CSS (untuk kustomisasi peta Leaflet)
* **GIS Map**: Leaflet & React-Leaflet
* **Icons**: Lucide React
* **Charts**: Recharts (Responsive Line, Bar, dan Pie Chart)
* **Interactions**: Canvas-Confetti (untuk selebrasi DPC Approval)

---

## 🚀 Panduan Instalasi & Menjalankan Lokal

### Prasyarat
Pastikan Anda telah menginstal [Node.js](https://nodejs.org/) (versi 18 ke atas disarankan) di sistem Anda.

### 1. Clone Repositori
```bash
git clone https://github.com/diskonnekted/pdip-banjarnegara.git
cd pdip-banjarnegara
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Jalankan Server Dev (Lokal)
```bash
npm run dev
```
Aplikasi akan berjalan di `http://localhost:5173/` secara default.

### 4. Build Bundel Produksi
Untuk melakukan build kompilasi produksi yang teroptimasi:
```bash
npm run build
```
Hasil build akan tersimpan di dalam direktori `dist/`.

---

## 📂 Struktur Direktori Proyek

```text
pdip-banjarnegara/
├── public/                 # File publik statis (favicon, aset gambar)
│   └── peta/
│       └── peta_desa.geojson  # Peta batas desa Kabupaten Banjarnegara
├── src/
│   ├── assets/             # Aset gambar & ilustrasi lokal
│   ├── App.css             # Style tambahan global & transisi animasi
│   ├── App.tsx             # Entry Point & Halaman Utama Aplikasi (Komponen Utama)
│   ├── index.css           # Konfigurasi Tema Tailwind CSS & Leaflet Overrides
│   ├── main.tsx            # Initial Render React DOM
│   ├── mockData.ts         # Data awal DPT, wilayah, logistik, kuis, & rekrutmen
│   └── types.ts            # Definisi Interface TypeScript global
├── eslint.config.js        # Konfigurasi standarisasi linter ESLint
├── tailwind.config.js      # Konfigurasi utility framework Tailwind
├── tsconfig.json           # Konfigurasi Compiler TypeScript
└── vite.config.ts          # Konfigurasi Bundler Vite
```

---

## 🛡️ Doktrin Pemenangan Partai
> *"Dalam perjuangan politik modern, kedaulatan data adalah benteng pertahanan utama kita. Dengan data keanggotaan riil yang presisi, kita menutup celah bagi oportunis dan membangun kemenangan mutlak dari akar rumput."*

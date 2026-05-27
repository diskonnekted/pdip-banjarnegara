# 🗺️ Peta Desakti

Peta Desakti adalah aplikasi web sederhana berbasis HTML dan JavaScript menggunakan library [OpenLayers](https://openlayers.org/) untuk menampilkan peta interaktif dari data GeoJSON. Proyek ini dirancang untuk menampilkan informasi desa secara visual dan interaktif.

## 🔧 Fitur Utama

- Menampilkan peta dasar dari OpenStreetMap (OSM)
- Menampilkan poligon desa dari file `peta_desa.geojson` *(peta diambil dari Geoportal Kabupaten Banjarnegara)*
- Interaksi klik pada wilayah desa untuk menampilkan detail atribut
- Stilisasi visual desa yang berbeda saat dipilih
- Nama desa ditampilkan di atas setiap area dengan format yang rapi

## 📁 Struktur File
```
 clasnet-peta-desa
├──  index.html
├──  LICENSE
├──  peta_desa.geojson
└──  README.md
```

## 🚀 Cara Menjalankan

1. Pastikan file `peta_desa.geojson` tersedia di direktori yang sama.
2. Buka file `index.html` menggunakan browser web.
3. Klik pada area desa di peta untuk melihat informasi detailnya.

## 💡 Teknologi yang Digunakan

- HTML5
- CSS3
- JavaScript
- [OpenLayers](https://openlayers.org/) - Library peta open source untuk tampilan dan interaksi peta

## 📝 Catatan Pengembangan

- Pastikan file `peta_desa.geojson` tersedia dan dapat diakses oleh server web.
- Nama properti GeoJSON seperti `Nama_Desa_` harus sesuai dengan struktur data yang digunakan.
- Kamu bisa mengganti titik fokus awal (`center`) dan tingkat zoom sesuai kebutuhan.

## 📌 Lisensi

Proyek ini dilisensikan di bawah MIT License. Lihat file [LICENSE](LICENSE) untuk detailnya. Proyek ini bersifat open-source dan bebas dimodifikasi. Namun pastikan tetap mencantumkan sumber asli jika digunakan kembali.
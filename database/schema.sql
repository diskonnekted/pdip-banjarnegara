-- Schema database untuk Sistem Informasi Pemenangan PDI Perjuangan Banjarnegara

-- 1. Tabel Members (Keanggotaan)
CREATE TABLE IF NOT EXISTS members (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    kta_number VARCHAR(50) NOT NULL,
    nik VARCHAR(16) NOT NULL UNIQUE,
    role VARCHAR(30) NOT NULL,
    kecamatan VARCHAR(50) NOT NULL,
    desa VARCHAR(50) NOT NULL,
    tps VARCHAR(20) NOT NULL,
    photo_url TEXT NOT NULL,
    lat DOUBLE NOT NULL,
    lng DOUBLE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    join_date VARCHAR(20) NOT NULL,
    parent_id VARCHAR(50),
    dapil VARCHAR(50),
    party_affiliation VARCHAR(50),
    approach_status VARCHAR(30),
    approach_kader_id VARCHAR(50),
    approach_notes TEXT,
    FOREIGN KEY (parent_id) REFERENCES members(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel Logistics Items (Daftar Jenis Logistik)
CREATE TABLE IF NOT EXISTS logistics_items (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    stock INT NOT NULL DEFAULT 0,
    location VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Logistics Orders (Pesanan Logistik oleh Anggota)
CREATE TABLE IF NOT EXISTS logistics_orders (
    id VARCHAR(50) PRIMARY KEY,
    requester_name VARCHAR(100) NOT NULL,
    requester_role VARCHAR(50) NOT NULL,
    kecamatan VARCHAR(50) NOT NULL,
    desa VARCHAR(50) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Aspirations (Aspirasi Warga & Tanggapan Dewan)
CREATE TABLE IF NOT EXISTS aspirations (
    id VARCHAR(50) PRIMARY KEY,
    reporter_name VARCHAR(100) NOT NULL,
    kecamatan VARCHAR(50) NOT NULL,
    desa VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    date VARCHAR(30) NOT NULL,
    dewan_response TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabel Quick Count Results (Hasil Perolehan Suara di TPS)
CREATE TABLE IF NOT EXISTS quick_count_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kecamatan VARCHAR(50) NOT NULL,
    tps VARCHAR(50) NOT NULL,
    candidate1_votes INT NOT NULL DEFAULT 0,
    candidate2_votes INT NOT NULL DEFAULT 0,
    candidate3_votes INT NOT NULL DEFAULT 0,
    sah INT NOT NULL DEFAULT 0,
    tidak_sah INT NOT NULL DEFAULT 0,
    c1_photo_url TEXT NOT NULL,
    submitted_by VARCHAR(100) NOT NULL,
    timestamp VARCHAR(30) NOT NULL,
    UNIQUE KEY uq_kecamatan_tps (kecamatan, tps)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabel Member Reports (Laporan Kejadian / Insiden Lapangan)
CREATE TABLE IF NOT EXISTS member_reports (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    timestamp VARCHAR(30) NOT NULL,
    category VARCHAR(30) NOT NULL,
    details TEXT NOT NULL,
    photo_url TEXT,
    submitted_by VARCHAR(100) NOT NULL,
    submitter_id VARCHAR(50) NOT NULL,
    kecamatan VARCHAR(50) NOT NULL,
    target_member_id VARCHAR(50),
    target_member_name VARCHAR(100),
    FOREIGN KEY (submitter_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabel Private Messages (Pesan Privat Internal)
CREATE TABLE IF NOT EXISTS private_messages (
    id VARCHAR(50) PRIMARY KEY,
    sender_id VARCHAR(50) NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    receiver_id VARCHAR(50) NOT NULL,
    receiver_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    timestamp VARCHAR(30) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (sender_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Tabel Ranting Proposals (Usulan Ranting PAC)
CREATE TABLE IF NOT EXISTS ranting_proposals (
    id VARCHAR(50) PRIMARY KEY,
    kecamatan VARCHAR(50) NOT NULL,
    desa VARCHAR(50) NOT NULL,
    proposed_ketua_name VARCHAR(100) NOT NULL,
    proposed_ketua_nik VARCHAR(16) NOT NULL,
    proposed_ketua_phone VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Tabel Audit Logs (Log Aktivitas Sistem)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp VARCHAR(30) NOT NULL,
    user VARCHAR(100) NOT NULL,
    action TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Tabel Operational Funds (Dana Operasional)
CREATE TABLE IF NOT EXISTS operational_funds (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) NOT NULL, -- 'income' (pemasukan) atau 'expense' (pengeluaran)
    amount DECIMAL(15, 2) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'Kegiatan', 'Sosialisasi', 'Pembuatan Media', 'Lainnya'
    title VARCHAR(200) NOT NULL,
    description TEXT,
    date VARCHAR(30) NOT NULL,
    submitter_id VARCHAR(50) NOT NULL,
    submitter_name VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Tabel Logistics Stock History (Riwayat Mutasi Stok)
CREATE TABLE IF NOT EXISTS logistics_stock_history (
    id VARCHAR(50) PRIMARY KEY,
    item_id VARCHAR(50) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'stock_in' atau 'stock_out'
    quantity INT NOT NULL,
    notes TEXT,
    date VARCHAR(30) NOT NULL,
    submitter_name VARCHAR(100) NOT NULL,
    FOREIGN KEY (item_id) REFERENCES logistics_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Tabel Activities (Kegiatan & RAB)
CREATE TABLE IF NOT EXISTS activities (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    executors TEXT NOT NULL, -- Menyimpan JSON array pelaksana [{id, name, role}]
    date VARCHAR(30) NOT NULL,
    location VARCHAR(200) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'rencana',
    budget_transport DECIMAL(15, 2) NOT NULL DEFAULT 0,
    budget_meals DECIMAL(15, 2) NOT NULL DEFAULT 0,
    budget_accommodation DECIMAL(15, 2) NOT NULL DEFAULT 0,
    budget_other DECIMAL(15, 2) NOT NULL DEFAULT 0,
    budget_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
    report_description TEXT,
    report_photo LONGTEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Tabel TPS Mapping (Zona Merah, Kuning, Hijau)
CREATE TABLE IF NOT EXISTS tps_mapping (
    id VARCHAR(50) PRIMARY KEY,
    nama_tps VARCHAR(100) NOT NULL,
    kecamatan VARCHAR(50) NOT NULL,
    desa VARCHAR(50) NOT NULL,
    lat DOUBLE NOT NULL,
    lng DOUBLE NOT NULL,
    zona VARCHAR(10) NOT NULL, -- 'merah', 'kuning', 'hijau'
    dpt_count INT NOT NULL DEFAULT 0,
    last_updated_by VARCHAR(100) NOT NULL,
    last_updated_date VARCHAR(30) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;



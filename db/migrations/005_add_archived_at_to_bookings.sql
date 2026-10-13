-- Migrasi 005: Tambah kolom archived_at pada tabel bookings untuk mengarsipkan pengajuan yang ditolak / selesai
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

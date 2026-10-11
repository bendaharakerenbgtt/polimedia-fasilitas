-- 003_facility_items_and_revision.sql
-- Menambahkan status REVISION ke booking_status enum dan membuat tabel facility_items

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE typname = 'booking_status' AND enumlabel = 'REVISION'
  ) THEN
    ALTER TYPE booking_status ADD VALUE 'REVISION';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS facility_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  condition text NOT NULL DEFAULT 'Baik',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_facility_items_facility ON facility_items (facility_id);

-- =====================================================================
-- 002_sba_attachments.sql — Skema SBA, Lampiran Terkontrol, dll.
-- =====================================================================

CREATE TYPE sba_status AS ENUM (
  'DRAFT',      -- sedang disusun oleh organisasi
  'SUBMITTED',  -- diajukan untuk ditinjau / tanda tangan
  'COMPLETED'   -- selesai
);

CREATE TABLE sba_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  doc_number      text NOT NULL DEFAULT '',
  status          sba_status NOT NULL DEFAULT 'DRAFT',

  description     text NOT NULL DEFAULT '',
  outcomes        text NOT NULL DEFAULT '',
  obstacles       text NOT NULL DEFAULT '',
  evaluation      text NOT NULL DEFAULT '',

  total_income    bigint NOT NULL DEFAULT 0,
  total_expense   bigint NOT NULL DEFAULT 0,
  balance         bigint NOT NULL DEFAULT 0,

  created_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sba_org ON sba_reports (organization_id, status);

CREATE TABLE sba_rundown_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sba_id      uuid NOT NULL REFERENCES sba_reports(id) ON DELETE CASCADE,
  item_order  integer NOT NULL DEFAULT 1,
  agenda      text NOT NULL,
  actual_time text NOT NULL,
  pic         text NOT NULL,
  notes       text NOT NULL DEFAULT ''
);

CREATE TYPE finance_type AS ENUM ('INCOME', 'EXPENSE');

CREATE TABLE sba_finance_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sba_id      uuid NOT NULL REFERENCES sba_reports(id) ON DELETE CASCADE,
  type        finance_type NOT NULL,
  category    text NOT NULL DEFAULT '',
  description text NOT NULL,
  quantity    integer NOT NULL CHECK (quantity > 0),
  unit_price  bigint NOT NULL CHECK (unit_price >= 0),
  total_price bigint NOT NULL CHECK (total_price >= 0)
);

CREATE TABLE attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid REFERENCES bookings(id) ON DELETE CASCADE,
  sba_id          uuid REFERENCES sba_reports(id) ON DELETE CASCADE,
  change_req_id   uuid REFERENCES change_requests(id) ON DELETE CASCADE,
  file_name       text NOT NULL,
  storage_path    text NOT NULL,
  mime_type       text NOT NULL,
  file_size       bigint NOT NULL,
  category        text NOT NULL DEFAULT 'OTHER', -- SPZ, NOTA, DOKUMENTASI, SURAT, DLL
  uploaded_by     uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attachment_has_parent CHECK (
    booking_id IS NOT NULL OR sba_id IS NOT NULL OR change_req_id IS NOT NULL
  )
);
CREATE INDEX attachments_booking ON attachments (booking_id);
CREATE INDEX attachments_sba ON attachments (sba_id);

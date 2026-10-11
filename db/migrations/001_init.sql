-- =====================================================================
-- 001_init.sql — Skema awal Sistem Peminjaman Fasilitas PoliMedia
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- Pengaturan yang belum dikonfirmasi kampus disimpan sebagai data,
-- bukan dikodekan permanen (lihat brief bagian 16).
-- ---------------------------------------------------------------------
CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  description text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Program studi, organisasi, pengguna
-- ---------------------------------------------------------------------
CREATE TABLE prodi (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code   text NOT NULL UNIQUE,
  name   text NOT NULL,
  active boolean NOT NULL DEFAULT true
);

CREATE TYPE org_type AS ENUM ('UKM', 'HIMA', 'BEM', 'MPM');

CREATE TABLE organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  type       org_type NOT NULL,
  prodi_id   uuid REFERENCES prodi(id),
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hima_has_prodi CHECK (type <> 'HIMA' OR prodi_id IS NOT NULL)
);
-- Hanya satu BEM dan satu MPM aktif.
CREATE UNIQUE INDEX one_active_bem ON organizations (type) WHERE type = 'BEM' AND active;
CREATE UNIQUE INDEX one_active_mpm ON organizations (type) WHERE type = 'MPM' AND active;

CREATE TYPE user_role AS ENUM ('ORG', 'ADVISOR', 'KAPRODI', 'WADIR', 'SUBBAG_UMUM', 'ADMIN');

CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username             text NOT NULL UNIQUE,
  password_hash        text NOT NULL,
  display_name         text NOT NULL,
  role                 user_role NOT NULL,
  organization_id      uuid REFERENCES organizations(id),
  prodi_id             uuid REFERENCES prodi(id),
  active               boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_account_has_org CHECK ((role = 'ORG') = (organization_id IS NOT NULL)),
  CONSTRAINT kaprodi_has_prodi   CHECK (role <> 'KAPRODI' OR prodi_id IS NOT NULL)
);
-- Satu akun bersama per organisasi.
CREATE UNIQUE INDEX one_account_per_org ON users (organization_id) WHERE role = 'ORG';

CREATE TABLE sessions (
  id          text PRIMARY KEY,               -- sha256(token), token tidak disimpan
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  ip          text,
  user_agent  text
);
CREATE INDEX sessions_user ON sessions (user_id);

-- Dosen pembimbing/pembina ↔ organisasi binaan
CREATE TABLE org_advisors (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (organization_id, user_id)
);

-- ---------------------------------------------------------------------
-- Fasilitas
-- ---------------------------------------------------------------------
CREATE TABLE facilities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  category    text NOT NULL,
  location    text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  amenities   text NOT NULL DEFAULT '',
  capacity    integer CHECK (capacity IS NULL OR capacity > 0),
  rules       text NOT NULL DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Konfigurasi jalur persetujuan (dapat diubah tanpa build ulang)
-- ---------------------------------------------------------------------
CREATE TYPE resolver_type AS ENUM (
  'ORG_ADVISOR',     -- dosen pembimbing/pembina organisasi pemohon
  'PRODI_KAPRODI',   -- Kaprodi dari prodi HIMA pemohon
  'ORGANIZATION',    -- akun organisasi tertentu (mis. BEM, MPM)
  'ROLE'             -- semua pengguna dengan peran tertentu (mis. WADIR, SUBBAG_UMUM)
);

CREATE TABLE approval_flows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind            text NOT NULL CHECK (kind IN ('BOOKING', 'SBA')),
  org_type        org_type,
  organization_id uuid REFERENCES organizations(id),  -- override khusus satu organisasi
  name            text NOT NULL,
  notes           text NOT NULL DEFAULT '',
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT flow_target CHECK ((org_type IS NOT NULL) <> (organization_id IS NOT NULL))
);
CREATE UNIQUE INDEX flow_per_type ON approval_flows (kind, org_type) WHERE org_type IS NOT NULL;
CREATE UNIQUE INDEX flow_per_org  ON approval_flows (kind, organization_id) WHERE organization_id IS NOT NULL;

CREATE TABLE approval_flow_steps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id         uuid NOT NULL REFERENCES approval_flows(id) ON DELETE CASCADE,
  step_order      integer NOT NULL CHECK (step_order > 0),
  label           text NOT NULL,
  resolver_type   resolver_type NOT NULL,
  resolver_org_id uuid REFERENCES organizations(id),
  resolver_role   user_role,
  is_final        boolean NOT NULL DEFAULT false,
  UNIQUE (flow_id, step_order),
  CONSTRAINT resolver_args CHECK (
    (resolver_type = 'ORGANIZATION' AND resolver_org_id IS NOT NULL) OR
    (resolver_type = 'ROLE' AND resolver_role IS NOT NULL) OR
    (resolver_type IN ('ORG_ADVISOR', 'PRODI_KAPRODI'))
  )
);

-- ---------------------------------------------------------------------
-- Peminjaman
-- ---------------------------------------------------------------------
CREATE TYPE booking_status AS ENUM (
  'DRAFT',      -- mengisi formulir (hold maks. 1 jam)
  'PENDING',    -- menunggu persetujuan, slot terkunci
  'APPROVED',   -- disetujui Wakil Direktur
  'REJECTED',   -- ditolak, slot dilepas
  'CANCELLED',  -- dibatalkan/ditarik, slot dilepas
  'COMPLETED'   -- kegiatan telah berlangsung
);

CREATE SEQUENCE booking_code_seq;

CREATE TABLE bookings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,
  organization_id  uuid NOT NULL REFERENCES organizations(id),
  facility_id      uuid NOT NULL REFERENCES facilities(id),
  status           booking_status NOT NULL DEFAULT 'DRAFT',

  title            text NOT NULL DEFAULT '',
  purpose          text NOT NULL DEFAULT '',
  description      text NOT NULL DEFAULT '',

  usage_start      timestamptz NOT NULL,
  event_start      timestamptz NOT NULL,
  event_end        timestamptz NOT NULL,
  usage_end        timestamptz NOT NULL,

  chair_name       text NOT NULL DEFAULT '',
  chair_contact    text NOT NULL DEFAULT '',
  lead_name        text NOT NULL DEFAULT '',
  lead_contact     text NOT NULL DEFAULT '',
  other_parties    jsonb NOT NULL DEFAULT '[]',   -- [{name, role, contact}]
  committee        jsonb NOT NULL DEFAULT '[]',   -- [{name, position}]
  rundown          jsonb NOT NULL DEFAULT '[]',   -- [{time, agenda, pic}]
  special_notes    text NOT NULL DEFAULT '',

  submitted_at     timestamptz,
  decided_at       timestamptz,
  decided_by       uuid REFERENCES users(id),
  decision_note    text,
  cancelled_at     timestamptz,
  cancel_reason    text,
  completed_at     timestamptz,
  created_by       uuid NOT NULL REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT time_order CHECK (
    usage_start <= event_start AND event_start < event_end AND event_end <= usage_end
  )
);
CREATE INDEX bookings_org    ON bookings (organization_id, status);
CREATE INDEX bookings_fac    ON bookings (facility_id, usage_start);
CREATE INDEX bookings_status ON bookings (status);

CREATE TABLE booking_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  name       text NOT NULL,
  quantity   integer NOT NULL CHECK (quantity > 0),
  notes      text NOT NULL DEFAULT ''
);

-- ---------------------------------------------------------------------
-- Penguncian slot. Constraint EXCLUDE menjamin tidak ada dua kunci aktif
-- yang tumpang tindih pada fasilitas yang sama (kecuali milik booking yang
-- sama, misalnya kunci lama + kunci jadwal baru saat perubahan jadwal).
-- ---------------------------------------------------------------------
CREATE TYPE lock_kind AS ENUM ('HOLD', 'BOOKING', 'RESCHEDULE');

CREATE TABLE slot_locks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id       uuid NOT NULL REFERENCES facilities(id),
  booking_id        uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  change_request_id uuid,
  kind              lock_kind NOT NULL,
  period            tstzrange NOT NULL,
  active            boolean NOT NULL DEFAULT true,
  expires_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  released_at       timestamptz,
  release_reason    text,
  CONSTRAINT hold_expires CHECK ((kind = 'HOLD') = (expires_at IS NOT NULL)),
  CONSTRAINT period_valid CHECK (NOT isempty(period)),
  CONSTRAINT no_overlap EXCLUDE USING gist (
    facility_id WITH =,
    period      WITH &&,
    booking_id  WITH <>
  ) WHERE (active)
);
CREATE INDEX slot_locks_booking ON slot_locks (booking_id) WHERE active;

-- Tahapan persetujuan (snapshot dari konfigurasi saat pengajuan dikirim)
CREATE TYPE step_status AS ENUM ('WAITING', 'PENDING', 'FORWARDED', 'APPROVED', 'REJECTED', 'SKIPPED');

CREATE TABLE approval_steps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  step_order      integer NOT NULL,
  label           text NOT NULL,
  resolver_type   resolver_type NOT NULL,
  resolver_org_id uuid REFERENCES organizations(id),
  resolver_role   user_role,
  is_final        boolean NOT NULL DEFAULT false,
  status          step_status NOT NULL DEFAULT 'WAITING',
  acted_by        uuid REFERENCES users(id),
  acted_at        timestamptz,
  note            text,
  UNIQUE (booking_id, step_order)
);

-- ---------------------------------------------------------------------
-- Pembatalan & perubahan jadwal
-- ---------------------------------------------------------------------
CREATE TABLE change_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL REFERENCES bookings(id),
  type            text NOT NULL CHECK (type IN ('CANCEL', 'RESCHEDULE')),
  reason          text NOT NULL CHECK (length(trim(reason)) > 0),
  old_usage_start timestamptz NOT NULL,
  old_event_start timestamptz NOT NULL,
  old_event_end   timestamptz NOT NULL,
  old_usage_end   timestamptz NOT NULL,
  new_usage_start timestamptz,
  new_event_start timestamptz,
  new_event_end   timestamptz,
  new_usage_end   timestamptz,
  status          text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  requested_by    uuid NOT NULL REFERENCES users(id),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  decided_by      uuid REFERENCES users(id),
  decided_at      timestamptz,
  decision_note   text,
  CONSTRAINT reschedule_has_times CHECK (
    type = 'CANCEL' OR (
      new_usage_start IS NOT NULL AND new_event_start IS NOT NULL AND
      new_event_end IS NOT NULL AND new_usage_end IS NOT NULL AND
      new_usage_start <= new_event_start AND new_event_start < new_event_end AND
      new_event_end <= new_usage_end
    )
  )
);
-- Maksimal satu permohonan aktif per peminjaman.
CREATE UNIQUE INDEX one_pending_change ON change_requests (booking_id) WHERE status = 'PENDING';
ALTER TABLE slot_locks ADD CONSTRAINT slot_locks_cr_fk
  FOREIGN KEY (change_request_id) REFERENCES change_requests(id);

-- ---------------------------------------------------------------------
-- Notifikasi & audit
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text NOT NULL DEFAULT '',
  link       text,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user ON notifications (user_id, read_at, created_at DESC);

CREATE TABLE audit_logs (
  id              bigserial PRIMARY KEY,
  actor_user_id   uuid REFERENCES users(id),
  actor_org_id    uuid REFERENCES organizations(id),
  action          text NOT NULL,
  entity_type     text NOT NULL,
  entity_id       text,
  data            jsonb NOT NULL DEFAULT '{}',
  ip              text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity ON audit_logs (entity_type, entity_id, created_at);
-- Log audit bersifat append-only.
CREATE FUNCTION audit_logs_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_logs bersifat append-only'; END $$;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();

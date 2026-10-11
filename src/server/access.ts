import type { PoolClient } from "pg";
import { OVERSIGHT_ROLES } from "@/lib/roles";
import { queryOne, type Db } from "./db";
import { forbidden, notFound, type Actor } from "./core";

/**
 * Predikat SQL untuk pengajuan yang boleh dilihat aktor (dipakai di daftar,
 * arsip, dan detail). `b` = alias tabel bookings, `o` = organizations.
 * Mengembalikan [sql, params] dengan placeholder mulai dari `start`.
 */
export function bookingVisibility(actor: Actor, start = 1): [string, unknown[]] {
  const p = (n: number) => `$${start + n}`;
  if (OVERSIGHT_ROLES.includes(actor.role)) {
    return [`(b.status <> 'DRAFT')`, []];
  }
  // Pihak yang tercantum sebagai penanda tangan pada tahapan pengajuan.
  const stepMatch = (cond: string) =>
    `EXISTS (SELECT 1 FROM approval_steps st WHERE st.booking_id = b.id AND ${cond})`;
  switch (actor.role) {
    case "ORG":
      return [
        `(b.organization_id = ${p(0)} OR b.created_by = ${p(1)} OR (b.status <> 'DRAFT' AND ${stepMatch(
          `st.resolver_type = 'ORGANIZATION' AND st.resolver_org_id = ${p(0)}`,
        )}))`,
        [actor.organizationId, actor.id],
      ];
    case "ADVISOR":
      return [
        `(b.status <> 'DRAFT' AND EXISTS (SELECT 1 FROM org_advisors oa
            WHERE oa.organization_id = b.organization_id AND oa.user_id = ${p(0)}))`,
        [actor.id],
      ];
    case "KAPRODI":
      return [`(b.status <> 'DRAFT' AND o.prodi_id = ${p(0)})`, [actor.prodiId]];
    default:
      return [`false`, []];
  }
}

export async function assertCanViewBooking(db: Db | undefined, actor: Actor, bookingId: string) {
  const [pred, params] = bookingVisibility(actor, 2);
  const client = (db && typeof (db as any).query === "function") ? db : undefined;
  const row = await queryOne(
    `SELECT 1 FROM bookings b JOIN organizations o ON o.id = b.organization_id
      WHERE b.id = $1 AND ${pred}`,
    [bookingId, ...params],
    client,
  );
  if (!row) throw notFound("Pengajuan tidak ditemukan atau Anda tidak memiliki akses.");
}

/** Pengajuan milik organisasi aktor, dikunci FOR UPDATE di dalam transaksi. */
export async function lockOwnBooking(client: PoolClient, actor: Actor, bookingId: string) {
  if (actor.role !== "ORG" || !actor.organizationId) throw forbidden();
  const b = await queryOne<BookingRow>(`SELECT * FROM bookings WHERE id = $1 FOR UPDATE`, [bookingId], client);
  if (!b || b.organization_id !== actor.organizationId) throw notFound("Pengajuan tidak ditemukan.");
  return b;
}

export type BookingRow = {
  id: string;
  code: string;
  organization_id: string;
  facility_id: string;
  status: "DRAFT" | "PENDING" | "REVISION" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED";
  title: string;
  purpose: string;
  description: string;
  usage_start: Date;
  event_start: Date;
  event_end: Date;
  usage_end: Date;
  chair_name: string;
  chair_contact: string;
  lead_name: string;
  lead_contact: string;
  other_parties: { name: string; role: string; contact: string }[];
  committee: { name: string; position: string }[];
  rundown: { time: string; agenda: string; pic: string }[];
  special_notes: string;
  submitted_at: Date | null;
  decided_at: Date | null;
  decided_by: string | null;
  decision_note: string | null;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

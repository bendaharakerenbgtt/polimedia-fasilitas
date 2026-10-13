import type { PoolClient } from "pg";
import type { Role } from "@/lib/roles";
import { query, queryOne, tx, type Db } from "./db";
import { AppError, audit, forbidden, getSetting, notFound, notify, type Actor } from "./core";
import type { BookingRow } from "./access";
import { releaseLocks } from "./slots";

export type StepRow = {
  id: string;
  booking_id: string;
  step_order: number;
  label: string;
  resolver_type: "ORG_ADVISOR" | "PRODI_KAPRODI" | "ORGANIZATION" | "ROLE";
  resolver_org_id: string | null;
  resolver_role: Role | null;
  is_final: boolean;
  status: "WAITING" | "PENDING" | "FORWARDED" | "APPROVED" | "REJECTED" | "SKIPPED";
  acted_by: string | null;
  acted_at: Date | null;
  note: string | null;
};

type StepTarget = Pick<StepRow, "resolver_type" | "resolver_org_id" | "resolver_role">;

/** Mengambil konfigurasi jalur: override per-organisasi, jika tidak ada pakai jalur per-tipe. */
export async function resolveFlowSteps(db: Db, kind: "BOOKING" | "SBA", organizationId: string) {
  const flow = await queryOne<{ id: string }>(
    `SELECT f.id FROM approval_flows f JOIN organizations o ON o.id = $2
      WHERE f.kind = $1 AND (f.organization_id = o.id OR f.org_type = o.type)
      ORDER BY (f.organization_id IS NOT NULL) DESC LIMIT 1`,
    [kind, organizationId],
    db,
  );
  if (!flow) return null;
  return query<StepTarget & { step_order: number; label: string; is_final: boolean }>(
    `SELECT step_order, label, resolver_type, resolver_org_id, resolver_role, is_final
       FROM approval_flow_steps WHERE flow_id = $1 ORDER BY step_order`,
    [flow.id],
    db,
  );
}

/** Pengguna yang berwenang menindaklanjuti suatu tahapan untuk organisasi pemohon. */
export async function stepResolverUserIds(db: Db, step: StepTarget, organizationId: string): Promise<string[]> {
  let rows: { id: string }[] = [];
  switch (step.resolver_type) {
    case "ORG_ADVISOR":
      rows = await query(
        `SELECT u.id FROM org_advisors oa JOIN users u ON u.id = oa.user_id
          WHERE oa.organization_id = $1 AND u.active AND u.role = 'ADVISOR'`,
        [organizationId],
        db,
      );
      break;
    case "PRODI_KAPRODI":
      rows = await query(
        `SELECT u.id FROM organizations o JOIN users u ON u.prodi_id = o.prodi_id
          WHERE o.id = $1 AND u.role = 'KAPRODI' AND u.active`,
        [organizationId],
        db,
      );
      break;
    case "ORGANIZATION":
      rows = await query(
        `SELECT u.id FROM users u JOIN organizations o ON o.id = u.organization_id
          WHERE u.organization_id = $1 AND u.role = 'ORG' AND u.active AND o.active`,
        [step.resolver_org_id],
        db,
      );
      break;
    case "ROLE":
      rows = await query(`SELECT id FROM users WHERE role = $1 AND active`, [step.resolver_role], db);
      break;
  }
  return rows.map((r) => r.id);
}

export async function canActOnStep(db: Db, actor: Actor, step: StepTarget, organizationId: string) {
  return (await stepResolverUserIds(db, step, organizationId)).includes(actor.id);
}

/** Menyalin jalur ke tahapan pengajuan (snapshot) dan mengaktifkan tahap pertama. */
export async function instantiateSteps(client: PoolClient, booking: BookingRow) {
  const steps = await resolveFlowSteps(client, "BOOKING", booking.organization_id);
  if (!steps || steps.length === 0)
    throw new AppError("Jalur persetujuan untuk organisasi ini belum dikonfigurasi. Hubungi admin.", "STATE");
  const finals = steps.filter((s) => s.is_final);
  if (finals.length !== 1 || !steps[steps.length - 1].is_final)
    throw new AppError("Konfigurasi jalur tidak valid: harus ada tepat satu tahap akhir di urutan terakhir.", "STATE");

  for (const s of steps) {
    const users = await stepResolverUserIds(client, s, booking.organization_id);
    if (users.length === 0)
      throw new AppError(
        `Tahap "${s.label}" belum memiliki pejabat/akun yang terdaftar untuk organisasi ini. Hubungi admin.`,
        "STATE",
      );
  }
  let i = 0;
  for (const s of steps) {
    await query(
      `INSERT INTO approval_steps (booking_id, step_order, label, resolver_type, resolver_org_id, resolver_role, is_final, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [booking.id, s.step_order, s.label, s.resolver_type, s.resolver_org_id, s.resolver_role, s.is_final, i++ === 0 ? "PENDING" : "WAITING"],
      client,
    );
  }
  const first = steps[0];
  await notify(
    client,
    await stepResolverUserIds(client, first, booking.organization_id),
    "Pengajuan menunggu tindakan Anda",
    `${booking.code} — ${booking.title}`,
    `/dashboard/peminjaman/${booking.id}`,
  );
}

export async function getSteps(db: Db | undefined, bookingId: string) {
  const client = (db && typeof (db as any).query === "function") ? db : undefined;
  return query<StepRow & { acted_by_name: string | null }>(
    `SELECT s.*, u.display_name AS acted_by_name FROM approval_steps s
       LEFT JOIN users u ON u.id = s.acted_by
      WHERE s.booking_id = $1 ORDER BY s.step_order`,
    [bookingId],
    client,
  );
}

export type StepAction = "FORWARD" | "APPROVE" | "REJECT" | "REQUEST_REVISION";

/**
 * Menjalankan tindakan pada tahapan aktif.
 * - Penanda tangan (Dosen Pembina, Kaprodi, BEM, MPM, dll) dapat MENERUSKAN, MEMINTA REVISI, atau MENOLAK.
 * - Tahap akhir (Subbag Umum / Wadir) dapat MENYETUJUI, MEMINTA REVISI, atau MENOLAK.
 */
export async function actOnBooking(actor: Actor, bookingId: string, action: StepAction, note: string) {
  note = note.trim().slice(0, 2000);
  return tx(async (client) => {
    const b = await queryOne<BookingRow>(`SELECT * FROM bookings WHERE id = $1 FOR UPDATE`, [bookingId], client);
    if (!b) throw notFound();
    const isSubbag = actor.role === "SUBBAG_UMUM";
    if (b.status !== "PENDING" && !(b.status === "APPROVED" && isSubbag)) {
      throw new AppError("Pengajuan ini tidak sedang menunggu persetujuan.", "STATE");
    }

    const steps = await query<StepRow>(
      `SELECT * FROM approval_steps WHERE booking_id = $1 ORDER BY step_order FOR UPDATE`,
      [bookingId],
      client,
    );
    const current = steps.find((s) => s.status === "PENDING");
    const finalStep = steps.find((s) => s.is_final);
    if (!current || !finalStep) throw new AppError("Tahapan persetujuan tidak ditemukan.", "STATE");

    const link = `/dashboard/peminjaman/${b.id}`;
    const orgUsers = (
      await query<{ id: string }>(`SELECT id FROM users WHERE organization_id = $1 AND active`, [b.organization_id], client)
    ).map((r) => r.id);

    // REQUEST_REVISION: Mengembalikan pengajuan ke pemohon agar diperbaiki penyampaiannya
    if (action === "REQUEST_REVISION") {
      const canActCurrent = await canActOnStep(client, actor, current, b.organization_id);
      const canActFinal = await canActOnStep(client, actor, finalStep, b.organization_id);
      if (!canActCurrent && !canActFinal) throw forbidden();

      await query(
        `UPDATE approval_steps SET note = $2, acted_by = $3, acted_at = now() WHERE id = $1`,
        [current.id, note || "Perlu revisi penyampaian dokumen/proposal.", actor.id],
        client
      );
      await query(
        `UPDATE bookings SET status = 'REVISION', decision_note = $2, updated_at = now() WHERE id = $1`,
        [b.id, note || "Perlu revisi penyampaian dokumen/proposal."],
        client
      );
      await audit(client, actor, "BOOKING_REVISION_REQUESTED", "booking", b.id, {
        note,
        atStep: current.label,
        requestedByRole: actor.role,
      });
      const reviewerName = current.label;
      await notify(
        client,
        orgUsers,
        "Pengajuan Memerlukan Revisi",
        `${b.code} — ${b.title} dikembalikan oleh ${reviewerName} untuk revisi. Catatan: ${note || "Periksa arahan dan perbaiki berkas proposal."}`,
        link
      );
      return { status: "REVISION" as const };
    }

    if (action === "FORWARD") {
      if (current.is_final) throw new AppError("Tahap akhir harus memberikan keputusan setuju atau tolak.", "STATE");
      if (!(await canActOnStep(client, actor, current, b.organization_id))) throw forbidden();
      await query(
        `UPDATE approval_steps SET status = 'FORWARDED', acted_by = $2, acted_at = now(), note = $3 WHERE id = $1`,
        [current.id, actor.id, note || null],
        client,
      );
      const next = steps.find((s) => s.step_order > current.step_order);
      if (next && next.status === "WAITING") {
        await query(`UPDATE approval_steps SET status = 'PENDING' WHERE id = $1`, [next.id], client);
        await notify(client, await stepResolverUserIds(client, next, b.organization_id), "Pengajuan menunggu tindakan Anda", `${b.code} — ${b.title}`, link);
      }
      await query(`UPDATE bookings SET updated_at = now() WHERE id = $1`, [b.id], client);
      await audit(client, actor, "BOOKING_STEP_FORWARDED", "booking", b.id, { step: current.label, note });
      await notify(client, orgUsers, "Pengajuan diteruskan", `Tahap "${current.label}" untuk "${b.title}" selesai.`, link);
      return { status: "PENDING" as const };
    }

    // APPROVE: Hanya oleh pemegang tahap akhir (Subbagian Umum)
    if (action === "APPROVE") {
      if (!current.is_final)
        throw new AppError("Persetujuan akhir hanya dapat diberikan pada tahap akhir setelah semua tahapan sebelumnya selesai.", "STATE");
      if (!(await canActOnStep(client, actor, current, b.organization_id))) throw forbidden();

      await query(
        `UPDATE approval_steps SET status = 'APPROVED', acted_by = $2, acted_at = now(), note = $3 WHERE id = $1`,
        [current.id, actor.id, note || "Kesiapan fasilitas diverifikasi & disetujui Subbagian Umum"],
        client,
      );
      await query(
        `UPDATE bookings SET status = 'APPROVED', decided_at = now(), decided_by = $2, decision_note = $3, updated_at = now() WHERE id = $1`,
        [b.id, actor.id, note || null],
        client,
      );
      await audit(client, actor, "BOOKING_APPROVED", "booking", b.id, { note, decidedByRole: actor.role });
      await notify(client, orgUsers, "Peminjaman disetujui", `Pengajuan "${b.title}" telah disetujui oleh Subbagian Umum.`, link);
      return { status: "APPROVED" as const };
    }

    // REJECT: Oleh pemegang tahap saat ini ATAU pemegang tahap akhir
    const canActCurrent = await canActOnStep(client, actor, current, b.organization_id);
    const canActFinal = await canActOnStep(client, actor, finalStep, b.organization_id);
    if (!canActCurrent && !canActFinal) throw forbidden();

    await query(
      `UPDATE approval_steps SET status = 'REJECTED', acted_by = $2, acted_at = now(), note = $3 WHERE id = $1`,
      [current.id, actor.id, note || null],
      client,
    );
    await query(
      `UPDATE approval_steps SET status = 'SKIPPED' WHERE booking_id = $1 AND status IN ('PENDING', 'WAITING') AND id != $2`,
      [b.id, current.id],
      client,
    );
    await query(
      `UPDATE bookings SET status = 'REJECTED', decided_at = now(), decided_by = $2, decision_note = $3, updated_at = now() WHERE id = $1`,
      [b.id, actor.id, note || null],
      client,
    );
    await releaseLocks(client, b.id, "REJECTED");
    await audit(client, actor, "BOOKING_REJECTED", "booking", b.id, { note, atStep: current.label, decidedByRole: actor.role });
    const rejectorName = actor.role === "SUBBAG_UMUM" ? "Subbagian Umum" : (actor.role === "WADIR" ? "Wakil Direktur" : current.label);
    await notify(client, orgUsers, "Peminjaman ditolak", `${b.title} ditolak oleh ${rejectorName}.${note ? ` Alasan: ${note}` : ""}`, link);
    return { status: "REJECTED" as const };
  });
}

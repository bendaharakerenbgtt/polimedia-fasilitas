import type { PoolClient } from "pg";
import { query, queryOne, tx, type Db } from "./db";
import { AppError, audit, forbidden, notFound, notify, getSetting, type Actor } from "./core";
import { scheduleSchema } from "@/lib/validation";
import { acquireLock, releaseLocks, checkSlotAvailable } from "./slots";
import type { BookingRow } from "./access";

export type ChangeRequestRow = {
  id: string;
  booking_id: string;
  type: "CANCEL" | "RESCHEDULE";
  reason: string;
  old_usage_start: Date;
  old_event_start: Date;
  old_event_end: Date;
  old_usage_end: Date;
  new_usage_start: Date | null;
  new_event_start: Date | null;
  new_event_end: Date | null;
  new_usage_end: Date | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_by: string;
  requested_at: Date;
  decided_by: string | null;
  decided_at: Date | null;
  decision_note: string | null;
};

/**
 * Organisasi mengajukan permohonan pembatalan atau perubahan jadwal (reschedule).
 * Hanya berlaku untuk booking yang telah APPROVED.
 */
export async function requestBookingChange(
  actor: Actor,
  bookingId: string,
  params: {
    type: "CANCEL" | "RESCHEDULE";
    reason: string;
    newUsageStart?: Date;
    newEventStart?: Date;
    newEventEnd?: Date;
    newUsageEnd?: Date;
  }
) {
  if (actor.role !== "ORG" || !actor.organizationId) {
    throw forbidden();
  }

  const reason = params.reason.trim();
  if (!reason) {
    throw new AppError("Alasan pembatalan/perubahan jadwal wajib diisi.", "VALIDATION");
  }

  if (params.type === "RESCHEDULE") {
    if (
      !params.newUsageStart ||
      !params.newEventStart ||
      !params.newEventEnd ||
      !params.newUsageEnd
    ) {
      throw new AppError("Jadwal baru harus lengkap.", "VALIDATION");
    }
    scheduleSchema.parse({
      usageStart: params.newUsageStart,
      eventStart: params.newEventStart,
      eventEnd: params.newEventEnd,
      usageEnd: params.newUsageEnd,
    });
  }

  return tx(async (client) => {
    const b = await queryOne<BookingRow>(
      `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
      [bookingId],
      client
    );
    if (!b || b.organization_id !== actor.organizationId) {
      throw notFound("Peminjaman tidak ditemukan.");
    }
    if (b.status !== "APPROVED") {
      throw new AppError(
        "Permohonan perubahan/pembatalan hanya dapat diajukan untuk peminjaman yang sudah disetujui.",
        "STATE"
      );
    }

    // Pastikan tidak ada permohonan lain yang masih pending
    const existing = await queryOne(
      `SELECT id FROM change_requests WHERE booking_id = $1 AND status = 'PENDING'`,
      [b.id],
      client
    );
    if (existing) {
      throw new AppError("Masih terdapat permohonan perubahan/pembatalan yang belum diputuskan.", "STATE");
    }

    const cr = await queryOne<ChangeRequestRow>(
      `INSERT INTO change_requests (
        booking_id, type, reason,
        old_usage_start, old_event_start, old_event_end, old_usage_end,
        new_usage_start, new_event_start, new_event_end, new_usage_end,
        requested_by
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12
      ) RETURNING *`,
      [
        b.id,
        params.type,
        reason,
        b.usage_start,
        b.event_start,
        b.event_end,
        b.usage_end,
        params.newUsageStart ?? null,
        params.newEventStart ?? null,
        params.newEventEnd ?? null,
        params.newUsageEnd ?? null,
        actor.id,
      ],
      client
    );

    // Jika perubahan jadwal dan opsi hold slot baru aktif (K8)
    const holdNewSlot = await getSetting(client, "reschedule_hold_new_slot", true);
    if (params.type === "RESCHEDULE" && holdNewSlot && params.newUsageStart && params.newUsageEnd) {
      await acquireLock(client, {
        facilityId: b.facility_id,
        bookingId: b.id,
        kind: "RESCHEDULE",
        usageStart: params.newUsageStart,
        usageEnd: params.newUsageEnd,
        changeRequestId: cr!.id,
      });
    }

    // Beri tahu Wadir dan Subbag Umum
    const oversightUsers = (
      await query<{ id: string }>(`SELECT id FROM users WHERE role IN ('WADIR', 'SUBBAG_UMUM') AND active`, [], client)
    ).map((r) => r.id);

    await notify(
      client,
      oversightUsers,
      `Permohonan ${params.type === "CANCEL" ? "Pembatalan" : "Perubahan Jadwal"}`,
      `${b.code} — ${b.title}: ${reason}`,
      `/dashboard/peminjaman/${b.id}`
    );

    await audit(client, actor, "CHANGE_REQUEST_CREATED", "change_request", cr!.id, {
      type: params.type,
      bookingId: b.id,
      reason,
    });

    return cr!;
  });
}

/**
 * Keputusan Wadir atau Subbag Umum atas permohonan pembatalan atau reschedule.
 */
export async function decideChangeRequest(
  actor: Actor,
  changeRequestId: string,
  approved: boolean,
  decisionNote?: string
) {
  if (actor.role !== "WADIR" && actor.role !== "SUBBAG_UMUM") {
    throw forbidden("Hanya Wakil Direktur atau Subbagian Umum yang berwenang memutuskan pembatalan atau perubahan jadwal.");
  }

  return tx(async (client) => {
    const cr = await queryOne<ChangeRequestRow>(
      `SELECT * FROM change_requests WHERE id = $1 FOR UPDATE`,
      [changeRequestId],
      client
    );
    if (!cr) throw notFound("Permohonan tidak ditemukan.");
    if (cr.status !== "PENDING") {
      throw new AppError("Permohonan ini sudah diputuskan sebelumnya.", "STATE");
    }

    const b = await queryOne<BookingRow>(
      `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
      [cr.booking_id],
      client
    );
    if (!b) throw notFound("Data peminjaman tidak ditemukan.");

    const orgUsers = (
      await query<{ id: string }>(
        `SELECT id FROM users WHERE organization_id = $1 AND active`,
        [b.organization_id],
        client
      )
    ).map((u) => u.id);

    if (!approved) {
      // Ditolak: jika ada lock RESCHEDULE, lepaskan
      await query(
        `UPDATE slot_locks SET active = false, released_at = now(), release_reason = 'RESCHEDULE_REJECTED'
          WHERE change_request_id = $1 AND active = true`,
        [cr.id],
        client
      );

      await query(
        `UPDATE change_requests SET
          status = 'REJECTED', decided_by = $2, decided_at = now(), decision_note = $3
        WHERE id = $1`,
        [cr.id, actor.id, decisionNote ?? null],
        client
      );

      await audit(client, actor, "CHANGE_REQUEST_REJECTED", "change_request", cr.id, {
        decisionNote,
      });

      await notify(
        client,
        orgUsers,
        `Permohonan ${cr.type === "CANCEL" ? "Pembatalan" : "Perubahan Jadwal"} Ditolak`,
        `${b.code}: Permohonan ditolak oleh Wadir. Peminjaman semula tetap berlaku.`,
        `/dashboard/peminjaman/${b.id}`
      );

      return { status: "REJECTED" as const };
    }

    // DISETUJUI
    if (cr.type === "CANCEL") {
      // Lepaskan semua lock peminjaman
      await releaseLocks(client, b.id, "CANCELLED");

      await query(
        `UPDATE bookings SET
          status = 'CANCELLED', cancelled_at = now(), cancel_reason = $2, updated_at = now()
        WHERE id = $1`,
        [b.id, cr.reason],
        client
      );
    } else if (cr.type === "RESCHEDULE") {
      // Lepaskan lock lama
      await releaseLocks(client, b.id, "RESCHEDULED");

      // Kunci jadwal baru secara definitif sebagai BOOKING
      await acquireLock(client, {
        facilityId: b.facility_id,
        bookingId: b.id,
        kind: "BOOKING",
        usageStart: cr.new_usage_start!,
        usageEnd: cr.new_usage_end!,
      });

      // Update waktu di booking
      await query(
        `UPDATE bookings SET
          usage_start = $2, event_start = $3, event_end = $4, usage_end = $5, updated_at = now()
        WHERE id = $1`,
        [b.id, cr.new_usage_start, cr.new_event_start, cr.new_event_end, cr.new_usage_end],
        client
      );
    }

    await query(
      `UPDATE change_requests SET
        status = 'APPROVED', decided_by = $2, decided_at = now(), decision_note = $3
      WHERE id = $1`,
      [cr.id, actor.id, decisionNote ?? null],
      client
    );

    await audit(client, actor, "CHANGE_REQUEST_APPROVED", "change_request", cr.id, {
      type: cr.type,
      decisionNote,
    });

    await notify(
      client,
      orgUsers,
      `Permohonan ${cr.type === "CANCEL" ? "Pembatalan" : "Perubahan Jadwal"} Disetujui`,
      `${b.code}: Permohonan telah disetujui oleh Wadir.`,
      `/dashboard/peminjaman/${b.id}`
    );

    return { status: "APPROVED" as const };
  });
}

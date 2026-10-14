import type { PoolClient } from "pg";
import { query, queryOne, tx, type Db } from "./db";
import { AppError, audit, forbidden, notFound, notify, type Actor } from "./core";
import { scheduleSchema, submitRequiredSchema, type BookingDetails } from "@/lib/validation";
import { acquireLock, releaseLocks, checkSlotAvailable } from "./slots";
import { instantiateSteps, stepResolverUserIds } from "./approvals";
import { assertCanViewBooking, type BookingRow } from "./access";

/**
 * Format kode booking acak unik, contoh: PJM-2026-10001
 */
async function generateBookingCode(client: PoolClient): Promise<string> {
  const row = await queryOne<{ nextval: string }>(
    `SELECT nextval('booking_code_seq')`,
    [],
    client
  );
  const year = new Date().getFullYear();
  const num = String(row?.nextval ?? Date.now()).padStart(5, "0");
  return `PJM-${year}-${num}`;
}

/**
 * Membuat draft pengajuan peminjaman dan menahan (HOLD) slot selama 1 jam.
 */
export async function createBookingDraft(
  actor: Actor,
  input: {
    facilityId: string;
    usageStart: Date;
    eventStart: Date;
    eventEnd: Date;
    usageEnd: Date;
    details?: Partial<BookingDetails>;
  }
) {
  if (actor.role !== "ORG" || !actor.organizationId) {
    throw forbidden("Hanya akun organisasi yang dapat membuat pengajuan peminjaman.");
  }

  // Validasi waktu
  scheduleSchema.parse({
    usageStart: input.usageStart,
    eventStart: input.eventStart,
    eventEnd: input.eventEnd,
    usageEnd: input.usageEnd,
  });

  // Validasi batas waktu minimal pengajuan (H-3 acara)
  const minLeadTimeMs = 3 * 24 * 60 * 60 * 1000;
  if (input.usageStart.getTime() - Date.now() < minLeadTimeMs || input.eventStart.getTime() - Date.now() < minLeadTimeMs) {
    throw new AppError(
      "Peminjaman fasilitas harus diajukan minimal 3 hari (H-3) sebelum jadwal kegiatan dimulai agar alur verifikasi kampus dapat diproses.",
      "VALIDATION"
    );
  }

  return tx(async (client) => {
    // Pastikan fasilitas aktif
    const fac = await queryOne<{ id: string; active: boolean }>(
      `SELECT id, active FROM facilities WHERE id = $1`,
      [input.facilityId],
      client
    );
    if (!fac || !fac.active) {
      throw notFound("Fasilitas tidak ditemukan atau sedang tidak aktif.");
    }

    const code = await generateBookingCode(client);
    const d = input.details ?? {};

    const booking = await queryOne<BookingRow>(
      `INSERT INTO bookings (
        code, organization_id, facility_id, status,
        title, purpose, description,
        usage_start, event_start, event_end, usage_end,
        chair_name, chair_contact, lead_name, lead_contact,
        other_parties, committee, rundown, special_notes,
        created_by
      ) VALUES (
        $1, $2, $3, 'DRAFT',
        $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16, $17, $18,
        $19
      ) RETURNING *`,
      [
        code,
        actor.organizationId,
        input.facilityId,
        d.title ?? "",
        d.purpose ?? "",
        d.description ?? "",
        input.usageStart,
        input.eventStart,
        input.eventEnd,
        input.usageEnd,
        d.chairName ?? "",
        d.chairContact ?? "",
        d.leadName ?? "",
        d.leadContact ?? "",
        JSON.stringify(d.otherParties ?? []),
        JSON.stringify(d.committee ?? []),
        JSON.stringify(d.rundown ?? []),
        d.specialNotes || (Array.isArray(d.participants) && d.participants.length > 0
          ? `Peserta Kegiatan:\n${d.participants.map((p: any) => `- ${p.name || "Peserta"} (NIM: ${p.nim || "-"}) [Prodi: ${p.prodi || "-"}] [Delegasi: ${p.delegation || "-"}]`).join("\n")}`
          : (typeof d.participants === "string" && d.participants ? `Peserta Kegiatan: ${d.participants}` : "")),
        actor.id,
      ],
      client
    );

    // Kunci slot (HOLD maks 1 jam)
    await acquireLock(client, {
      facilityId: input.facilityId,
      bookingId: booking!.id,
      kind: "HOLD",
      usageStart: input.usageStart,
      usageEnd: input.usageEnd,
      holdMinutes: 60,
    });

    if (d.items && d.items.length > 0) {
      for (const item of d.items) {
        await query(
          `INSERT INTO booking_items (booking_id, name, quantity, notes) VALUES ($1, $2, $3, $4)`,
          [booking!.id, item.name, item.quantity, item.notes],
          client
        );
      }
    }

    await audit(client, actor, "BOOKING_DRAFT_CREATED", "booking", booking!.id, {
      code,
      facilityId: input.facilityId,
      usageStart: input.usageStart,
      usageEnd: input.usageEnd,
    });

    return booking!;
  });
}

/**
 * Menyimpan pembaruan formulir draft (bisa dipanggil berulang kali sebelum kirim).
 */
export async function updateBookingDraft(
  actor: Actor,
  bookingId: string,
  data: {
    facilityId?: string;
    usageStart?: Date;
    eventStart?: Date;
    eventEnd?: Date;
    usageEnd?: Date;
    details?: Partial<BookingDetails>;
  }
) {
  if (actor.role !== "ORG" || !actor.organizationId) {
    throw forbidden();
  }

  return tx(async (client) => {
    const b = await queryOne<BookingRow>(
      `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
      [bookingId],
      client
    );
    if (!b || b.organization_id !== actor.organizationId) {
      throw notFound("Pengajuan tidak ditemukan.");
    }
    if (b.status !== "DRAFT" && b.status !== "REVISION") {
      throw new AppError("Hanya pengajuan berstatus draft atau perlu revisi yang dapat diperbarui.", "STATE");
    }

    const facilityId = data.facilityId ?? b.facility_id;
    const usageStart = data.usageStart ?? b.usage_start;
    const eventStart = data.eventStart ?? b.event_start;
    const eventEnd = data.eventEnd ?? b.event_end;
    const usageEnd = data.usageEnd ?? b.usage_end;

    scheduleSchema.parse({ usageStart, eventStart, eventEnd, usageEnd });

    // Jika fasilitas atau rentang waktu berubah, perbarui slot lock
    const timesChanged =
      facilityId !== b.facility_id ||
      usageStart.getTime() !== b.usage_start.getTime() ||
      usageEnd.getTime() !== b.usage_end.getTime();

    if (timesChanged) {
      const minLeadTimeMs = 3 * 24 * 60 * 60 * 1000;
      if (usageStart.getTime() - Date.now() < minLeadTimeMs || eventStart.getTime() - Date.now() < minLeadTimeMs) {
        throw new AppError(
          "Peminjaman fasilitas harus diajukan minimal 3 hari (H-3) sebelum jadwal kegiatan dimulai.",
          "VALIDATION"
        );
      }
      await releaseLocks(client, b.id, "DRAFT_RESCHEDULED");
      await acquireLock(client, {
        facilityId,
        bookingId: b.id,
        kind: "HOLD",
        usageStart,
        usageEnd,
        holdMinutes: 60,
      });
    }

    const d = data.details ?? {};
    const updated = await queryOne<BookingRow>(
      `UPDATE bookings SET
        facility_id = $2,
        usage_start = $3,
        event_start = $4,
        event_end = $5,
        usage_end = $6,
        title = COALESCE($7, title),
        purpose = COALESCE($8, purpose),
        description = COALESCE($9, description),
        chair_name = COALESCE($10, chair_name),
        chair_contact = COALESCE($11, chair_contact),
        lead_name = COALESCE($12, lead_name),
        lead_contact = COALESCE($13, lead_contact),
        other_parties = CASE WHEN $14::jsonb IS NOT NULL THEN $14::jsonb ELSE other_parties END,
        committee = CASE WHEN $15::jsonb IS NOT NULL THEN $15::jsonb ELSE committee END,
        rundown = CASE WHEN $16::jsonb IS NOT NULL THEN $16::jsonb ELSE rundown END,
        special_notes = COALESCE($17, special_notes),
        updated_at = now()
      WHERE id = $1 RETURNING *`,
      [
        b.id,
        facilityId,
        usageStart,
        eventStart,
        eventEnd,
        usageEnd,
        d.title,
        d.purpose,
        d.description,
        d.chairName,
        d.chairContact,
        d.leadName,
        d.leadContact,
        d.otherParties ? JSON.stringify(d.otherParties) : null,
        d.committee ? JSON.stringify(d.committee) : null,
        d.rundown ? JSON.stringify(d.rundown) : null,
        d.specialNotes || (Array.isArray(d.participants) && d.participants.length > 0
          ? `Peserta Kegiatan:\n${d.participants.map((p: any) => `- ${p.name || "Peserta"} (NIM: ${p.nim || "-"}) [Prodi: ${p.prodi || "-"}] [Delegasi: ${p.delegation || "-"}]`).join("\n")}`
          : (typeof d.participants === "string" && d.participants ? `Peserta Kegiatan: ${d.participants}` : null)),
      ],
      client
    );

    if (d.items) {
      await query(`DELETE FROM booking_items WHERE booking_id = $1`, [b.id], client);
      for (const item of d.items) {
        await query(
          `INSERT INTO booking_items (booking_id, name, quantity, notes) VALUES ($1, $2, $3, $4)`,
          [b.id, item.name, item.quantity, item.notes],
          client
        );
      }
    }

    return updated!;
  });
}

/**
 * Mengirim formulir pengajuan:
 * - Memvalidasi kelengkapan data wajib
 * - Mengubah status menjadi PENDING
 * - Mengubah lock HOLD menjadi BOOKING permanen
 * - Meng-inisialisasi alur persetujuan
 */
export async function submitBooking(actor: Actor, bookingId: string) {
  if (actor.role !== "ORG" || !actor.organizationId) {
    throw forbidden();
  }

  return tx(async (client) => {
    const b = await queryOne<BookingRow>(
      `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
      [bookingId],
      client
    );
    if (!b || b.organization_id !== actor.organizationId) {
      throw notFound("Pengajuan tidak ditemukan.");
    }
    if (b.status !== "DRAFT" && b.status !== "REVISION") {
      throw new AppError("Hanya pengajuan berstatus draft atau perlu revisi yang dapat dikirim.", "STATE");
    }

    // Validasi kelengkapan kolom wajib (ketuplak opsional, jika tidak ada ketuplak gunakan kontak ketua organisasi)
    const effectiveLeadName = b.lead_name?.trim() || b.chair_name?.trim() || "";
    const effectiveLeadContact = b.lead_contact?.trim() || b.chair_contact?.trim() || "";

    submitRequiredSchema.parse({
      title: b.title,
      purpose: b.purpose,
      description: b.description,
      chairName: b.chair_name,
      chairContact: b.chair_contact || "-",
      leadName: effectiveLeadName,
      leadContact: effectiveLeadContact,
    });

    // Jika ini adalah pengiriman ulang setelah revisi:
    if (b.status === "REVISION") {
      const submitted = await queryOne<BookingRow>(
        `UPDATE bookings SET
          status = 'PENDING',
          decision_note = NULL,
          updated_at = now()
        WHERE id = $1 RETURNING *`,
        [b.id],
        client
      );

      // Cari tahap yang saat ini sedang PENDING
      const activeStep = await queryOne<{ id: string; label: string; resolver_type: string; resolver_org_id: string | null; resolver_role: string | null }>(
        `SELECT id, label, resolver_type, resolver_org_id, resolver_role FROM approval_steps
         WHERE booking_id = $1 AND status = 'PENDING'
         ORDER BY step_order LIMIT 1`,
        [b.id],
        client
      );

      if (activeStep) {
        const reviewers = await stepResolverUserIds(client, activeStep as any, b.organization_id);
        await notify(
          client,
          reviewers,
          "Hasil Revisi Pengajuan Dikirim",
          `Pengajuan "${b.title}" telah diperbaiki oleh pemohon dan siap ditinjau kembali pada tahap "${activeStep.label}".`,
          `/dashboard/peminjaman/${b.id}`
        );
      }

      await audit(client, actor, "BOOKING_RESUBMITTED", "booking", b.id, {
        code: b.code,
      });

      return submitted!;
    }

    // Alur pengiriman pertama kali (DRAFT -> PENDING):
    // Lepas hold lama dan peroleh BOOKING lock
    await releaseLocks(client, b.id, "SUBMITTED");
    await acquireLock(client, {
      facilityId: b.facility_id,
      bookingId: b.id,
      kind: "BOOKING",
      usageStart: b.usage_start,
      usageEnd: b.usage_end,
    });

    // Update status booking
    const submitted = await queryOne<BookingRow>(
      `UPDATE bookings SET
        status = 'PENDING',
        submitted_at = now(),
        updated_at = now()
      WHERE id = $1 RETURNING *`,
      [b.id],
      client
    );

    // Inisialisasi tahapan approval (snapshot flow)
    await instantiateSteps(client, submitted!);

    await audit(client, actor, "BOOKING_SUBMITTED", "booking", b.id, {
      code: b.code,
    });

    return submitted!;
  });
}

/**
 * Organisasi menarik / membatalkan pengajuan saat masih berstatus PENDING (K4).
 * Langsung melepaskan slot lock.
 */
export async function withdrawPendingBooking(actor: Actor, bookingId: string, reason?: string) {
  if (actor.role !== "ORG" || !actor.organizationId) {
    throw forbidden();
  }

  return tx(async (client) => {
    const b = await queryOne<BookingRow>(
      `SELECT * FROM bookings WHERE id = $1 FOR UPDATE`,
      [bookingId],
      client
    );
    if (!b || b.organization_id !== actor.organizationId) {
      throw notFound();
    }
    if (b.status !== "PENDING" && b.status !== "DRAFT") {
      throw new AppError(
        "Hanya pengajuan berstatus draft atau menunggu persetujuan yang dapat ditarik langsung.",
        "STATE"
      );
    }

    await releaseLocks(client, b.id, "WITHDRAWN");
    await query(
      `UPDATE bookings SET
        status = 'CANCELLED',
        cancelled_at = now(),
        cancel_reason = $2,
        updated_at = now()
      WHERE id = $1`,
      [b.id, reason ?? "Ditarik oleh organisasi pemohon."],
      client
    );

    // Tandai langkah persetujuan yang belum selesai sebagai SKIPPED
    await query(
      `UPDATE approval_steps SET status = 'SKIPPED' WHERE booking_id = $1 AND status IN ('PENDING', 'WAITING')`,
      [b.id],
      client
    );

    // Kumpulkan pihak-pihak yang telah memproses atau sedang menunggu untuk diberitahu
    const activeAndPastSteps = await query<any>(
      `SELECT resolver_type, resolver_org_id, resolver_role FROM approval_steps
       WHERE booking_id = $1 AND status IN ('FORWARDED', 'APPROVED', 'SKIPPED')`,
      [b.id],
      client
    );

    const targetUserIds = new Set<string>();
    for (const step of activeAndPastSteps) {
      const uids = await stepResolverUserIds(client, step, b.organization_id);
      uids.forEach((id) => targetUserIds.add(id));
    }

    if (targetUserIds.size > 0) {
      await notify(
        client,
        Array.from(targetUserIds),
        "Pengajuan Peminjaman Dibatalkan/Ditarik",
        `Pengajuan "${b.title}" telah ditarik oleh pemohon. Alasan: ${reason ?? "Ditarik oleh organisasi pemohon."}`,
        `/dashboard/peminjaman/${b.id}`
      );
    }

    await audit(client, actor, "BOOKING_WITHDRAWN", "booking", b.id, { reason });

    return { ok: true };
  });
}

export type BookedSlotInfo = {
  facilityId: string;
  kind: "HOLD" | "BOOKING" | "RESCHEDULE";
  start: Date;
  end: Date;
  title: string | null;
  purpose: string | null;
  orgName: string | null;
  status: string | null;
};

/**
 * Mengambil jadwal slot fasilitas yang sedang terkunci/terisi agar dapat dilihat pemohon lain.
 */
export async function getFacilityBookedSlots(facilityId?: string): Promise<BookedSlotInfo[]> {
  const params: unknown[] = [];
  let filter = "";
  if (facilityId) {
    params.push(facilityId);
    filter = "AND sl.facility_id = $1";
  }

  const rows = await query<any>(
    `SELECT
      sl.facility_id,
      sl.kind,
      lower(sl.period) as start_time,
      upper(sl.period) as end_time,
      b.title,
      b.purpose,
      b.status,
      o.name as org_name
    FROM slot_locks sl
    LEFT JOIN bookings b ON b.id = sl.booking_id
    LEFT JOIN organizations o ON o.id = b.organization_id
    WHERE sl.active = true
      AND upper(sl.period) >= now()
      ${filter}
    ORDER BY lower(sl.period) ASC`,
    params
  );

  return rows.map((r) => ({
    facilityId: r.facility_id,
    kind: r.kind,
    start: new Date(r.start_time),
    end: new Date(r.end_time),
    title: r.title || "Peminjaman Fasilitas",
    purpose: r.purpose || "-",
    orgName: r.org_name || "Organisasi Mahasiswa",
    status: r.status || "TERKUNCI",
  }));
}

export type StandardItemWithQuantity = {
  name: string;
  quantity: number;
};

export async function getFacilityItemsMap(): Promise<Record<string, StandardItemWithQuantity[]>> {
  const rows = await query<{ facility_id: string; name: string; quantity: number }>(
    `SELECT facility_id, name, quantity FROM facility_items ORDER BY name ASC`
  );
  const map: Record<string, StandardItemWithQuantity[]> = {};
  for (const r of rows) {
    if (!map[r.facility_id]) map[r.facility_id] = [];
    map[r.facility_id].push({ name: r.name, quantity: r.quantity });
  }
  return map;
}

const DEFAULT_INVENTORY_ITEMS = [
  "Speaker",
  "Kursi",
  "Sofa",
  "Meja",
  "Kursi Operator",
  "Meja Operator",
];

export async function getStandardInventoryItems(): Promise<string[]> {
  const row = await queryOne<{ value: any }>(
    `SELECT value FROM settings WHERE key = 'standard_inventory_items'`
  );
  if (row && Array.isArray(row.value) && row.value.length > 0) {
    return row.value;
  }
  return DEFAULT_INVENTORY_ITEMS;
}

export type CampusCalendarEvent = {
  id: string;
  code: string;
  title: string;
  purpose: string;
  description: string;
  status: string;
  facilityId: string;
  facilityName: string;
  facilityLocation: string;
  orgName: string;
  orgType: string;
  leadName: string;
  leadContact: string;
  usageStart: Date;
  eventStart: Date;
  eventEnd: Date;
  usageEnd: Date;
};

/**
 * Mengambil agenda kegiatan kampus dalam rentang 3 bulan (1 bulan lalu s/d 2 bulan ke depan).
 * Menampilkan kegiatan yang terkonfirmasi (APPROVED) maupun yang sedang dalam alur verifikasi (PENDING).
 */
export async function getCampusCalendarEvents(): Promise<CampusCalendarEvent[]> {
  const rows = await query<any>(`
    SELECT
      b.id,
      b.code,
      b.title,
      b.purpose,
      b.description,
      b.status,
      b.facility_id,
      f.name AS facility_name,
      f.location AS facility_location,
      o.name AS org_name,
      o.type AS org_type,
      b.lead_name,
      b.lead_contact,
      b.usage_start,
      b.event_start,
      b.event_end,
      b.usage_end
    FROM bookings b
    JOIN facilities f ON f.id = b.facility_id
    JOIN organizations o ON o.id = b.organization_id
    WHERE b.status IN ('APPROVED', 'PENDING', 'COMPLETED')
      AND b.event_end >= (now() - interval '30 days')
      AND b.event_start <= (now() + interval '90 days')
    ORDER BY b.event_start ASC
  `);

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    purpose: r.purpose,
    description: r.description,
    status: r.status,
    facilityId: r.facility_id,
    facilityName: r.facility_name,
    facilityLocation: r.facility_location,
    orgName: r.org_name,
    orgType: r.org_type,
    leadName: r.lead_name || "-",
    leadContact: r.lead_contact || "-",
    usageStart: new Date(r.usage_start),
    eventStart: new Date(r.event_start),
    eventEnd: new Date(r.event_end),
    usageEnd: new Date(r.usage_end),
  }));
}

/**
 * Pemakaian fasilitas internal oleh Pimpinan Kampus (WADIR) atau Pengelola Fasilitas (SUBBAG_UMUM):
 * - Hanya butuh Nama Kegiatan, Deskripsi, Fasilitas, dan Waktu (Mulai/Selesai).
 * - Tidak memerlukan tahapan rumit / proposal mahasiswa.
 * - Dari WADIR: Masuk ke SUBBAG_UMUM (status PENDING dengan 1 tahap verifikasi Subbag Umum).
 * - Dari SUBBAG_UMUM: Langsung disetujui (status APPROVED) tanpa perlu persetujuan lagi.
 */
export async function createInternalBooking(
  actor: Actor,
  input: {
    facilityId: string;
    title: string;
    description?: string;
    usageStart: Date;
    eventStart?: Date;
    eventEnd?: Date;
    usageEnd: Date;
  }
) {
  if (actor.role !== "WADIR" && actor.role !== "SUBBAG_UMUM") {
    throw forbidden("Hanya Wakil Direktur atau Subbagian Umum yang dapat menggunakan fitur ini.");
  }

  const title = input.title.trim();
  const description = (input.description ?? "").trim();
  if (!title) {
    throw new AppError("Nama kegiatan wajib diisi.", "VALIDATION");
  }

  // Jika waktu acara tidak diisi terpisah, samakan dengan waktu penggunaan fasilitas
  const usageStart = input.usageStart;
  const usageEnd = input.usageEnd;
  const eventStart = input.eventStart ?? input.usageStart;
  const eventEnd = input.eventEnd ?? input.usageEnd;

  // Validasi waktu
  scheduleSchema.parse({
    usageStart,
    eventStart,
    eventEnd,
    usageEnd,
  });

  return tx(async (client) => {
    // Pastikan fasilitas aktif
    const fac = await queryOne<{ id: string; name: string; active: boolean }>(
      `SELECT id, name, active FROM facilities WHERE id = $1`,
      [input.facilityId],
      client
    );
    if (!fac || !fac.active) {
      throw notFound("Fasilitas tidak ditemukan atau sedang tidak aktif.");
    }

    // Dapatkan organisasi default untuk pimpinan/internal kampus
    let org = await queryOne<{ id: string }>(
      `SELECT id FROM organizations WHERE type = 'BEM' LIMIT 1`,
      [],
      client
    );
    if (!org) {
      org = await queryOne<{ id: string }>(
        `SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1`,
        [],
        client
      );
    }
    if (!org) {
      throw new AppError("Data organisasi kampus tidak ditemukan.", "STATE");
    }

    const code = await generateBookingCode(client);
    const isWadir = actor.role === "WADIR";
    const status = isWadir ? "PENDING" : "APPROVED";

    const applicantLabel = isWadir
      ? "Wakil Direktur Kemahasiswaan (Pimpinan Kampus)"
      : "Subbagian Umum (Pengelola Fasilitas)";

    // Insert booking
    const booking = await queryOne<BookingRow>(
      `INSERT INTO bookings (
        code, organization_id, facility_id, status,
        title, purpose, description,
        usage_start, event_start, event_end, usage_end,
        chair_name, chair_contact, lead_name, lead_contact,
        other_parties, committee, rundown, special_notes,
        created_by, submitted_at, decided_at, decided_by, decision_note
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15,
        '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $16,
        $17, now(), $18, $19, $20
      ) RETURNING *`,
      [
        code,
        org.id,
        input.facilityId,
        status,
        title,
        `Agenda Internal Kampus: ${title}`,
        description,
        usageStart,
        eventStart,
        eventEnd,
        usageEnd,
        applicantLabel,
        "-",
        applicantLabel,
        "-",
        `Penggunaan Fasilitas Langsung oleh ${applicantLabel}`,
        actor.id,
        !isWadir ? new Date() : null,
        !isWadir ? actor.id : null,
        !isWadir ? "Disetujui otomatis oleh Subbagian Umum (Pengelola Fasilitas)" : null,
      ],
      client
    );

    // Kunci slot fasilitas secara permanen (BOOKING)
    await acquireLock(client, {
      facilityId: input.facilityId,
      bookingId: booking!.id,
      kind: "BOOKING",
      usageStart,
      usageEnd,
    });

    if (isWadir) {
      // Dari Wadir ke Subtim: Buat 1 approval step menuju SUBBAG_UMUM
      await query(
        `INSERT INTO approval_steps (
          booking_id, step_order, label, resolver_type, resolver_role, is_final, status
        ) VALUES ($1, 1, 'Subbagian Umum (Verifikasi & Pengesahan Fasilitas)', 'ROLE', 'SUBBAG_UMUM', true, 'PENDING')`,
        [booking!.id],
        client
      );

      // Beritahu personil Subbag Umum
      const subbagUsers = await query<{ id: string }>(
        `SELECT id FROM users WHERE role = 'SUBBAG_UMUM' AND active`,
        [],
        client
      );
      if (subbagUsers.length > 0) {
        await notify(
          client,
          subbagUsers.map((u) => u.id),
          "Agenda Penggunaan Fasilitas oleh WADIR",
          `Wakil Direktur mengajukan penggunaan fasilitas "${fac.name}" untuk "${title}". Menunggu konfirmasi kesiapan sarana.`,
          `/dashboard/peminjaman/${booking!.id}`
        );
      }
    } else {
      // Dari Subtim (Subbag Umum): Buat step yang langsung APPROVED
      await query(
        `INSERT INTO approval_steps (
          booking_id, step_order, label, resolver_type, resolver_role, is_final, status, acted_by, acted_at, note
        ) VALUES ($1, 1, 'Subbagian Umum (Pengelola Fasilitas)', 'ROLE', 'SUBBAG_UMUM', true, 'APPROVED', $2, now(), 'Penggunaan langsung oleh Subbagian Umum')`,
        [booking!.id, actor.id],
        client
      );
    }

    await audit(client, actor, "INTERNAL_FACILITY_BOOKED", "booking", booking!.id, {
      code,
      title,
      facilityName: fac.name,
      status,
      byRole: actor.role,
    });

    return booking!;
  });
}

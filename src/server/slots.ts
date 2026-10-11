import type { PoolClient } from "pg";
import { query, queryOne, pgCode, PG } from "./db";
import { AppError } from "./core";

/**
 * Membersihkan hold sementara yang sudah kedaluwarsa.
 * Dipanggil sebelum cek ketersediaan atau sebelum penguncian slot.
 */
export async function cleanupExpiredHolds(client: PoolClient) {
  await query(
    `UPDATE slot_locks
        SET active = false, released_at = now(), release_reason = 'EXPIRED_HOLD'
      WHERE active = true AND kind = 'HOLD' AND expires_at < now()`,
    [],
    client
  );
}

/**
 * Melepaskan semua kunci aktif terkait peminjaman (misal ketika REJECTED atau CANCELLED).
 */
export async function releaseLocks(
  client: PoolClient,
  bookingId: string,
  reason: string
) {
  await query(
    `UPDATE slot_locks
        SET active = false, released_at = now(), release_reason = $2
      WHERE booking_id = $1 AND active = true`,
    [bookingId, reason],
    client
  );
}

/**
 * Mengunci slot untuk peminjaman (HOLD, BOOKING, atau RESCHEDULE).
 * Menggunakan exclusion constraint PostgreSQL (no_overlap) untuk mencegah bentrok dan race condition.
 */
export async function acquireLock(
  client: PoolClient,
  params: {
    facilityId: string;
    bookingId: string;
    kind: "HOLD" | "BOOKING" | "RESCHEDULE";
    usageStart: Date;
    usageEnd: Date;
    holdMinutes?: number;
    changeRequestId?: string | null;
  }
) {
  await cleanupExpiredHolds(client);

  const expiresAt =
    params.kind === "HOLD"
      ? new Date(Date.now() + (params.holdMinutes ?? 60) * 60 * 1000)
      : null;

  try {
    const res = await queryOne<{ id: string }>(
      `INSERT INTO slot_locks (
        facility_id, booking_id, change_request_id, kind, period, active, expires_at
      ) VALUES (
        $1, $2, $3, $4, tstzrange($5, $6, '[)'), true, $7
      ) RETURNING id`,
      [
        params.facilityId,
        params.bookingId,
        params.changeRequestId ?? null,
        params.kind,
        params.usageStart,
        params.usageEnd,
        expiresAt,
      ],
      client
    );
    return res!.id;
  } catch (err: unknown) {
    if (pgCode(err) === PG.EXCLUSION_VIOLATION) {
      throw new AppError(
        "Fasilitas pada rentang waktu tersebut sudah dipesan atau sedang dalam proses peminjaman pihak lain.",
        "CONFLICT"
      );
    }
    throw err;
  }
}

/**
 * Memeriksa ketersediaan slot tertentu (apakah bentrok dengan lock aktif).
 */
export async function checkSlotAvailable(
  client: PoolClient,
  facilityId: string,
  usageStart: Date,
  usageEnd: Date,
  excludeBookingId?: string | null
): Promise<boolean> {
  await cleanupExpiredHolds(client);

  const overlap = await queryOne(
    `SELECT 1 FROM slot_locks
      WHERE facility_id = $1
        AND active = true
        AND period && tstzrange($2, $3, '[)')
        ${excludeBookingId ? "AND booking_id <> $4" : ""}
      LIMIT 1`,
    excludeBookingId
      ? [facilityId, usageStart, usageEnd, excludeBookingId]
      : [facilityId, usageStart, usageEnd],
    client
  );

  return !overlap;
}

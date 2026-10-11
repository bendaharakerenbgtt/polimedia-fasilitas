import type { PoolClient } from "pg";
import { query, queryOne, tx, type Db } from "./db";
import { AppError, audit, forbidden, notFound, notify, type Actor } from "./core";
import type { BookingRow } from "./access";

export type SbaRow = {
  id: string;
  booking_id: string;
  organization_id: string;
  doc_number: string;
  status: "DRAFT" | "SUBMITTED" | "COMPLETED";
  description: string;
  outcomes: string;
  obstacles: string;
  evaluation: string;
  total_income: string;
  total_expense: string;
  balance: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

export type SbaFinanceItem = {
  id?: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type SbaRundownItem = {
  id?: string;
  itemOrder: number;
  agenda: string;
  actualTime: string;
  pic: string;
  notes?: string;
};

/**
 * Membuat draft laporan SBA untuk kegiatan yang telah disetujui atau selesai.
 */
export async function getOrCreateSba(actor: Actor, bookingId: string) {
  return tx(async (client) => {
    const b = await queryOne<BookingRow>(
      `SELECT * FROM bookings WHERE id = $1`,
      [bookingId],
      client
    );
    if (!b) throw notFound("Peminjaman tidak ditemukan.");

    // SBA hanya untuk peminjaman yang telah disetujui dan acaranya telah selesai dilaksanakan
    if (b.status !== "COMPLETED" && b.status !== "APPROVED") {
      throw new AppError("Laporan SBA hanya dapat dibuat untuk peminjaman yang telah disetujui atau selesai.", "STATE");
    }

    const now = new Date();
    const eventEnded = new Date(b.event_end) <= now;
    if (b.status === "APPROVED" && !eventEnded) {
      throw new AppError("Laporan SBA baru dapat diisi setelah pelaksanaan kegiatan selesai.", "STATE");
    }

    // Cek hak akses
    if (actor.role === "ORG" && b.organization_id !== actor.organizationId) {
      throw forbidden();
    }

    let sba = await queryOne<SbaRow>(
      `SELECT * FROM sba_reports WHERE booking_id = $1`,
      [bookingId],
      client
    );

    if (!sba) {
      if (actor.role !== "ORG") {
        throw notFound("Laporan SBA belum dibuat oleh organisasi terkait.");
      }
      sba = await queryOne<SbaRow>(
        `INSERT INTO sba_reports (
          booking_id, organization_id, status, created_by
        ) VALUES ($1, $2, 'DRAFT', $3) RETURNING *`,
        [bookingId, actor.organizationId, actor.id],
        client
      );

      await audit(client, actor, "SBA_CREATED", "sba_report", sba!.id, { bookingId });
    }

    return sba!;
  });
}

/**
 * Menyimpan data SBA (identitas, pelaksanaan, rundown aktual, dan keuangan).
 * Total & saldo dihitung otomatis di backend secara presisi (integer Rupiah).
 */
export async function saveSba(
  actor: Actor,
  sbaId: string,
  data: {
    docNumber?: string;
    description?: string;
    outcomes?: string;
    obstacles?: string;
    evaluation?: string;
    rundown?: SbaRundownItem[];
    finances?: SbaFinanceItem[];
    submit?: boolean;
  }
) {
  if (actor.role !== "ORG" || !actor.organizationId) {
    throw forbidden();
  }

  return tx(async (client) => {
    const sba = await queryOne<SbaRow>(
      `SELECT * FROM sba_reports WHERE id = $1 FOR UPDATE`,
      [sbaId],
      client
    );
    if (!sba || sba.organization_id !== actor.organizationId) {
      throw notFound("Laporan SBA tidak ditemukan.");
    }
    if (sba.status === "COMPLETED") {
      throw new AppError("Laporan SBA ini sudah berstatus selesai dan tidak dapat diubah.", "STATE");
    }

    // Hitung rekap keuangan
    let totalIncome = BigInt(0);
    let totalExpense = BigInt(0);

    if (data.finances) {
      await query(`DELETE FROM sba_finance_items WHERE sba_id = $1`, [sba.id], client);
      for (const f of data.finances) {
        const qty = Math.max(1, Math.floor(f.quantity || 1));
        const unit = BigInt(Math.max(0, Math.floor(f.unitPrice || 0)));
        const total = BigInt(qty) * unit;

        if (f.type === "INCOME") {
          totalIncome += total;
        } else {
          totalExpense += total;
        }

        await query(
          `INSERT INTO sba_finance_items (
            sba_id, type, category, description, quantity, unit_price, total_price
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            sba.id,
            f.type,
            f.category ?? "",
            f.description,
            qty,
            unit.toString(),
            total.toString(),
          ],
          client
        );
      }
    } else {
      totalIncome = BigInt(sba.total_income);
      totalExpense = BigInt(sba.total_expense);
    }

    const balance = totalIncome - totalExpense;

    if (data.rundown) {
      await query(`DELETE FROM sba_rundown_items WHERE sba_id = $1`, [sba.id], client);
      let order = 1;
      for (const r of data.rundown) {
        await query(
          `INSERT INTO sba_rundown_items (
            sba_id, item_order, agenda, actual_time, pic, notes
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [sba.id, order++, r.agenda, r.actualTime, r.pic, r.notes ?? ""],
          client
        );
      }
    }

    const newStatus = data.submit ? "SUBMITTED" : sba.status;

    const updated = await queryOne<SbaRow>(
      `UPDATE sba_reports SET
        doc_number = COALESCE($2, doc_number),
        description = COALESCE($3, description),
        outcomes = COALESCE($4, outcomes),
        obstacles = COALESCE($5, obstacles),
        evaluation = COALESCE($6, evaluation),
        total_income = $7,
        total_expense = $8,
        balance = $9,
        status = $10,
        updated_at = now()
      WHERE id = $1 RETURNING *`,
      [
        sba.id,
        data.docNumber,
        data.description,
        data.outcomes,
        data.obstacles,
        data.evaluation,
        totalIncome.toString(),
        totalExpense.toString(),
        balance.toString(),
        newStatus,
      ],
      client
    );

    await audit(client, actor, data.submit ? "SBA_SUBMITTED" : "SBA_UPDATED", "sba_report", sba.id, {
      totalIncome: totalIncome.toString(),
      totalExpense: totalExpense.toString(),
      balance: balance.toString(),
      status: newStatus,
    });

    return updated!;
  });
}

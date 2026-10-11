import { describe, it, expect, beforeAll } from "vitest";
import "dotenv/config";
import { query, queryOne, tx } from "@/server/db";
import { createBookingDraft, submitBooking, withdrawPendingBooking } from "@/server/bookings";
import { actOnBooking } from "@/server/approvals";
import { requestBookingChange, decideChangeRequest } from "@/server/changes";
import { getOrCreateSba, saveSba } from "@/server/sba";
import { AppError, type Actor } from "@/server/core";

describe("Sistem Peminjaman Fasilitas PoliMedia — Acceptance Tests", () => {
  let ukmFotoUser: Actor;
  let ukmMusikUser: Actor;
  let dosenFotoUser: Actor;
  let bemUser: Actor;
  let mpmUser: Actor;
  let wadirUser: Actor;
  let aulaFacilityId: string;

  beforeAll(async () => {
    // Ambil akun demo dari database
    const users = await query<any>(`SELECT id, username, role, organization_id, prodi_id FROM users`);
    const byUsername = (name: string): Actor => {
      const u = users.find((x) => x.username === name);
      if (!u) throw new Error(`User ${name} tidak ditemukan`);
      return {
        id: u.id,
        role: u.role,
        organizationId: u.organization_id,
        prodiId: u.prodi_id,
      };
    };

    ukmFotoUser = byUsername("ukm.foto");
    ukmMusikUser = byUsername("ukm.musik");
    dosenFotoUser = byUsername("dosen.foto");
    bemUser = byUsername("bem");
    mpmUser = byUsername("mpm");
    wadirUser = byUsername("wadir");

    const aula = await queryOne<any>(`SELECT id FROM facilities WHERE code = 'AULA'`);
    aulaFacilityId = aula.id;
  });

  it("1. Penguncian jadwal & pencegahan bentrok (exclusion constraint) berfungsi", async () => {
    // UKM Foto membuat draft peminjaman Aula jam 08:00 - 14:00 (acara 09:00 - 13:00)
    const baseDate = new Date("2026-11-20T00:00:00+07:00");
    const usageStart = new Date(baseDate.getTime() + 8 * 3600 * 1000);
    const eventStart = new Date(baseDate.getTime() + 9 * 3600 * 1000);
    const eventEnd = new Date(baseDate.getTime() + 13 * 3600 * 1000);
    const usageEnd = new Date(baseDate.getTime() + 14 * 3600 * 1000);

    const bookingFoto = await createBookingDraft(ukmFotoUser, {
      facilityId: aulaFacilityId,
      usageStart,
      eventStart,
      eventEnd,
      usageEnd,
      details: {
        title: "Pameran Fotografi Tahunan",
        purpose: "Pameran karya mahasiswa",
        description: "Kegiatan pameran fotografi",
        chairName: "Ketua Foto",
        leadName: "Ketupel Foto",
        leadContact: "08123456789",
      },
    });

    expect(bookingFoto).toBeDefined();
    expect(bookingFoto.status).toBe("DRAFT");

    // UKM Musik mencoba memesan Aula pada slot yang bertabrakan (misal 10:00 - 12:00)
    const overlapStart = new Date(baseDate.getTime() + 10 * 3600 * 1000);
    const overlapEnd = new Date(baseDate.getTime() + 12 * 3600 * 1000);

    await expect(
      createBookingDraft(ukmMusikUser, {
        facilityId: aulaFacilityId,
        usageStart: overlapStart,
        eventStart: overlapStart,
        eventEnd: overlapEnd,
        usageEnd: overlapEnd,
        details: {
          title: "Latihan Musik Bersama",
          purpose: "Latihan",
          description: "Latihan bersama",
          chairName: "Ketua Musik",
          leadName: "Ketupel Musik",
          leadContact: "08987654321",
        },
      })
    ).rejects.toThrow("Fasilitas pada rentang waktu tersebut sudah dipesan");

    // UKM Foto mengirim formulir pengajuan → status PENDING & slot dikunci permanen
    const submitted = await submitBooking(ukmFotoUser, bookingFoto.id);
    expect(submitted.status).toBe("PENDING");

    // Cek tahapan approval terbentuk
    const steps = await query<any>(
      `SELECT * FROM approval_steps WHERE booking_id = $1 ORDER BY step_order ASC`,
      [bookingFoto.id]
    );
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps[0].status).toBe("PENDING"); // Dosen pembimbing
    expect(steps[0].label).toContain("Dosen pembimbing");

    // Dosen foto menandatangani & meneruskan
    const res1 = await actOnBooking(dosenFotoUser, bookingFoto.id, "FORWARD", "Disetujui dosen");
    expect(res1.status).toBe("PENDING");

    // BEM menandatangani & meneruskan
    const res2 = await actOnBooking(bemUser, bookingFoto.id, "FORWARD", "Disetujui BEM");
    expect(res2.status).toBe("PENDING");

    // MPM menandatangani & meneruskan
    const res3 = await actOnBooking(mpmUser, bookingFoto.id, "FORWARD", "Disetujui MPM");
    expect(res3.status).toBe("PENDING");

    // Wadir memberikan persetujuan akhir
    const resFinal = await actOnBooking(wadirUser, bookingFoto.id, "APPROVE", "Disetujui Wadir");
    expect(resFinal.status).toBe("APPROVED");

    const approvedBooking = await queryOne<any>(`SELECT status FROM bookings WHERE id = $1`, [bookingFoto.id]);
    expect(approvedBooking.status).toBe("APPROVED");
  });

  it("2. Perhitungan Keuangan SBA Otomatis dan Konsisten", async () => {
    // Ambil salah satu booking APPROVED
    const b = await queryOne<any>(`SELECT id FROM bookings WHERE status = 'APPROVED' LIMIT 1`);
    expect(b).toBeDefined();

    const sba = await getOrCreateSba(ukmFotoUser, b.id);
    expect(sba).toBeDefined();

    const updated = await saveSba(ukmFotoUser, sba.id, {
      docNumber: "SBA/TEST/001",
      description: "Kegiatan berjalan sukses",
      finances: [
        { type: "INCOME", category: "KAMPUS", description: "Dana Kemahasiswaan", quantity: 1, unitPrice: 5000000 },
        { type: "INCOME", category: "SPONSOR", description: "Sponsor Luar", quantity: 2, unitPrice: 1000000 },
        { type: "EXPENSE", category: "KONSUMSI", description: "Snack Kotak", quantity: 100, unitPrice: 20000 },
        { type: "EXPENSE", category: "DOKUMENTASI", description: "Cetak Banner", quantity: 2, unitPrice: 250000 },
      ],
      submit: true,
    });

    // Pemasukan: 5.000.000 + 2.000.000 = 7.000.000
    // Pengeluaran: 2.000.000 + 500.000 = 2.500.000
    // Saldo: 4.500.000
    expect(updated.total_income).toBe("7000000");
    expect(updated.total_expense).toBe("2500000");
    expect(updated.balance).toBe("4500000");
    expect(updated.status).toBe("SUBMITTED");
  });
});

/**
 * Skrip Simulasi Data Real-Time untuk Peminjaman Fasilitas Kampus PoliMedia.
 * Pemakaian: npm run simulate
 */
import "dotenv/config";
import { query, queryOne, tx } from "../src/server/db";
import { createBookingDraft, submitBooking } from "../src/server/bookings";
import { actOnBooking } from "../src/server/approvals";

async function main() {
  console.log("Memulai simulasi skenario peminjaman kampus...");

  // 1. Ambil akun dan fasilitas
  const ukmFoto = await queryOne<any>(`SELECT u.* FROM users u WHERE username = 'ukm.foto'`);
  const himaDg = await queryOne<any>(`SELECT u.* FROM users u WHERE username = 'hima.dg'`);
  const dosenFoto = await queryOne<any>(`SELECT u.* FROM users u WHERE username = 'dosen.foto'`);
  const kaprodiDg = await queryOne<any>(`SELECT u.* FROM users u WHERE username = 'kaprodi.dg'`);
  const bem = await queryOne<any>(`SELECT u.* FROM users u WHERE username = 'bem'`);
  const mpm = await queryOne<any>(`SELECT u.* FROM users u WHERE username = 'mpm'`);
  const wadir = await queryOne<any>(`SELECT u.* FROM users u WHERE username = 'wadir'`);

  const aula = await queryOne<any>(`SELECT id FROM facilities WHERE code = 'AULA'`);
  const superCenter = await queryOne<any>(`SELECT id FROM facilities WHERE code = 'SUPER-CENTER'`);
  const studio = await queryOne<any>(`SELECT id FROM facilities WHERE code = 'STUDIO'`);

  // Bersihkan booking lama agar bersih untuk simulasi
  await query(`DELETE FROM slot_locks`);
  await query(`DELETE FROM approval_steps`);
  await query(`DELETE FROM sba_reports`);
  await query(`DELETE FROM change_requests`);
  await query(`DELETE FROM bookings`);

  const now = new Date();

  // SKENARIO 1: AULA - SEDANG DIGUNAKAN SAAT INI (ACTIVE OCCUPIED)
  // Mulai 1 jam lalu, selesai 2 jam lagi
  const s1UsageStart = new Date(now.getTime() - 2 * 3600 * 1000);
  const s1EventStart = new Date(now.getTime() - 1 * 3600 * 1000);
  const s1EventEnd = new Date(now.getTime() + 2 * 3600 * 1000);
  const s1UsageEnd = new Date(now.getTime() + 3 * 3600 * 1000);

  const b1 = await createBookingDraft(
    { id: ukmFoto.id, role: ukmFoto.role, organizationId: ukmFoto.organization_id, prodiId: ukmFoto.prodi_id },
    {
      facilityId: aula.id,
      usageStart: s1UsageStart,
      eventStart: s1EventStart,
      eventEnd: s1EventEnd,
      usageEnd: s1UsageEnd,
      details: {
        title: "Pameran Karya Fotografi Dies Natalis PoliMedia",
        purpose: "Pameran fotografi tahunan mahasiswa",
        description: "Pameran karya fotografi dokumenter dan seni kreatif civitas akademika.",
        chairName: "Rian Pratama",
        chairContact: "081288991122",
        leadName: "Dimas Anggara",
        leadContact: "081399882233",
      },
    }
  );

  await submitBooking(
    { id: ukmFoto.id, role: ukmFoto.role, organizationId: ukmFoto.organization_id, prodiId: ukmFoto.prodi_id },
    b1.id
  );
  // Jalur approval UKM: Dosen -> BEM -> MPM -> Wadir
  await actOnBooking({ id: dosenFoto.id, role: dosenFoto.role, organizationId: null, prodiId: null }, b1.id, "FORWARD", "Disetujui dosen pembina");
  await actOnBooking({ id: bem.id, role: bem.role, organizationId: bem.organization_id, prodiId: null }, b1.id, "FORWARD", "Rekomendasi BEM diberikan");
  await actOnBooking({ id: mpm.id, role: mpm.role, organizationId: mpm.organization_id, prodiId: null }, b1.id, "FORWARD", "Diteruskan MPM");
  await actOnBooking({ id: wadir.id, role: wadir.role, organizationId: null, prodiId: null }, b1.id, "APPROVE", "Peminjaman Aula disetujui resmi oleh Wadir");

  console.log("✓ Skenario 1: Aula diisi status 'Sedang Digunakan' oleh UKM Fotografi.");

  // SKENARIO 2: SUPER CENTER - TERJADWAL BESOK (TERSEDIA / FREE SAAT INI)
  const tomorrow = new Date(now.getTime() + 24 * 3600 * 1000);
  const s2UsageStart = new Date(tomorrow.getTime() + 8 * 3600 * 1000);
  const s2EventStart = new Date(tomorrow.getTime() + 9 * 3600 * 1000);
  const s2EventEnd = new Date(tomorrow.getTime() + 15 * 3600 * 1000);
  const s2UsageEnd = new Date(tomorrow.getTime() + 16 * 3600 * 1000);

  const b2 = await createBookingDraft(
    { id: himaDg.id, role: himaDg.role, organizationId: himaDg.organization_id, prodiId: himaDg.prodi_id },
    {
      facilityId: superCenter.id,
      usageStart: s2UsageStart,
      eventStart: s2EventStart,
      eventEnd: s2EventEnd,
      usageEnd: s2UsageEnd,
      details: {
        title: "Design Festival & Typography Workshop",
        purpose: "Pelatihan desain tipografi dan seminar industri kreatif",
        description: "Kegiatan akademik prodi Desain Grafis dengan pemateri praktisi industri.",
        chairName: "Sarah Amalia",
        chairContact: "081977665544",
        leadName: "Budi Santoso",
        leadContact: "081233445566",
      },
    }
  );

  await submitBooking(
    { id: himaDg.id, role: himaDg.role, organizationId: himaDg.organization_id, prodiId: himaDg.prodi_id },
    b2.id
  );
  // Jalur HIMA: Kaprodi -> BEM -> MPM -> Wadir
  await actOnBooking({ id: kaprodiDg.id, role: kaprodiDg.role, organizationId: null, prodiId: kaprodiDg.prodi_id }, b2.id, "FORWARD", "Disetujui Kaprodi Desain Grafis");
  await actOnBooking({ id: bem.id, role: bem.role, organizationId: bem.organization_id, prodiId: null }, b2.id, "FORWARD", "Diteruskan BEM");
  await actOnBooking({ id: mpm.id, role: mpm.role, organizationId: mpm.organization_id, prodiId: null }, b2.id, "FORWARD", "Diteruskan MPM");
  await actOnBooking({ id: wadir.id, role: wadir.role, organizationId: null, prodiId: null }, b2.id, "APPROVE", "Disetujui Wadir");

  console.log("✓ Skenario 2: Super Center berstatus FREE (Tersedia) dengan jadwal terkonfirmasi besok.");

  // SKENARIO 3: STUDIO - PENDING MENUNGGU TINDAKAN
  const s3UsageStart = new Date(now.getTime() + 48 * 3600 * 1000);
  const s3EventStart = new Date(now.getTime() + 49 * 3600 * 1000);
  const s3EventEnd = new Date(now.getTime() + 52 * 3600 * 1000);
  const s3UsageEnd = new Date(now.getTime() + 53 * 3600 * 1000);

  const b3 = await createBookingDraft(
    { id: ukmFoto.id, role: ukmFoto.role, organizationId: ukmFoto.organization_id, prodiId: ukmFoto.prodi_id },
    {
      facilityId: studio.id,
      usageStart: s3UsageStart,
      eventStart: s3EventStart,
      eventEnd: s3EventEnd,
      usageEnd: s3UsageEnd,
      details: {
        title: "Sesi Pemotretan Studio UKM Fotografi",
        purpose: "Praktik pencahayaan studio",
        description: "Praktik teknik lighting indoor studio untuk anggota baru.",
        chairName: "Rian Pratama",
        leadName: "Dimas Anggara",
        leadContact: "081399882233",
      },
    }
  );

  await submitBooking(
    { id: ukmFoto.id, role: ukmFoto.role, organizationId: ukmFoto.organization_id, prodiId: ukmFoto.prodi_id },
    b3.id
  );

  console.log("✓ Skenario 3: Studio memiliki pengajuan PENDING yang menunggu tindakan dosen pembimbing.");
  console.log("Simulasi selesai! Silakan refresh browser.");
}

main().catch((err) => {
  console.error("Gagal menjalankan simulasi:", err);
  process.exit(1);
});

/**
 * Data awal (fasilitas, organisasi contoh, akun demo, konfigurasi alur).
 * Pemakaian: npm run db:seed
 *
 * PERINGATAN: akun demo memakai kata sandi bersama. Jangan jalankan di
 * produksi kecuali dengan SEED_ALLOW_PROD=true lalu segera ganti semua sandi.
 */
import "dotenv/config";
import path from "node:path";
import { Client } from "pg";
import { hashPassword } from "../src/server/password";

export const DEMO_PASSWORD = "demo12345";

export const FACILITIES = [
  {
    code: "AULA",
    name: "Aula PoliMedia",
    category: "Aula",
    location: "Aula Gedung B Lantai 3, Politeknik Negeri Media Kreatif Jakarta",
  },
  {
    code: "MASJID",
    name: "Masjid Ar-Rahman",
    category: "Masjid",
    location: "Masjid Ar-Rahman Politeknik Negeri Media Kreatif Jakarta",
  },
  {
    code: "PUSGIWA-2",
    name: "Pusgiwa Lantai 2",
    category: "Pusgiwa",
    location: "Lantai 2, Pusgiwa (Pusat Kegiatan Mahasiswa) Politeknik Negeri Media Kreatif Jakarta",
  },
  {
    code: "PUSGIWA-3",
    name: "Pusgiwa Lantai 3",
    category: "Pusgiwa",
    location: "Lantai 3, Pusgiwa (Pusat Kegiatan Mahasiswa) Politeknik Negeri Media Kreatif Jakarta",
  },
];

const SETTINGS: { key: string; value: unknown; description: string }[] = [
  { key: "hold_minutes", value: 60, description: "Durasi penahanan slot saat formulir awal diisi (menit)." },
  {
    key: "reschedule_hold_new_slot",
    value: true,
    description:
      "BELUM DIKONFIRMASI (16.6). Jika true, slot jadwal baru langsung ditahan saat permohonan perubahan dikirim.",
  },
  {
    key: "wadir_can_reject_early",
    value: true,
    description: "Wakil Direktur dapat menolak pengajuan sebelum tahapan sebelumnya selesai.",
  },
  {
    key: "spz_deadline_days",
    value: null,
    description: "BELUM DIKONFIRMASI (16.8). Tenggat H-n penyerahan SPZ. null = tidak diterapkan.",
  },
  {
    key: "sba_deadline_days",
    value: null,
    description: "BELUM DIKONFIRMASI (16.9). Tenggat pengumpulan SBA setelah kegiatan. null = tidak diterapkan.",
  },
];

export async function seed(connectionString: string, log = console.log) {
  const isCloud =
    connectionString.includes("sslmode=") ||
    connectionString.includes("neon.tech") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("pooler.supabase.com") ||
    connectionString.includes("render.com") ||
    connectionString.includes("aivencloud.com");
  const c = new Client({
    connectionString,
    ssl: isCloud ? { rejectUnauthorized: false } : undefined,
  });
  await c.connect();
  try {
    await c.query("BEGIN");
    const pw = await hashPassword(DEMO_PASSWORD);

    for (const s of SETTINGS) {
      await c.query(
        `INSERT INTO settings (key, value, description) VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING`,
        [s.key, JSON.stringify(s.value), s.description],
      );
    }

    for (const f of FACILITIES) {
      const res = await c.query<{ id: string }>(
        `INSERT INTO facilities (code, name, category, location, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [f.code, f.name, f.category, f.location, `${f.name} kampus PoliMedia. Detail kapasitas & aturan menunggu data resmi.`],
      );
      const facId = res.rows[0]?.id;
      if (facId) {
        const defaultItems = [
          { name: "Kursi", quantity: 50 },
          { name: "Kursi Operator", quantity: 2 },
          { name: "Meja", quantity: 10 },
          { name: "Meja Operator", quantity: 1 },
          { name: "Sofa", quantity: 2 },
          { name: "Speaker", quantity: 2 },
        ];
        for (const item of defaultItems) {
          const check = await c.query(
            `SELECT 1 FROM facility_items WHERE facility_id = $1 AND name = $2`,
            [facId, item.name]
          );
          if (check.rowCount === 0) {
            await c.query(
              `INSERT INTO facility_items (facility_id, name, quantity, condition, notes)
               VALUES ($1, $2, $3, 'Baik', '')`,
              [facId, item.name, item.quantity]
            );
          }
        }
      }
    }

    const prodi = async (code: string, name: string) =>
      (
        await c.query<{ id: string }>(
          `INSERT INTO prodi (code, name) VALUES ($1, $2)
           ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [code, name],
        )
      ).rows[0].id;
    const prodiDG = await prodi("DG", "Desain Grafis (contoh)");

    const org = async (code: string, name: string, type: string, prodiId: string | null = null) =>
      (
        await c.query<{ id: string }>(
          `INSERT INTO organizations (code, name, type, prodi_id) VALUES ($1, $2, $3, $4)
           ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [code, name, type, prodiId],
        )
      ).rows[0].id;
    const bem = await org("BEM", "Badan Eksekutif Mahasiswa", "BEM");
    const mpm = await org("MPM", "Majelis Permusyawaratan Mahasiswa", "MPM");
    const ukmFoto = await org("UKM-FOTO", "UKM Fotografi (contoh)", "UKM");
    const ukmMusik = await org("UKM-MUSIK", "UKM Musik (contoh)", "UKM");
    const himaDG = await org("HIMA-DG", "HIMA Desain Grafis (contoh)", "HIMA", prodiDG);

    const user = async (
      username: string,
      display: string,
      role: string,
      orgId: string | null = null,
      prodiId: string | null = null,
    ) =>
      (
        await c.query<{ id: string }>(
          `INSERT INTO users (username, password_hash, display_name, role, organization_id, prodi_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id`,
          [username, pw, display, role, orgId, prodiId],
        )
      ).rows[0].id;

    await user("admin", "Administrator Sistem", "ADMIN");
    await user("wadir", "Wakil Direktur Bidang Kemahasiswaan dan Alumni", "WADIR");
    await user("subbag", "Subbagian Umum", "SUBBAG_UMUM");
    await user("kaprodi.dg", "Kaprodi Desain Grafis", "KAPRODI", null, prodiDG);
    const dosen1 = await user("dosen.foto", "Dosen Pembina UKM Fotografi", "ADVISOR");
    const dosen2 = await user("dosen.musik", "Dosen Pembina UKM Musik", "ADVISOR");
    await user("bem", "Akun BEM", "ORG", bem);
    await user("mpm", "Akun MPM", "ORG", mpm);
    await user("ukm.foto", "Akun UKM Fotografi", "ORG", ukmFoto);
    await user("ukm.musik", "Akun UKM Musik", "ORG", ukmMusik);
    await user("hima.dg", "Akun HIMA Desain Grafis", "ORG", himaDG);

    for (const [o, u] of [
      [ukmFoto, dosen1],
      [ukmMusik, dosen2],
    ]) {
      await c.query(`INSERT INTO org_advisors VALUES ($1, $2) ON CONFLICT DO NOTHING`, [o, u]);
    }

    // Jalur persetujuan AWAL (brief bagian 7) — masih perlu dicocokkan dengan aturan resmi.
    // Langkah "ketua pelaksana & ketua organisasi" dicatat saat pengiriman formulir (K1).
    type Step = [label: string, type: string, orgId: string | null, role: string | null, final?: boolean];
    const WADIR: Step = ["Wakil Direktur Bidang Kemahasiswaan dan Alumni", "ROLE", null, "WADIR", true];
    const flows: Record<string, Step[]> = {
      UKM: [
        ["Dosen pembimbing/pembina", "ORG_ADVISOR", null, null],
        ["BEM", "ORGANIZATION", bem, null],
        ["MPM", "ORGANIZATION", mpm, null],
        WADIR,
      ],
      HIMA: [
        ["Kaprodi (atau dosen pembina sesuai ketentuan)", "PRODI_KAPRODI", null, null],
        ["BEM", "ORGANIZATION", bem, null],
        ["MPM", "ORGANIZATION", mpm, null],
        WADIR,
      ],
      BEM: [["MPM", "ORGANIZATION", mpm, null], WADIR],
      MPM: [WADIR],
    };
    for (const [type, steps] of Object.entries(flows)) {
      const existing = await c.query(`SELECT 1 FROM approval_flows WHERE kind='BOOKING' AND org_type=$1`, [type]);
      if (existing.rowCount) continue;
      const flowId = (
        await c.query<{ id: string }>(
          `INSERT INTO approval_flows (kind, org_type, name, notes) VALUES ('BOOKING', $1, $2, $3) RETURNING id`,
          [type, `Jalur peminjaman ${type}`, "Rancangan awal dari brief; menunggu konfirmasi aturan resmi."],
        )
      ).rows[0].id;
      let i = 1;
      for (const [label, rtype, orgId, role, final] of steps) {
        await c.query(
          `INSERT INTO approval_flow_steps (flow_id, step_order, label, resolver_type, resolver_org_id, resolver_role, is_final)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [flowId, i++, label, rtype, orgId, role, final ?? false],
        );
      }
    }

    await c.query("COMMIT");
    log(`Seed selesai. Kata sandi akun demo: ${DEMO_PASSWORD}`);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PROD !== "true") {
    throw new Error("Seed demo diblokir di produksi. Set SEED_ALLOW_PROD=true jika benar-benar diperlukan.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diatur");
  seed(url).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

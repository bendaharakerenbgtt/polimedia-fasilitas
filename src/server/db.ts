import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var __pgPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi");
  const isCloud =
    connectionString.includes("sslmode=") ||
    connectionString.includes("neon.tech") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("pooler.supabase.com") ||
    connectionString.includes("render.com") ||
    connectionString.includes("aivencloud.com");
  const pool = new Pool({
    connectionString,
    max: 10,
    ssl: isCloud ? { rejectUnauthorized: false } : undefined,
  });
  // Semua waktu disimpan sebagai timestamptz; sesi DB memakai zona kampus.
  pool.on("connect", (c) => c.query("SET TIME ZONE 'Asia/Jakarta'"));
  return pool;
}

let schemaEnsured = false;
async function ensureSchema(pool: Pool) {
  if (schemaEnsured) return;
  schemaEnsured = true;
  try {
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL`);

    // Simulasi agenda uji coba di tanggal 16 Oktober 2026 (agar user bisa langsung melihat tampilan 3+ acara)
    const checkSim = await pool.query(`SELECT COUNT(*) AS cnt FROM bookings WHERE title IN ('Workshop UI/UX Design', 'Latihan Rutin Teater Kampus')`);
    if (Number(checkSim.rows[0]?.cnt || 0) === 0) {
      const facs = await pool.query(`SELECT id, name FROM facilities LIMIT 4`);
      const orgs = await pool.query(`SELECT id, name FROM organizations WHERE type IN ('HIMA', 'UKM') LIMIT 4`);
      if (facs.rows.length >= 2 && orgs.rows.length >= 2) {
        // Acara 2 di tanggal 16 Okt (Pusgiwa Lantai 2 / Aula)
        const fac2 = facs.rows[1] || facs.rows[0];
        const org2 = orgs.rows[1] || orgs.rows[0];
        await pool.query(`
          INSERT INTO bookings (
            code, title, purpose, description, status, facility_id, organization_id,
            lead_name, lead_contact, usage_start, event_start, event_end, usage_end
          ) VALUES (
            'PJM-2026-90001',
            'Workshop UI/UX Design',
            'Pelatihan desain antarmuka bagi mahasiswa baru kreatif',
            'Kegiatan workshop mendatangkan praktisi industri kreatif mengenai tren UI/UX dan design system.',
            'APPROVED',
            $1,
            $2,
            'Siti Rahma',
            '081298765432',
            '2026-10-16 08:30:00+07',
            '2026-10-16 09:00:00+07',
            '2026-10-16 12:00:00+07',
            '2026-10-16 12:30:00+07'
          ) ON CONFLICT DO NOTHING
        `, [fac2.id, org2.id]);

        // Acara 3 di tanggal 16 Okt (Aula / Fasilitas lain)
        const fac3 = facs.rows[2] || facs.rows[0];
        const org3 = orgs.rows[2] || orgs.rows[0];
        await pool.query(`
          INSERT INTO bookings (
            code, title, purpose, description, status, facility_id, organization_id,
            lead_name, lead_contact, usage_start, event_start, event_end, usage_end
          ) VALUES (
            'PJM-2026-90002',
            'Latihan Rutin Teater Kampus',
            'Gladi resik pementasan drama festival tahunan',
            'Latihan bersama UKM Teater untuk persiapan pentas seni akhir semester kampus PoliMedia.',
            'APPROVED',
            $1,
            $2,
            'Dimas Prasetyo',
            '085612345678',
            '2026-10-16 13:30:00+07',
            '2026-10-16 14:00:00+07',
            '2026-10-16 17:30:00+07',
            '2026-10-16 18:00:00+07'
          ) ON CONFLICT DO NOTHING
        `, [fac3.id, org3.id]);
      }
    }
  } catch (err) {
    console.warn("Could not alter bookings for archived_at:", err);
  }
}

export function getPool(): Pool {
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = createPool();
    ensureSchema(globalThis.__pgPool);
  }
  return globalThis.__pgPool;
}

export type Db = Pick<PoolClient, "query">;

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  db: Db = getPool(),
): Promise<T[]> {
  const res = await db.query<T>(sql, params);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
  db: Db = getPool(),
): Promise<T | null> {
  const rows = await query<T>(sql, params, db);
  return rows[0] ?? null;
}

/** Menjalankan fn dalam satu transaksi; rollback otomatis jika terjadi error. */
export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Kode error PostgreSQL yang relevan. */
export const PG = {
  EXCLUSION_VIOLATION: "23P01",
  UNIQUE_VIOLATION: "23505",
  CHECK_VIOLATION: "23514",
} as const;

export function pgCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

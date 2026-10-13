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

/**
 * Menjalankan migrasi SQL di db/migrations secara berurutan.
 * Pemakaian: npm run db:migrate
 */
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

export async function migrate(connectionString: string, log = console.log) {
  const isCloud =
    connectionString.includes("sslmode=") ||
    connectionString.includes("neon.tech") ||
    connectionString.includes("supabase.co") ||
    connectionString.includes("pooler.supabase.com") ||
    connectionString.includes("render.com") ||
    connectionString.includes("aivencloud.com");
  const client = new Client({
    connectionString,
    ssl: isCloud ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const dir = path.join(process.cwd(), "db", "migrations");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    const { rows } = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
    const applied = new Set(rows.map((r) => r.name));
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(path.join(dir, file), "utf8");
      log(`→ menerapkan ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
    log("Migrasi selesai.");
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diatur");
  migrate(url).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

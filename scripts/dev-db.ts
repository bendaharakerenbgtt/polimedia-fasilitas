/**
 * PostgreSQL lokal untuk pengembangan TANPA Docker (memakai paket embedded-postgres).
 * Produksi sebaiknya memakai PostgreSQL terkelola atau docker-compose.yml.
 *
 * Pemakaian: npm run db:start   (biarkan berjalan di terminal terpisah)
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), ".data", "pg");
const port = Number(process.env.DEV_PG_PORT ?? 54329);

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: true,
    onLog: () => {},
  });
  const fresh = !existsSync(path.join(dir, "PG_VERSION"));
  if (fresh) await pg.initialise();
  await pg.start();
  for (const name of ["polimedia", "polimedia_test"]) {
    try {
      await pg.createDatabase(name);
    } catch {
      /* sudah ada */
    }
  }
  console.log(`PostgreSQL berjalan di port ${port} (data: ${dir}). Ctrl+C untuk berhenti.`);
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

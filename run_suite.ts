import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const pgDir = path.join(process.cwd(), ".data", "pg");

async function main() {
  console.log("[1/3] Menjalankan Database...");
  const pg = new EmbeddedPostgres({
    databaseDir: pgDir,
    user: "postgres",
    password: "postgres",
    port: 54329,
    persistent: true,
    onLog: () => {},
  });
  if (!existsSync(path.join(pgDir, "PG_VERSION"))) await pg.initialise();
  await pg.start();
  for (const name of ["polimedia", "polimedia_test"]) {
    try { await pg.createDatabase(name); } catch {}
  }
  console.log("✓ Database PostgreSQL siap di port 54329.");

  console.log("[2/3] Menjalankan Web Next.js...");
  const nextProcess = spawn("npx", ["next", "dev", "-p", "3000"], {
    stdio: "inherit",
    shell: true,
  });

  const cleanup = async () => {
    console.log("Mematikan server & database...");
    nextProcess.kill("SIGTERM");
    await pg.stop();
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

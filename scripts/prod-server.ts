import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const pgDir = path.join(process.cwd(), ".data", "pg");

async function start() {
  console.log("==================================================");
  console.log(" [POLIMEDIA FASILITAS] Menjalankan Server Utama   ");
  console.log("==================================================");

  // 1. Jalankan PostgreSQL
  const pg = new EmbeddedPostgres({
    databaseDir: pgDir,
    user: "postgres",
    password: "postgres",
    port: 54329,
    persistent: true,
    onLog: () => {},
  });

  if (!existsSync(path.join(pgDir, "PG_VERSION"))) {
    console.log("Menginisialisasi basis data baru...");
    await pg.initialise();
  }
  await pg.start();

  for (const name of ["polimedia", "polimedia_test"]) {
    try { await pg.createDatabase(name); } catch {}
  }
  console.log("✓ Database PostgreSQL Berjalan di Port 54329");

  // 2. Jalankan Next.js Production Server
  const app = spawn("npx", ["next", "start", "-p", "3000"], {
    stdio: "inherit",
    shell: true,
  });

  const stop = async () => {
    console.log("\nMematikan aplikasi...");
    app.kill("SIGTERM");
    await pg.stop();
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

start().catch((err) => {
  console.error("Gagal menjalankan sistem:", err);
  process.exit(1);
});

import "dotenv/config";
import { query } from "../src/server/db";

async function main() {
  await query("DELETE FROM slot_locks");
  await query("DELETE FROM approval_steps");
  await query("DELETE FROM sba_reports");
  await query("DELETE FROM change_requests");
  await query("DELETE FROM bookings");
  console.log("Semua data peminjaman dummy telah dibersihkan.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { requireUser } from "@/server/auth";
import { getAuditLogsAdmin } from "@/server/admin";
import Link from "next/link";
import AuditLogViewer from "./AuditLogViewer";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireUser(["ADMIN"]);
  const logs = await getAuditLogsAdmin(150, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition shadow-2xs"
            >
              <span>←</span>
              <span>Kembali ke Dashboard</span>
            </Link>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Log Audit Aktivitas Sistem
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Pencatatan riwayat setiap aksi penting, perubahan status pengajuan, dan audit keamanan dalam bahasa yang mudah dipahami
          </p>
        </div>
      </div>

      <AuditLogViewer logs={logs} />
    </div>
  );
}

import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getUserActivityLogs } from "@/server/admin";
import AuditLogViewer from "@/app/dashboard/admin/audit/AuditLogViewer";

export const dynamic = "force-dynamic";

export default async function UserAktivitasPage() {
  const user = await requireUser();
  const logs = await getUserActivityLogs(user.id, user.organizationId, 100);

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
            Riwayat Aktivitas
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Rekam jejak tindakan, pengajuan, persetujuan, dan riwayat login resmi akun Anda ({user.displayName})
          </p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center gap-3 text-xs text-blue-900">
        <div>
          <strong>Informasi Privasi:</strong> Halaman ini hanya menampilkan rekam jejak aktivitas yang dilakukan oleh akun Anda (dan lembaga organisasi Anda). Akun lain tidak dapat melihat riwayat aktivitas ini kecuali Administrator Sistem.
        </div>
      </div>

      <AuditLogViewer logs={logs} />
    </div>
  );
}

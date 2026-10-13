import Link from "next/link";
import { requireUser } from "@/server/auth";
import { query } from "@/server/db";
import { bookingVisibility } from "@/server/access";
import { getUserActivityLogs } from "@/server/admin";
import { fmtDateTime, fmtRange } from "@/lib/time";
import { BOOKING_STATUS_LABEL } from "@/lib/roles";
import { getFacilityImage } from "@/lib/facilityImages";
import AuditLogViewer from "@/app/dashboard/admin/audit/AuditLogViewer";

export const dynamic = "force-dynamic";

export default async function UserHistoriPage() {
  const user = await requireUser();
  const [pred, params] = bookingVisibility(user, 1);

  // Ambil data pengajuan terdahulu:
  // - Status REJECTED, COMPLETED, CANCELLED, atau yang secara eksplisit diarsipkan (archived_at IS NOT NULL)
  // - Serta seluruh pengajuan lampau milik organisasi ini untuk riwayat lengkap
  const [historyBookings, logs] = await Promise.all([
    query<any>(
      `SELECT
        b.id, b.code, b.title, b.status,
        b.organization_id, b.archived_at,
        b.usage_start, b.usage_end, b.event_start, b.event_end,
        b.submitted_at, b.created_at, b.decision_note, b.cancel_reason,
        f.name AS facility_name, f.location AS facility_location,
        o.name AS org_name
      FROM bookings b
      JOIN facilities f ON f.id = b.facility_id
      JOIN organizations o ON o.id = b.organization_id
      WHERE ${pred}
        AND (
          b.archived_at IS NOT NULL
          OR b.status IN ('REJECTED', 'COMPLETED', 'CANCELLED')
          OR (b.status = 'APPROVED' AND b.event_end < now())
        )
      ORDER BY COALESCE(b.archived_at, b.created_at) DESC
      LIMIT 100`,
      params
    ),
    getUserActivityLogs(user.id, user.organizationId, 100),
  ]);

  const rejectedCount = historyBookings.filter((b) => b.status === "REJECTED").length;
  const completedCount = historyBookings.filter((b) => b.status === "COMPLETED" || (b.status === "APPROVED" && new Date(b.event_end) < new Date())).length;
  const cancelledCount = historyBookings.filter((b) => b.status === "CANCELLED").length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner Halaman Histori */}
      <div className="bg-gradient-to-r from-purple-950 via-[#3b0764] to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-md border border-purple-800/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Histori & Arsip Pengajuan
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/90 max-w-2xl mt-1">
            Rekap seluruh permohonan fasilitas yang telah selesai, ditolak setelah dibaca, atau dibatalkan oleh akun organisasi Anda ({user.displayName}).
          </p>
        </div>

        {/* Ringkasan Statistik Histori */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 px-4 py-2.5 rounded-xl text-center">
            <span className="text-[11px] text-purple-200 block font-medium">Selesai Acara</span>
            <strong className="text-lg text-emerald-400 font-extrabold">{completedCount}</strong>
          </div>
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 px-4 py-2.5 rounded-xl text-center">
            <span className="text-[11px] text-purple-200 block font-medium">Ditolak</span>
            <strong className="text-lg text-rose-400 font-extrabold">{rejectedCount}</strong>
          </div>
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 px-4 py-2.5 rounded-xl text-center">
            <span className="text-[11px] text-purple-200 block font-medium">Ditarik/Batal</span>
            <strong className="text-lg text-slate-300 font-extrabold">{cancelledCount}</strong>
          </div>
        </div>
      </div>

      {/* Bagian 1: Tabel Pengajuan Terdahulu (Mudah Dimengerti & Bersih) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <span>📁</span>
              <span>Arsip Pengajuan Peminjaman Selesai & Ditolak ({historyBookings.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Pengajuan di bawah ini sudah tidak memerlukan tindakan aktif dan tersimpan rapi untuk kebutuhan arsip/bukti kegiatan.
            </p>
          </div>
        </div>

        {historyBookings.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <div className="text-3xl">📭</div>
            <div className="font-semibold text-slate-600">Belum ada arsip pengajuan terdahulu.</div>
            <p className="max-w-md mx-auto text-slate-400 text-[11px]">
              Pengajuan yang selesai dilaksanakan atau pengajuan ditolak yang telah Anda tandai dibaca akan otomatis tersimpan di halaman ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Kegiatan & Organisasi</th>
                  <th className="px-6 py-3.5">Fasilitas Kampus</th>
                  <th className="px-6 py-3.5">Waktu Penggunaan</th>
                  <th className="px-6 py-3.5">Status Akhir</th>
                  <th className="px-6 py-3.5">Catatan / Keterangan</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyBookings.map((b) => {
                  const isDone = b.status === "COMPLETED" || (b.status === "APPROVED" && new Date(b.event_end) < new Date());
                  const isRejected = b.status === "REJECTED";
                  const isCancelled = b.status === "CANCELLED";

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{b.title || "(Tanpa Judul)"}</div>
                        <div className="text-xs text-slate-500">{b.org_name}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Draft dibuat: {fmtDateTime(b.created_at)}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-10 rounded-lg overflow-hidden shrink-0 border border-slate-200 bg-slate-900 shadow-2xs">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getFacilityImage(b.facility_name).imageUrl}
                              alt={b.facility_name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <strong className="text-slate-900 block truncate">{b.facility_name}</strong>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {b.facility_location || "Kampus PoliMedia"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-600">
                        {fmtRange(b.usage_start, b.usage_end)}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                            isDone
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : isRejected
                              ? "bg-rose-50 text-rose-800 border-rose-300"
                              : isCancelled
                              ? "bg-slate-100 text-slate-600 border-slate-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}
                        >
                          {isDone ? "Selesai Berlangsung" : BOOKING_STATUS_LABEL[b.status] || b.status}
                        </span>
                        {b.archived_at && (
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            Diarsipkan: {fmtDateTime(b.archived_at)}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs">
                        {isRejected ? (
                          <div className="text-rose-700 bg-rose-50/80 p-2 rounded-lg border border-rose-200/70 max-w-xs">
                            <span className="font-semibold block text-[10px] uppercase text-rose-800">Alasan Penolakan:</span>
                            <span className="line-clamp-2">{b.decision_note || "Tidak disetujui pihak berwenang."}</span>
                          </div>
                        ) : isCancelled ? (
                          <div className="text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 max-w-xs">
                            <span className="font-semibold block text-[10px] uppercase text-slate-500">Alasan Pembatalan:</span>
                            <span className="line-clamp-2">{b.cancel_reason || "Ditarik oleh organisasi pemohon."}</span>
                          </div>
                        ) : isDone ? (
                          <span className="text-emerald-700 font-semibold text-xs">
                            ✓ Fasilitas telah selesai digunakan
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <Link
                          href={`/dashboard/peminjaman/${b.id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline px-2.5 py-1 rounded-md hover:bg-blue-50 transition"
                        >
                          <span>Detail</span>
                          <span>→</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bagian 2: Log Jejak Audit Akun */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
              <span>⏱️</span>
              <span>Jejak Riwayat Aktivitas & Log Sistem</span>
            </h3>
            <p className="text-xs text-slate-500">
              Rincian linimasa setiap tindakan pengajuan, perbaikan form, dan perubahan status yang tercatat di sistem.
            </p>
          </div>
        </div>

        <AuditLogViewer logs={logs} />
      </div>
    </div>
  );
}

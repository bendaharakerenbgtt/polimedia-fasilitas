import Link from "next/link";
import { requireUser } from "@/server/auth";
import { query } from "@/server/db";
import { bookingVisibility } from "@/server/access";
import { BOOKING_STATUS_LABEL, ROLE_LABEL } from "@/lib/roles";
import { fmtDateTime, fmtRange } from "@/lib/time";
import { getAdminStats } from "@/server/admin";
import { getCampusCalendarEvents } from "@/server/bookings";
import CampusCalendarViewer from "./kalender/CampusCalendarViewer";
import CompactNotifications from "./CompactNotifications";
import DashboardTabSwitcher from "./DashboardTabSwitcher";
import { getFacilityImage } from "@/lib/facilityImages";
import InternalBookingModal from "./InternalBookingModal";

export const dynamic = "force-dynamic";

export default async function DashboardOverviewPage() {
  const user = await requireUser();

  const [pred, params] = bookingVisibility(user, 1);

  // Ambil data admin stats jika role ADMIN
  const adminStats = user.role === "ADMIN" ? await getAdminStats() : null;

  // Ambil daftar pengajuan peminjaman sesuai otoritas
  const bookings = await query<any>(
    `SELECT
      b.id, b.code, b.title, b.status,
      b.organization_id,
      b.usage_start, b.usage_end, b.event_start, b.event_end,
      b.submitted_at, b.created_at,
      f.name AS facility_name,
      CASE
        WHEN u.role IN ('WADIR', 'SUBBAG_UMUM') THEN COALESCE(NULLIF(b.other_parties->0->>'name', ''), 'Acara PoliMedia')
        ELSE o.name
      END AS org_name,
      (SELECT count(*) FROM change_requests cr WHERE cr.booking_id = b.id AND cr.status = 'PENDING') AS pending_changes
    FROM bookings b
    JOIN facilities f ON f.id = b.facility_id
    JOIN organizations o ON o.id = b.organization_id
    LEFT JOIN users u ON u.id = b.created_by
    WHERE ${pred} AND b.archived_at IS NULL
    ORDER BY b.created_at DESC
    LIMIT 50`,
    params
  );

  // Ambil pengajuan yang membutuhkan tindakan segera oleh akun ini
  let pendingActions: any[] = [];
  if (user.role === "WADIR" || user.role === "SUBBAG_UMUM") {
    // Pengajuan yang sedang menunggu tindakan role ini secara spesifik
    pendingActions = await query<any>(
      `SELECT b.id, b.code, b.title, s.label AS step_label, f.name AS facility_name, s.is_final
       FROM bookings b
       JOIN facilities f ON f.id = b.facility_id
       JOIN approval_steps s ON s.booking_id = b.id
       WHERE b.status = 'PENDING' AND s.status = 'PENDING'
         AND s.resolver_role = $1`,
      [user.role]
    );
  }

  // Ambil permohonan perubahan jadwal (reschedule) & pembatalan yang berstatus PENDING
  let pendingChanges: any[] = [];
  if (user.role === "WADIR" || user.role === "SUBBAG_UMUM") {
    pendingChanges = await query<any>(
      `SELECT cr.*, b.code, b.title, f.name AS facility_name, o.name AS org_name
       FROM change_requests cr
       JOIN bookings b ON b.id = cr.booking_id
       JOIN facilities f ON f.id = b.facility_id
       JOIN organizations o ON o.id = b.organization_id
       WHERE cr.status = 'PENDING'
       ORDER BY cr.requested_at DESC`
    );
  } else if (user.role === "ADVISOR" || user.role === "KAPRODI" || user.role === "ORG") {
    // Tahapan aktif yang menunjuk role / org ini
    pendingActions = await query<any>(
      `SELECT b.id, b.code, b.title, s.label AS step_label, f.name AS facility_name
       FROM bookings b
       JOIN facilities f ON f.id = b.facility_id
       JOIN approval_steps s ON s.booking_id = b.id
       WHERE b.status = 'PENDING' AND s.status = 'PENDING'
         AND (
           (s.resolver_type = 'ORGANIZATION' AND s.resolver_org_id = $1)
           OR (s.resolver_type = 'ORG_ADVISOR' AND EXISTS (
             SELECT 1 FROM org_advisors oa WHERE oa.organization_id = b.organization_id AND oa.user_id = $2
           ))
           OR (s.resolver_type = 'PRODI_KAPRODI' AND EXISTS (
             SELECT 1 FROM organizations o WHERE o.id = b.organization_id AND o.prodi_id = $3
           ))
         )`,
      [user.organizationId, user.id, user.prodiId]
    );
  }
  const [events, facilities, notifications] = await Promise.all([
    getCampusCalendarEvents(),
    query<{ id: string; name: string; category: string }>(
      `SELECT id, name, category FROM facilities WHERE active = true ORDER BY name ASC`
    ),
    query<any>(
      `SELECT id, title, body, link, created_at, read_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 8`,
      [user.id]
    ),
  ]);

  // Pisahkan pengajuan yang diajukan oleh organisasi sendiri vs permintaan masuk dari organisasi lain
  const isOrgAccount = user.role === "ORG" && Boolean(user.organizationId);
  const isReviewerOrg = user.role === "ORG" && (user.organizationType === "BEM" || user.organizationType === "MPM");
  const ownBookings = isOrgAccount
    ? bookings.filter((b) => b.organization_id === user.organizationId)
    : [];
  const reviewBookings = isOrgAccount
    ? bookings.filter((b) => b.organization_id !== user.organizationId)
    : bookings;

  const renderBookingTable = (items: any[], emptyText: string, isOwnSection = false) => {
    if (items.length === 0) {
      return (
        <div className="p-8 text-center text-slate-500 text-xs">
          <p className="font-medium">{emptyText}</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-xs tracking-wider">
            <tr>
              <th className="px-6 py-3.5">Kegiatan & Organisasi</th>
              <th className="px-6 py-3.5">Fasilitas</th>
              <th className="px-6 py-3.5">Waktu Penggunaan</th>
              <th className="px-6 py-3.5">Waktu Pembuatan Draft</th>
              <th className="px-6 py-3.5">Status</th>
              <th className="px-6 py-3.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((b) => {
              const statusColors: Record<string, string> = {
                DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
                PENDING: "bg-amber-100 text-amber-800 border-amber-200",
                APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
                REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
                CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
                COMPLETED: "bg-blue-100 text-blue-800 border-blue-200",
              };

              return (
                <tr key={b.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{b.title || "(Draft formulir)"}</div>
                    <div className="text-xs text-slate-500">{b.org_name}</div>
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
                        <div className="font-bold text-slate-900 truncate">{b.facility_name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{b.facility_location || "Kampus PoliMedia"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {fmtRange(b.usage_start, b.usage_end)}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600 whitespace-nowrap">
                    <span className="font-medium text-slate-800 block">{fmtDateTime(b.created_at)}</span>
                    {b.submitted_at && (
                      <span className="text-[10px] text-slate-400">Dikirim: {fmtDateTime(b.submitted_at)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                        statusColors[b.status] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {BOOKING_STATUS_LABEL[b.status] || b.status}
                    </span>
                    {Number(b.pending_changes) > 0 && (
                      <span className="block mt-1 text-[10px] text-amber-700 font-bold">
                        ⚠️ Ada permohonan perubahan
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/dashboard/peminjaman/${b.id}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Detail →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header Sambutan Nuansa Kampus PoliMedia (Ungu & Gold) */}
      <div className="bg-gradient-to-r from-purple-950 via-[#3b0764] to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-md border border-purple-800/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Selamat Datang, {user.displayName}
          </h2>
          <p className="text-xs sm:text-sm text-purple-200/90 max-w-xl leading-relaxed">
            Sistem Informasi Pengelolaan & Peminjaman Fasilitas Kampus PoliMedia Jakarta.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {user.role === "ORG" && (
            <Link
              href="/dashboard/peminjaman/baru"
              className="px-5 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl transition shadow-md inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span>
              <span>Ajukan Peminjaman Baru</span>
            </Link>
          )}

          {(user.role === "WADIR" || user.role === "SUBBAG_UMUM") && (
            <InternalBookingModal userRole={user.role} facilities={facilities} />
          )}
        </div>
      </div>

      {/* Notifikasi Ringkas (Modern & Tidak Makan Tempat) */}
      <CompactNotifications notifications={notifications} />

      {/* ADMIN OVERVIEW & QUICK ACTIONS */}
      {adminStats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Pengajuan
                </span>
                <span className="text-xl">📋</span>
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {adminStats.totalBookings}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <span className="text-emerald-600 font-bold">{adminStats.approvedBookings} Disetujui</span>
                <span>•</span>
                <span className="text-amber-600 font-bold">{adminStats.pendingBookings} Proses</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Fasilitas Aktif
                </span>
                <span className="text-xl">🏢</span>
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {adminStats.activeFacilities}{" "}
                <span className="text-sm font-normal text-slate-400">/ {adminStats.totalFacilities}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Gedung, Lab, Studio, Ruang</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Organisasi
                </span>
                <span className="text-xl">🏛️</span>
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {adminStats.totalOrganizations}
              </div>
              <p className="mt-1 text-xs text-slate-500">BEM, MPM, HIMA, UKM</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Pengguna Aktif
                </span>
                <span className="text-xl">👥</span>
              </div>
              <div className="mt-2 text-3xl font-extrabold text-slate-900">
                {adminStats.totalUsers}
              </div>
              <p className="mt-1 text-xs text-slate-500">Akun terdaftar dalam sistem</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href="/dashboard/admin/fasilitas"
              className="bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-2xl p-5 transition shadow-xs group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg mb-3 group-hover:scale-105 transition">
                🏢
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-700">
                Kelola Fasilitas
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Tambah, edit gedung/ruang, status aktif, dan kapasitas.
              </p>
            </Link>

            <Link
              href="/dashboard/admin/pengguna"
              className="bg-white hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 transition shadow-xs group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg mb-3 group-hover:scale-105 transition">
                👥
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700">
                Pengguna & Organisasi
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Manajemen akun, reset password, dan dosen pembina.
              </p>
            </Link>

            <Link
              href="/dashboard/admin/pengaturan"
              className="bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 rounded-2xl p-5 transition shadow-xs group"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg mb-3 group-hover:scale-105 transition">
                ⚙️
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-amber-700">
                Pengaturan Kebijakan
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Atur hold minutes, batas waktu reschedule, dan deadlines.
              </p>
            </Link>

            <Link
              href="/dashboard/admin/audit"
              className="bg-white hover:bg-purple-50/50 border border-slate-200 hover:border-purple-300 rounded-2xl p-5 transition shadow-xs group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-lg mb-3 group-hover:scale-105 transition">
                📜
              </div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-purple-700">
                Log Audit Sistem
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Pantau rekaman jejak aktivitas user & perubahan data.
              </p>
            </Link>
          </div>
        </div>
      )}



      {/* Permohonan Perubahan Jadwal (Reschedule) & Pembatalan Masuk */}
      {pendingChanges.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-purple-600 text-white rounded-xl text-lg">📅</span>
              <div>
                <h3 className="text-base font-extrabold text-purple-950">
                  Permohonan Perubahan Jadwal & Pembatalan Masuk
                </h3>
                <p className="text-xs text-purple-700">
                  Terdapat permohonan dari organisasi yang memerlukan persetujuan segera
                </p>
              </div>
            </div>
            <span className="px-3 py-1 bg-purple-200 text-purple-900 font-bold text-xs rounded-full animate-pulse">
              {pendingChanges.length} Menunggu Keputusan
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingChanges.map((cr) => (
              <div key={cr.id} className="bg-white rounded-xl p-4 border border-purple-200 shadow-2xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">
                      {cr.org_name}
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 mt-0.5">{cr.title}</h4>
                    <p className="text-xs text-slate-500">Fasilitas: <strong>{cr.facility_name}</strong></p>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                    cr.type === 'RESCHEDULE' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {cr.type === 'RESCHEDULE' ? 'Pindah Jadwal' : 'Pembatalan'}
                  </span>
                </div>

                <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1 text-slate-700">
                  {cr.type === 'RESCHEDULE' && (
                    <>
                      <div><span className="text-slate-400">Jadwal Semula:</span> <span className="line-through">{fmtRange(cr.old_usage_start, cr.old_usage_end)}</span></div>
                      <div><span className="text-slate-400">Jadwal Baru:</span> <strong className="text-emerald-700">{fmtRange(cr.new_usage_start, cr.new_usage_end)}</strong></div>
                    </>
                  )}
                  <div><span className="text-slate-400">Alasan:</span> <span className="italic">"{cr.reason}"</span></div>
                </div>

                <div className="flex justify-end pt-1">
                  <Link
                    href={`/dashboard/peminjaman/${cr.booking_id}`}
                    className="text-xs font-semibold px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
                  >
                    Tinjau & Putuskan Permohonan →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tindakan Yang Memerlukan Respon Segera */}
      {pendingActions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center space-x-2 text-amber-900 mb-3 font-bold text-sm">
            <span>⚠️</span>
            <span>Memerlukan Tindakan / Persetujuan Anda ({pendingActions.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingActions.map((pa) => (
              <div
                key={pa.id}
                className="bg-white border border-amber-200/80 rounded-xl p-4 flex items-center justify-between shadow-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 text-sm">{pa.title || "(Tanpa Judul)"}</div>
                  <div className="text-xs text-slate-500">
                    {pa.facility_name} • {pa.step_label || "Keputusan Akhir"}
                  </div>
                </div>
                <Link
                  href={`/dashboard/peminjaman/${pa.id}`}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition"
                >
                  Tinjau & Proses
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB SYSTEM: Daftar Pengajuan & Kalender Fasilitas */}
      <DashboardTabSwitcher
        events={events}
        facilities={facilities}
        bookingsCount={isOrgAccount ? ownBookings.length : reviewBookings.length}
        isOrgAccount={isOrgAccount}
        renderBookings={
          <div className="space-y-6">
            {/* TABEL 1: Jika Akun Organisasi (UKM / HIMA / BEM / MPM), pisahkan pengajuan milik sendiri */}
            {isOrgAccount && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Daftar Pengajuan Peminjaman {user.organizationName || "Organisasi"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Seluruh permohonan fasilitas yang diajukan oleh akun organisasi Anda ({ownBookings.length})
                    </p>
                  </div>
                </div>
                {renderBookingTable(ownBookings, "Organisasi Anda belum mengajukan peminjaman fasilitas.", true)}
              </div>
            )}

            {/* TABEL 2: Daftar Permohonan Masuk untuk Ditinjau / Diverifikasi */}
            {(!isOrgAccount || isReviewerOrg || !["UKM", "HIMA"].includes(user.organizationType || "")) && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {isOrgAccount
                        ? `Permohonan Organisasi Lain yang Perlu Ditinjau ${user.displayName}`
                        : "Daftar Permohonan Peminjaman Fasilitas Kampus"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isOrgAccount
                        ? `Daftar pengajuan dari UKM/HIMA lain yang berada dalam alur persetujuan Anda (${reviewBookings.length})`
                        : `${reviewBookings.length} pengajuan peminjaman tercatat dalam sistem`}
                    </p>
                  </div>
                </div>
                {renderBookingTable(
                  reviewBookings,
                  isOrgAccount
                    ? "Tidak ada permohonan peminjaman dari organisasi lain yang masuk ke daftar Anda."
                    : "Belum ada pengajuan peminjaman yang tercatat dalam sistem."
                )}
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getPool, query, queryOne } from "@/server/db";
import { assertCanViewBooking, type BookingRow } from "@/server/access";
import { getSteps } from "@/server/approvals";
import { BOOKING_STATUS_LABEL, STEP_STATUS_LABEL } from "@/lib/roles";
import { fmtDateTime, fmtRange } from "@/lib/time";
import BookingActionPanel from "./BookingActionPanel";
import { getFacilityImage } from "@/lib/facilityImages";
import MarkReadArchiveButton from "./MarkReadArchiveButton";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  // Verifikasi hak akses row-level
  try {
    await assertCanViewBooking(getPool(), user, id);
  } catch (err) {
    console.error("Access error for booking:", id, user.id, err);
    notFound();
  }

  const booking = await queryOne<any>(
    `SELECT b.*,
      f.name AS facility_name, f.location AS facility_location,
      o.name AS org_name, o.type AS org_type,
      u.display_name AS created_by_name,
      u.username AS created_by_username,
      u.role AS created_by_role,
      d.display_name AS decided_by_name
    FROM bookings b
    JOIN facilities f ON f.id = b.facility_id
    JOIN organizations o ON o.id = b.organization_id
    JOIN users u ON u.id = b.created_by
    LEFT JOIN users d ON d.id = b.decided_by
    WHERE b.id = $1`,
    [id]
  );
  if (!booking) notFound();

  const [rawSteps, items, changeRequests, attachments, sbaReport] = await Promise.all([
    getSteps(getPool(), id),
    query<any>(`SELECT * FROM booking_items WHERE booking_id = $1`, [id]),
    query<any>(
      `SELECT cr.*, u.display_name AS decided_by_name, r.display_name AS requested_by_name
       FROM change_requests cr
       LEFT JOIN users u ON u.id = cr.decided_by
       LEFT JOIN users r ON r.id = cr.requested_by
       WHERE cr.booking_id = $1
       ORDER BY cr.requested_at DESC`,
      [id]
    ),
    query<any>(`SELECT * FROM attachments WHERE booking_id = $1 ORDER BY created_at DESC`, [id]),
    queryOne<any>(`SELECT id, status FROM sba_reports WHERE booking_id = $1`, [id]),
  ]);

  // Evaluasi apakah user yang sedang login berhak bertindak di tiap langkah
  const isOwnerOrg = Boolean(user.organizationId && user.organizationId === booking.organization_id);
  const steps = await Promise.all(
    rawSteps.map(async (s) => ({
      ...s,
      canAct:
        (booking.status === "PENDING" || (booking.status === "APPROVED" && s.status === "PENDING")) &&
        s.status === "PENDING" &&
        (s.resolver_type === "ROLE"
          ? s.resolver_role === user.role
          : s.resolver_type === "ORGANIZATION"
          ? s.resolver_org_id === user.organizationId
          : s.resolver_type === "ORG_ADVISOR"
          ? (await queryOne(`SELECT 1 FROM org_advisors WHERE organization_id = $1 AND user_id = $2`, [booking.organization_id, user.id])) !== null
          : s.resolver_type === "PRODI_KAPRODI"
          ? (await queryOne(`SELECT 1 FROM organizations WHERE id = $1 AND prodi_id = $2`, [booking.organization_id, user.prodiId])) !== null
          : false),
    }))
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Tombol Navigasi Kembali */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition shadow-2xs"
        >
          <span>←</span>
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>

      {/* Main Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              {booking.created_by_role === "WADIR" || booking.created_by_role === "SUBBAG_UMUM" ? (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md tracking-wider flex items-center gap-1.5 flex-wrap">
                  <span>🏛️</span>
                  <span>Agenda Internal {booking.created_by_role === "WADIR" ? "Wakil Direktur" : "Subbagian Umum"}</span>
                  {booking.other_parties?.[0]?.name && (
                    <span className="text-purple-900 font-extrabold bg-purple-100/70 px-1.5 py-0.5 rounded text-[11px]">
                      {booking.other_parties[0].name}
                    </span>
                  )}
                  <span className="font-mono text-amber-700 font-semibold">(@{booking.created_by_username})</span>
                </span>
              ) : (
                <span className="text-xs font-bold text-blue-600 tracking-wider">
                  {booking.org_name} {booking.created_by_username && <span className="font-mono text-blue-500 font-semibold">(@{booking.created_by_username})</span>}
                </span>
              )}
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500">
                Diajukan: <strong className="text-slate-700">{fmtDateTime(booking.created_at)}</strong>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              {booking.title || "(Draft Pengajuan)"}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Fasilitas: <strong>{booking.facility_name}</strong> {booking.facility_location && `(${booking.facility_location})`}
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-2">
            <span
              className={`inline-block px-3 py-1 text-xs font-bold rounded-full border ${
                booking.status === "APPROVED"
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : booking.status === "PENDING"
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : booking.status === "REJECTED"
                  ? "bg-rose-100 text-rose-800 border-rose-300"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {BOOKING_STATUS_LABEL[booking.status] || booking.status}
            </span>

            {/* Link ke SBA: HANYA muncul jika acara telah selesai dilaksanakan (COMPLETED atau waktu acara telah lewat) */}
            {((booking.status === "APPROVED" && new Date(booking.event_end) <= new Date()) || booking.status === "COMPLETED") && (
              <Link
                href={`/dashboard/sba/${booking.id}`}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-lg"
              >
                {sbaReport ? `Lihat SBA (${sbaReport.status}) →` : "Isi Laporan SBA →"}
              </Link>
            )}
          </div>
        </div>

        {/* Landscape Facility Banner */}
        {(() => {
          const imgMeta = getFacilityImage(booking.facility_name);
          return (
            <div className="relative w-full h-44 sm:h-56 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 group shadow-2xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgMeta.imageUrl}
                alt={booking.facility_name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex flex-col justify-end p-5">
                <span className="w-fit px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                  🏛️ {imgMeta.badge}
                </span>
                <h3 className="text-white font-extrabold text-lg sm:text-xl">
                  {booking.facility_name}
                </h3>
                <p className="text-slate-300 text-xs mt-0.5">
                  📍 {booking.facility_location || "Politeknik Negeri Media Kreatif Jakarta"}
                </p>
              </div>
            </div>
          );
        })()}

        {/* Banner Peminjaman Disetujui (ACC Resmi) & Status Pelaksanaan / Form SBA */}
        {booking.status === "APPROVED" && (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 sm:p-5 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shrink-0">
              ✓
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-emerald-950">
                  {new Date(booking.event_end) > new Date()
                    ? "Pengajuan Peminjaman Disetujui Resmi (Terkonfirmasi)"
                    : "Acara Telah Berlangsung — Formulir SBA Terbuka"}
                </h4>
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 w-fit">
                  {new Date(booking.event_end) > new Date() ? "Menunggu Hari Pelaksanaan" : "Tahap Laporan SBA"}
                </span>
              </div>

              {new Date(booking.event_end) > new Date() ? (
                <p className="text-xs text-emerald-900 leading-relaxed">
                  Pengajuan ini telah disetujui penuh oleh seluruh pihak berwenang dan jadwal telah dikunci resmi di kalender kampus. Pengajuan akan tetap berada di daftar pemantauan hingga hari acara selesai, lalu formulir Surat Bukti Acara (SBA) akan terbuka secara otomatis.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    Waktu acara telah selesai berlangsung. Organisasi pemohon sekarang dapat mengisi dan menyerahkan <strong>Surat Bukti Acara (SBA)</strong> untuk serah terima kondisi fasilitas dan barang inventaris.
                  </p>
                  <Link
                    href={`/dashboard/sba/${booking.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg transition shadow-xs"
                  >
                    <span>📋</span>
                    <span>{sbaReport ? `Buka Laporan SBA (${sbaReport.status}) →` : "Buka & Isi Formulir SBA Sekarang →"}</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Banner Permintaan Revisi */}
        {booking.status === "REVISION" && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 sm:p-5 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-lg shrink-0">
              ⚠️
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-950">Pengajuan Memerlukan Revisi</h4>
                <span className="text-[11px] font-bold bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-md">
                  PERLU REVISI
                </span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed bg-white/80 p-3 rounded-lg border border-amber-200">
                <strong>Catatan / Arahan Revisi Peninjau:</strong> {booking.decision_note || "Silakan perbaiki data penyampaian proposal sesuai arahan peninjau."}
              </p>
              <p className="text-[11px] text-amber-800 italic">
                *Slot jadwal fasilitas tetap terjaga. Organisasi pemohon dapat memperbaiki data formulir dan mengirimkan ulang hasil revisi pada panel tindakan di bawah.
              </p>
            </div>
          </div>
        )}

        {/* Banner Penjelasan Pembatalan / Penarikan Pengajuan */}
        {booking.status === "CANCELLED" && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 sm:p-5 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-lg shrink-0">
              🛑
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-rose-900">Pengajuan Ini Telah Dibatalkan / Ditarik</h4>
                {booking.cancelled_at && (
                  <span className="text-[11px] text-rose-700 bg-rose-100/70 px-2 py-0.5 rounded-md font-medium">
                    {fmtDateTime(booking.cancelled_at)}
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-800 leading-relaxed">
                <strong>Alasan Pembatalan:</strong> {booking.cancel_reason || "Ditarik oleh organisasi pemohon."}
              </p>
              <p className="text-[11px] text-rose-600 italic">
                *Slot jadwal fasilitas telah dilepas dan proses persetujuan resmi telah dihentikan.
              </p>
            </div>
          </div>
        )}

        {/* Banner Penolakan */}
        {booking.status === "REJECTED" && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 sm:p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-lg shrink-0">
                ✕
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-rose-900">Pengajuan Peminjaman Ditolak</h4>
                <p className="text-xs text-rose-800 leading-relaxed">
                  <strong>Catatan / Alasan Penolakan:</strong> {booking.decision_note || "Tidak disetujui oleh pihak berwenang."}
                </p>
              </div>
            </div>

            {isOwnerOrg && (
              <MarkReadArchiveButton
                bookingId={booking.id}
                isArchived={Boolean(booking.archived_at)}
              />
            )}
          </div>
        )}

        {/* Panel Aksi Interaktif */}
        <BookingActionPanel
          booking={booking}
          steps={steps}
          user={user}
          changeRequests={changeRequests}
          items={items}
        />
      </div>

      {/* Riwayat Perubahan Jadwal & Pembatalan */}
      {changeRequests.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <span className="text-lg">📅</span>
              <h3 className="font-bold text-slate-900 text-base">
                Riwayat Perubahan Jadwal (Reschedule) & Pembatalan
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {changeRequests.length} Riwayat Tercatat
            </span>
          </div>

          <div className="space-y-4">
            {changeRequests.map((cr: any) => (
              <div
                key={cr.id}
                className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                  cr.status === "APPROVED"
                    ? "bg-emerald-50/60 border-emerald-200 text-slate-800"
                    : cr.status === "REJECTED"
                    ? "bg-rose-50/60 border-rose-200 text-slate-800"
                    : "bg-amber-50/60 border-amber-200 text-slate-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">
                    {cr.type === "RESCHEDULE" ? "🔄 Perubahan Jadwal (Reschedule)" : "🛑 Permohonan Pembatalan"}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full font-bold text-xs ${
                      cr.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : cr.status === "REJECTED"
                        ? "bg-rose-100 text-rose-800 border border-rose-300"
                        : "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                    }`}
                  >
                    {cr.status === "APPROVED" ? "Disetujui" : cr.status === "REJECTED" ? "Ditolak" : "Menunggu Keputusan"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white/90 p-3.5 rounded-xl border border-slate-200/60 shadow-2xs">
                  {cr.type === "RESCHEDULE" && (
                    <>
                      <div>
                        <span className="text-slate-500 font-semibold block mb-0.5">Jadwal Penggunaan Semula:</span>
                        <div className="font-mono text-slate-500 line-through">
                          {fmtRange(cr.old_usage_start, cr.old_usage_end)}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block mb-0.5">Jadwal Penggunaan Baru:</span>
                        <div className="font-mono font-bold text-emerald-700">
                          {fmtRange(cr.new_usage_start, cr.new_usage_end)}
                        </div>
                      </div>
                    </>
                  )}
                  <div className="sm:col-span-2 pt-1 border-t border-slate-100">
                    <span className="text-slate-500 font-semibold block mb-0.5">Alasan Pengajuan:</span>
                    <p className="italic text-slate-800 font-medium bg-slate-50 p-2 rounded-lg border border-slate-200">
                      "{cr.reason}"
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/40 gap-1">
                  <span>
                    Diajukan oleh: <strong>{cr.requested_by_name || "Organisasi"}</strong> • {fmtDateTime(cr.requested_at)}
                  </span>
                  {cr.decided_at && (
                    <span className="font-medium text-slate-700">
                      Diputuskan oleh: <strong className="text-purple-700">{cr.decided_by_name || "Pihak Berwenang"}</strong> • {fmtDateTime(cr.decided_at)}
                      {cr.decision_note && ` (Catatan: "${cr.decision_note}")`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alur Persetujuan & Tanda Tangan */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
        <h3 className="font-bold text-slate-900 text-base mb-4">
          Alur Persetujuan & Penandatanganan
        </h3>

        {steps.length === 0 ? (
          <p className="text-xs text-slate-400">
            Alur persetujuan akan diaktifkan secara otomatis begitu formulir draft dikirim.
          </p>
        ) : (
          <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
            {steps.map((st, idx) => {
              const isDone = st.status === "FORWARDED" || st.status === "APPROVED";
              const isCurrent = booking.status !== "CANCELLED" && st.status === "PENDING";
              const isRejected = st.status === "REJECTED";
              const isSkippedOrStopped = booking.status === "CANCELLED" && (st.status === "PENDING" || st.status === "WAITING" || st.status === "SKIPPED");

              return (
                <div key={st.id} className="relative pl-6">
                  {/* Bulatan timeline */}
                  <span
                    className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 bg-white ${
                      isDone
                        ? "border-emerald-600 bg-emerald-600"
                        : isCurrent
                        ? "border-amber-500 bg-amber-500 animate-pulse"
                        : isRejected
                        ? "border-rose-600 bg-rose-600"
                        : isSkippedOrStopped
                        ? "border-slate-300 bg-slate-200"
                        : "border-slate-300 bg-slate-100"
                    }`}
                  ></span>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div>
                      <div className={`font-bold text-sm ${isSkippedOrStopped ? "text-slate-500 line-through" : "text-slate-900"}`}>
                        {st.step_order}. {st.label}
                      </div>
                      <div className="text-xs text-slate-500">
                        Status:{" "}
                        <strong className="text-slate-700">
                          {isSkippedOrStopped
                            ? "Dihentikan (Pengajuan Dibatalkan)"
                            : STEP_STATUS_LABEL[st.status] || st.status}
                        </strong>
                        {st.acted_by_name && ` • Oleh: ${st.acted_by_name}`}
                        {st.acted_at && ` • ${fmtDateTime(st.acted_at)}`}
                      </div>
                    </div>
                  </div>

                  {st.note && (
                    <div className="mt-2 text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700">
                      <strong>Catatan:</strong> {st.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rincian Formulir Peminjaman */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-2">
          Detail Pengajuan Peminjaman
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
          <div>
            <span className="font-semibold text-slate-500 block">Waktu Penggunaan Fasilitas (Kunci Jadwal)</span>
            <span className="font-medium text-slate-800">{fmtRange(booking.usage_start, booking.usage_end)}</span>
          </div>

          <div>
            <span className="font-semibold text-slate-500 block">Waktu Pelaksanaan Acara Resmi (Publik)</span>
            <span className="font-medium text-slate-800">{fmtRange(booking.event_start, booking.event_end)}</span>
          </div>

          <div className="md:col-span-2">
            <span className="font-semibold text-slate-500 block">Perihal / Tujuan</span>
            <span className="text-slate-800">{booking.purpose || "-"}</span>
          </div>

          <div className="md:col-span-2">
            <span className="font-semibold text-slate-500 block">Deskripsi Kegiatan</span>
            <p className="text-slate-800 whitespace-pre-line leading-relaxed">{booking.description || "-"}</p>
          </div>

          {booking.created_by_role === "WADIR" || booking.created_by_role === "SUBBAG_UMUM" ? (
            <div className="md:col-span-2">
              <span className="font-semibold text-slate-500 block">Delegasi / Penyelenggara Acara</span>
              <span className="text-slate-900 font-bold text-sm">
                {booking.other_parties?.[0]?.name || "Acara PoliMedia"}
              </span>
            </div>
          ) : (
            <>
              <div>
                <span className="font-semibold text-slate-500 block">Ketua Organisasi</span>
                <span className="text-slate-800 font-medium">
                  {booking.chair_name || "-"} {booking.chair_contact && `(${booking.chair_contact})`}
                </span>
              </div>

              <div>
                <span className="font-semibold text-slate-500 block">Ketua Pelaksana</span>
                <span className="text-slate-800 font-medium">
                  {booking.lead_name || "-"} {booking.lead_contact && `(${booking.lead_contact})`}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Susunan Panitia Pelaksana */}
        {Array.isArray(booking.committee) && booking.committee.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider mb-3">
              👥 Susunan Panitia Pelaksana
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="py-2 px-3">Nama Lengkap</th>
                    <th className="py-2 px-3">Divisi / Seksi</th>
                    <th className="py-2 px-3">NIM</th>
                    <th className="py-2 px-3">Program Studi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {booking.committee.map((c: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2 px-3 font-medium text-slate-800">{c.name}</td>
                      <td className="py-2 px-3 text-slate-600 font-medium">{c.division || c.position || "-"}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{c.nim || "-"}</td>
                      <td className="py-2 px-3 text-slate-600">{c.prodi || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Susunan Kegiatan / Rundown */}
        {Array.isArray(booking.rundown) && booking.rundown.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider mb-3">
              ⏱️ Susunan Kegiatan (Rundown Acara)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="py-2 px-3">Nama Kegiatan / Sesi</th>
                    <th className="py-2 px-3">Waktu</th>
                    <th className="py-2 px-3">Penanggung Jawab (PIC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {booking.rundown.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2 px-3 font-medium text-slate-800">{r.agenda}</td>
                      <td className="py-2 px-3 text-slate-600">{r.time || "-"}</td>
                      <td className="py-2 px-3 text-slate-600">{r.pic || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Barang / Sarana yang Diperlukan */}
        {items.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <h4 className="font-semibold text-slate-800 text-xs uppercase tracking-wider mb-3">
              📦 Daftar Barang / Sarana Fasilitas yang Dipinjam
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="py-2 px-3">Nama Sarana</th>
                    <th className="py-2 px-3">Jumlah Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2 px-3 font-medium text-slate-800">{it.name}</td>
                      <td className="py-2 px-3 font-bold text-blue-700">{it.quantity} Unit</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

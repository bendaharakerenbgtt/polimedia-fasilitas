"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  submitBookingAction,
  withdrawBookingAction,
  actOnBookingAction,
  requestChangeAction,
  decideChangeAction,
} from "@/app/actions/bookings";
import { fmtRange, isWithinOperationalHours } from "@/lib/time";

export default function BookingActionPanel({
  booking,
  steps,
  user,
  changeRequests,
  items,
}: {
  booking: any;
  steps: any[];
  user: any;
  changeRequests: any[];
  items?: any[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form input states
  const [forwardNote, setForwardNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [changeReason, setChangeReason] = useState("");

  // Modern UI Modal States
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [changeDecisionModal, setChangeDecisionModal] = useState<{
    open: boolean;
    crId: string;
    approved: boolean;
    note: string;
  }>({ open: false, crId: "", approved: true, note: "" });

  const [newUsageStart, setNewUsageStart] = useState("");
  const [newEventStart, setNewEventStart] = useState("");
  const [newEventEnd, setNewEventEnd] = useState("");
  const [newUsageEnd, setNewUsageEnd] = useState("");

  // Cek apakah user punya hak tindak di step saat ini
  const activeStep = steps.find((s) => s.status === "PENDING");
  const isFinalStep = activeStep?.is_final ?? false;
  const isCurrentSignatory = Boolean(activeStep?.canAct);

  const isWadir = user.role === "WADIR";
  const isSubbag = user.role === "SUBBAG_UMUM";
  const isDecider = isWadir || isSubbag;
  const isOwnerOrg = user.role === "ORG" && user.organizationId === booking.organization_id;

  const pendingChange = changeRequests.find((cr) => cr.status === "PENDING");

  async function handleSubmitBooking() {
    setLoading(true);
    setError(null);
    const res = await submitBookingAction(booking.id);
    setLoading(false);
    setShowSubmitModal(false);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  async function handleWithdraw() {
    setLoading(true);
    setError(null);
    const res = await withdrawBookingAction(booking.id, withdrawReason.trim() || undefined);
    setLoading(false);
    setShowWithdrawModal(false);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  async function handleForward() {
    setLoading(true);
    setError(null);
    const res = await actOnBookingAction(booking.id, "FORWARD", forwardNote);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setForwardNote("");
      router.refresh();
    }
  }

  async function handleApproveFinal() {
    setLoading(true);
    setError(null);
    const res = await actOnBookingAction(booking.id, "APPROVE", forwardNote);
    setLoading(false);
    setShowApproveModal(false);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  async function handleRejectFinal() {
    if (!rejectNote.trim()) {
      alert("Alasan penolakan wajib diisi.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await actOnBookingAction(booking.id, "REJECT", rejectNote);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setShowRejectModal(false);
      router.refresh();
    }
  }

  async function handleRequestRevision() {
    if (!revisionNote.trim()) {
      alert("Catatan dan arahan revisi wajib diisi.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await actOnBookingAction(booking.id, "REQUEST_REVISION", revisionNote);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setShowRevisionModal(false);
      router.refresh();
    }
  }

  async function handleRequestCancel() {
    if (!changeReason.trim()) {
      alert("Alasan pembatalan wajib diisi.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await requestChangeAction(booking.id, {
      type: "CANCEL",
      reason: changeReason,
    });
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setShowCancelModal(false);
      router.refresh();
    }
  }

  async function handleRequestReschedule() {
    if (!changeReason.trim() || !newUsageStart || !newEventStart || !newEventEnd || !newUsageEnd) {
      alert("Semua data alasan dan jadwal baru wajib diisi.");
      return;
    }
    const opCheck = isWithinOperationalHours(newUsageStart, newUsageEnd);
    if (!opCheck.valid) {
      alert(opCheck.reason);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await requestChangeAction(booking.id, {
      type: "RESCHEDULE",
      reason: changeReason,
      newUsageStart,
      newEventStart,
      newEventEnd,
      newUsageEnd,
    });
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setShowRescheduleModal(false);
      router.refresh();
    }
  }

  async function handleConfirmDecideChange() {
    setLoading(true);
    setError(null);
    const res = await decideChangeAction(
      changeDecisionModal.crId,
      booking.id,
      changeDecisionModal.approved,
      changeDecisionModal.note
    );
    setLoading(false);
    setChangeDecisionModal({ open: false, crId: "", approved: true, note: "" });
    if (res.error) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Tindakan Pemohon: Draft Pengajuan */}
      {isOwnerOrg && booking.status === "DRAFT" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-blue-900">Formulir Masih Berstatus Draft</div>
            <p className="text-xs text-blue-700">
              Slot masih berstatus HOLD sementara. Anda dapat mengedit rincian formulir atau langsung mengirimkan pengajuan untuk memulai alur persetujuan.
            </p>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
            <Link
              href={`/dashboard/peminjaman/${booking.id}/edit`}
              className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-50 text-blue-700 font-semibold text-xs border border-blue-300 rounded-lg transition shadow-2xs text-center inline-flex items-center justify-center gap-1.5"
            >
              ✏️ Edit Draft
            </Link>
            <button
              onClick={() => setShowSubmitModal(true)}
              disabled={loading}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition shadow-xs disabled:opacity-50"
            >
              {loading ? "Mengirim..." : "Kirim Pengajuan →"}
            </button>
          </div>
        </div>
      )}

      {/* Tindakan Pemohon: Penarikan Pengajuan Pending (K4) */}
      {isOwnerOrg && booking.status === "PENDING" && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              setWithdrawReason("");
              setShowWithdrawModal(true);
            }}
            disabled={loading}
            className="text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg transition"
          >
            Tarik Pengajuan Peminjaman Ini
          </button>
        </div>
      )}

      {/* Tindakan Pejabat Jalur: Hanya tampil jika user adalah penanda tangan di tahap aktif saat ini */}
      {isCurrentSignatory && booking.status === "PENDING" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Tindakan Diperlukan
              </span>
              <h4 className="text-sm font-extrabold text-slate-900">
                Tahap Aktif: {activeStep?.label || "Persetujuan / Validasi"}
              </h4>
            </div>
            {isFinalStep ? (
              <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md">
                Tahap Akhir (Keputusan Final)
              </span>
            ) : (
              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-md">
                Verifikasi & Teruskan
              </span>
            )}
          </div>

          {/* Ringkasan Barang, Panitia, dan Rundown untuk Peninjau */}
          <div className="bg-white rounded-xl border border-amber-200/80 p-3.5 space-y-3 text-xs shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="font-bold text-slate-800">
                Rincian Informasi Pengajuan:
              </span>
              <span className="text-[11px] text-slate-500">
                Tinjau kelengkapan sebelum menyetujui
              </span>
            </div>

            {/* 1. Barang */}
            <div>
              <span className="font-bold text-slate-700 block mb-1">
                Daftar Barang & Sarana Dipinjam:
              </span>
              {items && items.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {items.map((it: any) => (
                    <span
                      key={it.id}
                      className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded text-[11px] font-medium"
                    >
                      <span>{it.name}:</span>
                      <strong className="font-bold">{it.quantity} unit</strong>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">Tidak ada peminjaman barang tambahan.</p>
              )}
            </div>

            {/* 2. Panitia */}
            <div>
              <span className="font-bold text-slate-700 block mb-1">
                Susunan Panitia ({Array.isArray(booking.committee) ? booking.committee.length : 0} Orang):
              </span>
              {Array.isArray(booking.committee) && booking.committee.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {booking.committee.map((c: any, idx: number) => (
                    <span
                      key={idx}
                      className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded text-[11px]"
                    >
                      <strong className="font-medium">{c.name}</strong>
                      {c.nim && <span className="font-mono text-[10px] text-emerald-600"> ({c.nim})</span>}
                      {c.prodi && <span className="text-[10px] text-emerald-700"> • {c.prodi}</span>}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">Belum ada daftar panitia pelaksana terlampir.</p>
              )}
            </div>

            {/* 3. Rundown */}
            <div>
              <span className="font-bold text-slate-700 block mb-1">
                Susunan Rundown Acara ({Array.isArray(booking.rundown) ? booking.rundown.length : 0} Sesi):
              </span>
              {Array.isArray(booking.rundown) && booking.rundown.length > 0 ? (
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {booking.rundown.map((r: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 px-2.5 py-1 rounded text-[11px]"
                    >
                      <span className="font-medium text-slate-800">{r.agenda}</span>
                      <div className="flex items-center gap-2 text-slate-500 font-mono text-[10px]">
                        {r.time && <span>{r.time}</span>}
                        {r.pic && <span className="font-sans text-slate-600">PIC: {r.pic}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 italic">Belum ada rundown acara terlampir.</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan / Arahan (Opsional):
            </label>
            <input
              type="text"
              value={forwardNote}
              onChange={(e) => setForwardNote(e.target.value)}
              placeholder="Berikan catatan bila diperlukan..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-amber-200/60">
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={loading}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
            >
              Tolak Permanen
            </button>

            <button
              onClick={() => setShowRevisionModal(true)}
              disabled={loading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 text-xs font-bold rounded-lg transition disabled:opacity-50 shadow-2xs"
            >
              Kembalikan untuk Revisi
            </button>

            {!isFinalStep ? (
              <button
                onClick={handleForward}
                disabled={loading}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
              >
                Tanda Tangani & Teruskan ke Tahap Berikutnya →
              </button>
            ) : (
              <button
                onClick={() => setShowApproveModal(true)}
                disabled={loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 shadow-xs"
              >
                Setujui Peminjaman (Final)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tindakan Organisasi Pemohon saat Pengajuan Perlu Revisi */}
      {isOwnerOrg && booking.status === "REVISION" && (
        <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-2xs">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Tindakan Organisasi Pemohon
            </span>
            <h4 className="text-sm font-extrabold text-slate-900 mt-0.5">
              Perbaiki & Kirim Ulang Formulir Pengajuan
            </h4>
            <p className="text-xs text-slate-600 mt-1">
              Perbaiki data formulir peminjaman, rincian barang, rundown, atau susunan panitia sesuai catatan revisi peninjau sebelum dikirim ulang.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href={`/dashboard/peminjaman/${booking.id}/edit`}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs inline-flex items-center gap-1.5"
            >
              ✏️ Edit Formulir
            </Link>
            <button
              onClick={handleSubmitBooking}
              disabled={loading}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {loading ? "Mengirim..." : "Kirim Ulang →"}
            </button>
          </div>
        </div>
      )}

      {/* Tindakan Pembatalan / Reschedule untuk Booking APPROVED */}
      {isOwnerOrg && booking.status === "APPROVED" && !pendingChange && (
        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={() => setShowCancelModal(true)}
            className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 px-3.5 py-2 rounded-lg hover:bg-rose-100 transition"
          >
            Ajukan Pembatalan Peminjaman
          </button>
          <button
            onClick={() => setShowRescheduleModal(true)}
            className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-3.5 py-2 rounded-lg hover:bg-blue-100 transition"
          >
            Ajukan Perubahan Jadwal (Reschedule)
          </button>
        </div>
      )}

      {/* Banner Permohonan Perubahan Pending untuk Wadir & Subbag */}
      {pendingChange && (
        <div className="bg-purple-50 border-2 border-purple-300 rounded-xl p-5 space-y-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-base">⚠️</span>
              <span className="text-xs font-bold text-purple-950">
                Permohonan {pendingChange.type === "CANCEL" ? "Pembatalan Peminjaman" : "Perubahan Jadwal (Reschedule)"} Menunggu Keputusan
              </span>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-200 text-purple-900 font-bold animate-pulse">
              PENDING
            </span>
          </div>

          <div className="bg-white/80 p-3.5 rounded-xl border border-purple-200/60 text-xs space-y-2 text-slate-800">
            {pendingChange.type === "RESCHEDULE" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 font-medium block">Jadwal Penggunaan Semula:</span>
                  <div className="font-mono text-slate-500 line-through">
                    {fmtRange(pendingChange.old_usage_start, pendingChange.old_usage_end)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Jadwal Penggunaan Baru yang Diajukan:</span>
                  <div className="font-mono font-bold text-emerald-700">
                    {fmtRange(pendingChange.new_usage_start, pendingChange.new_usage_end)}
                  </div>
                </div>
              </div>
            )}
            <div>
              <span className="text-slate-500 font-medium block">Alasan Permohonan:</span>
              <p className="italic font-medium text-slate-800 bg-purple-100/40 p-2 rounded-lg border border-purple-200/50">
                "{pendingChange.reason}"
              </p>
            </div>
          </div>

          {isDecider && (
            <div className="flex justify-end space-x-3 pt-1">
              <button
                onClick={() => setChangeDecisionModal({ open: true, crId: pendingChange.id, approved: false, note: "" })}
                disabled={loading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition shadow-xs"
              >
                Tolak Permohonan
              </button>
              <button
                onClick={() => setChangeDecisionModal({ open: true, crId: pendingChange.id, approved: true, note: "" })}
                disabled={loading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition shadow-xs"
              >
                Setujui Jadwal Baru
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal Kembalikan untuk Revisi */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg shrink-0">
                ⚠️
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Kembalikan untuk Revisi</h4>
                <p className="text-xs text-slate-500">Minta organisasi memperbaiki penyampaian proposal</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Catatan & Arahan Revisi (Wajib):
              </label>
              <textarea
                rows={3}
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                placeholder="Tuliskan dengan jelas apa saja yang perlu diperbaiki (misal: susunan rundown, kelengkapan panitia, rincian barang, dll)..."
                className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-amber-500 outline-none transition"
              ></textarea>
            </div>
            <p className="text-[11px] text-slate-500 italic">
              *Pengajuan akan dikembalikan ke pemohon untuk diperbaiki dan slot jadwal fasilitas tetap ditahan.
            </p>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowRevisionModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleRequestRevision}
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-500 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Memproses..." : "Kirim Arahan Revisi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tolak Peminjaman */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h4 className="font-bold text-slate-900 text-base">Alasan Penolakan Peminjaman</h4>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Tuliskan alasan penolakan secara jelas agar diketahui organisasi..."
              className="w-full p-3 border border-slate-300 rounded-lg text-xs"
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleRejectFinal}
                disabled={loading}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Permohonan Pembatalan */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h4 className="font-bold text-slate-900 text-base">Alasan Permohonan Pembatalan</h4>
            <textarea
              rows={3}
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Jelaskan alasan pembatalan kegiatan..."
              className="w-full p-3 border border-slate-300 rounded-lg text-xs"
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleRequestCancel}
                disabled={loading}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700"
              >
                Kirim Permohonan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Permohonan Reschedule */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h4 className="font-bold text-slate-900 text-base">Permohonan Perubahan Jadwal (Reschedule)</h4>
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
              Jam operasional perizinan fasilitas: <strong>06:00 – 18:30 WIB</strong> pada hari yang sama.
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alasan Perubahan:</label>
              <textarea
                rows={2}
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Alasan perubahan jadwal..."
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              ></textarea>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Mulai Penggunaan Baru:</label>
                <input
                  type="datetime-local"
                  value={newUsageStart}
                  onChange={(e) => setNewUsageStart(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Selesai Penggunaan Baru:</label>
                <input
                  type="datetime-local"
                  value={newUsageEnd}
                  onChange={(e) => setNewUsageEnd(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Mulai Acara Baru:</label>
                <input
                  type="datetime-local"
                  value={newEventStart}
                  onChange={(e) => setNewEventStart(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Selesai Acara Baru:</label>
                <input
                  type="datetime-local"
                  value={newEventEnd}
                  onChange={(e) => setNewEventEnd(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 rounded-lg"
              >
                Batal
              </button>
              <button
                onClick={handleRequestReschedule}
                disabled={loading}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Kirim Permohonan Reschedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modern: Konfirmasi Kirim Formulir Pengajuan (Submit Draft) */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                🚀
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Kirim Formulir Pengajuan?</h4>
                <p className="text-xs text-slate-500">Kunci slot jadwal fasilitas secara definitif</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              Setelah dikirim, status pengajuan berubah menjadi <strong>PENDING</strong> dan jadwal penggunaan fasilitas akan langsung dikunci agar tidak dapat dipinjam oleh pihak lain. Alur persetujuan pejabat akan langsung dimulai.
            </p>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowSubmitModal(false)}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl transition"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitBooking}
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50"
              >
                {loading ? "Mengirim..." : "Ya, Kirim Sekarang →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modern: Penarikan Pengajuan Peminjaman (Withdraw) */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-lg">
                ⚠️
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Tarik Pengajuan Peminjaman</h4>
                <p className="text-xs text-slate-500">Batalkan pengajuan sebelum diputuskan</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Alasan Penarikan Pengajuan (Opsional):
              </label>
              <textarea
                rows={3}
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="Contoh: Kesalahan pemilihan tanggal, permohonan diganti dengan agenda baru..."
                className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition"
              ></textarea>
            </div>
            <p className="text-[11px] text-slate-500 italic">
              *Setelah ditarik, slot jadwal fasilitas akan langsung dilepas dan tersedia kembali untuk organisasi lain.
            </p>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowWithdrawModal(false)}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl transition"
              >
                Kembali
              </button>
              <button
                onClick={handleWithdraw}
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs disabled:opacity-50"
              >
                {loading ? "Memproses..." : "Konfirmasi Tarik Pengajuan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modern: Persetujuan Peminjaman oleh Wadir / Subbag */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg">
                ✅
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Setujui Peminjaman Fasilitas</h4>
                <p className="text-xs text-slate-500">
                  {isSubbag
                    ? "Keputusan Subbagian Umum (Pengelola Fasilitas & Sarana)"
                    : "Keputusan Resmi Wakil Direktur Bidang Kemahasiswaan"}
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 bg-emerald-50/70 border border-emerald-200 p-3.5 rounded-xl leading-relaxed">
              Peminjaman akan berstatus <strong>APPROVED</strong>. Agenda acara akan langsung diterbitkan ke <strong>Portal Publik Kampus</strong> dan organisasi pemohon dapat menggunakan fasilitas sesuai jadwal.
            </p>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowApproveModal(false)}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl transition"
              >
                Batal
              </button>
              <button
                onClick={handleApproveFinal}
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-xs disabled:opacity-50"
              >
                {loading ? "Menyetujui..." : "Ya, Setujui Resmi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Modern: Keputusan Permohonan Pembatalan / Reschedule Wadir / Subbag */}
      {changeDecisionModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full space-y-4 shadow-2xl border border-slate-100">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                changeDecisionModal.approved ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
              }`}>
                {changeDecisionModal.approved ? "✓" : "✕"}
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">
                  {changeDecisionModal.approved ? "Setujui Permohonan Perubahan" : "Tolak Permohonan Perubahan"}
                </h4>
                <p className="text-xs text-slate-500">
                  {isSubbag ? "Konfirmasi keputusan Subbagian Umum" : "Konfirmasi keputusan Wakil Direktur"}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {changeDecisionModal.approved ? "Catatan Persetujuan (Opsional):" : "Alasan Penolakan Permohonan (Wajib):"}
              </label>
              <textarea
                rows={3}
                value={changeDecisionModal.note}
                onChange={(e) =>
                  setChangeDecisionModal({ ...changeDecisionModal, note: e.target.value })
                }
                placeholder={
                  changeDecisionModal.approved
                    ? "Berikan catatan atau instruksi tambahan..."
                    : "Jelaskan alasan penolakan permohonan ini..."
                }
                className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              ></textarea>
            </div>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setChangeDecisionModal({ open: false, crId: "", approved: true, note: "" })}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl transition"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDecideChange}
                disabled={loading}
                className={`px-5 py-2 text-xs font-bold text-white rounded-xl transition shadow-xs disabled:opacity-50 ${
                  changeDecisionModal.approved
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {loading ? "Memproses..." : changeDecisionModal.approved ? "Konfirmasi Setujui" : "Konfirmasi Tolak"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

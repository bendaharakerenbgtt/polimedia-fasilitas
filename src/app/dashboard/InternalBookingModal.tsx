"use client";

import { useState } from "react";
import { createInternalBookingAction } from "@/app/actions/bookings";
import type { Role } from "@/lib/roles";

export default function InternalBookingModal({
  userRole,
  facilities,
}: {
  userRole: Role;
  facilities: { id: string; name: string; category?: string; location?: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [facilityId, setFacilityId] = useState("");
  const [title, setTitle] = useState("");
  const [delegation, setDelegation] = useState("");
  const [description, setDescription] = useState("");

  const [date, setDate] = useState("");
  const [usageStartHour, setUsageStartHour] = useState("07:00");
  const [usageEndHour, setUsageEndHour] = useState("17:00");

  const isWadir = userRole === "WADIR";
  const isSubbag = userRole === "SUBBAG_UMUM";

  if (!isWadir && !isSubbag) return null;

  // Format tanggal ramah pengguna: "Jumat, 30 Okt 2026"
  function formatReadableDate(dateStr: string) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return "";
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    if (isNaN(dateObj.getTime())) return "";

    const fullDays = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${fullDays[dateObj.getDay()]}, ${d} ${months[m]} ${y}`;
  }

  // Format ringkasan waktu
  function getSchedulePreview() {
    if (!date) return null;
    const readableDate = formatReadableDate(date);
    return `${readableDate}, ${usageStartHour.replace(":", ".")} – ${usageEndHour.replace(":", ".")} WIB`;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!facilityId) {
      setError("Silakan pilih fasilitas yang akan digunakan.");
      return;
    }
    if (!title.trim()) {
      setError("Nama kegiatan wajib diisi.");
      return;
    }
    if (!date) {
      setError("Tanggal kegiatan wajib ditentukan.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("facilityId", facilityId);
    formData.append("title", title);
    formData.append("delegation", delegation.trim() || "Acara PoliMedia");
    formData.append("description", description);
    formData.append("usageStart", `${date}T${usageStartHour}`);
    formData.append("usageEnd", `${date}T${usageEndHour}`);

    try {
      const res = await createInternalBookingAction(null, formData);
      if (res && res.error) {
        setError(res.error);
        setLoading(false);
      }
    } catch (err: any) {
      if (err?.message === "NEXT_REDIRECT") throw err;
      setError(err?.message || "Terjadi kesalahan saat memproses pemakaian fasilitas.");
      setLoading(false);
    }
  }

  return (
    <>
      {/* Tombol Utama di Dashboard */}
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsOpen(true);
        }}
        className="px-5 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm rounded-xl transition shadow-md inline-flex items-center gap-2 cursor-pointer shrink-0"
      >
        <span>🏛️</span>
        <span>Pakai Fasilitas</span>
      </button>

      {/* Modal Cepat Pemakaian Fasilitas Internal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl border border-slate-100 my-8 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-start justify-between pb-3.5 border-b border-slate-100 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏛️</span>
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                    Pakai Fasilitas Kampus
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  {isWadir
                    ? "Formulir cepat pemakaian fasilitas oleh Wakil Direktur (diteruskan langsung ke Subbagian Umum untuk verifikasi)."
                    : "Formulir cepat pemakaian fasilitas oleh Subbagian Umum (otomatis disetujui tanpa perlu persetujuan lagi)."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-bold text-sm transition cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* 1. Nama Kegiatan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Kegiatan / Agenda *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Rapat Koordinasi Pimpinan, Sosialisasi Beasiswa, Ujian Masuk..."
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium text-xs outline-none"
                />
              </div>

              {/* 2. Delegasi / Penyelenggara (Opsional) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Delegasi / Penyelenggara Acara (Opsional)
                </label>
                <input
                  type="text"
                  value={delegation}
                  onChange={(e) => setDelegation(e.target.value)}
                  placeholder="Default: Acara PoliMedia (atau isi misal: LLDIKTI, Kemendikbudristek, Senat...)"
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium text-xs outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Opsional. Jika tidak diisi, otomatis ditampilkan sebagai <strong>&quot;Acara PoliMedia&quot;</strong> di portal publik.
                </p>
              </div>

              {/* 3. Deskripsi Kegiatan */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Deskripsi Kegiatan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keterangan singkat agenda atau catatan penggunaan fasilitas..."
                  className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-xs outline-none"
                ></textarea>
              </div>

              {/* 3. Pilihan Fasilitas */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Fasilitas yang Digunakan *
                </label>
                <select
                  required
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium text-xs outline-none"
                >
                  <option value="">-- Pilih Fasilitas Kampus --</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.location ? `(${f.location})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Tanggal & Jam Penggunaan */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Tanggal Kegiatan *</label>
                    {date && (
                      <span className="text-[11px] font-bold text-purple-900 bg-purple-100/70 px-2 py-0.5 rounded-md">
                        {formatReadableDate(date)}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 text-xs font-medium outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Jam Mulai *
                    </label>
                    <select
                      value={usageStartHour}
                      onChange={(e) => setUsageStartHour(e.target.value)}
                      className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-mono font-medium outline-none"
                    >
                      {["06:00", "07:00", "07:30", "08:00", "08:30", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00"].map((t) => (
                        <option key={t} value={t}>
                          {t} WIB
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Jam Selesai *
                    </label>
                    <select
                      value={usageEndHour}
                      onChange={(e) => setUsageEndHour(e.target.value)}
                      className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-mono font-medium outline-none"
                    >
                      {["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "17:30", "18:00", "18:30"].map((t) => (
                        <option key={t} value={t}>
                          {t} WIB
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {getSchedulePreview() && (
                  <div className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 flex items-center gap-1.5 font-medium">
                    <span>⏰</span>
                    <span>Waktu: <strong>{getSchedulePreview()}</strong></span>
                  </div>
                )}
              </div>

              {/* Keterangan Alur */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80 text-[11px] text-amber-900 space-y-1">
                <span className="font-bold block">💡 Info Alur Pemakaian Fasilitas:</span>
                {isWadir ? (
                  <p>
                    Penggunaan fasilitas ini diajukan oleh <strong>Wakil Direktur</strong> dan akan langsung diteruskan ke <strong>Subbagian Umum</strong> untuk konfirmasi fasilitas tanpa perlu persetujuan ormawa atau dosen.
                  </p>
                ) : (
                  <p>
                    Penggunaan fasilitas ini diajukan oleh <strong>Subbagian Umum</strong> (pengelola fasilitas) dan <strong>otomatis langsung disetujui (APPROVED)</strong> serta langsung terbit ke kalender & jadwal kampus.
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Memproses..." : isWadir ? "Kirim ke Subbag Umum" : "Pakai & Setujui Langsung"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { PetugasBooking } from "@/server/public";

interface Props {
  initialBookings: PetugasBooking[];
  facilities: { id: string; name: string }[];
}

export function PetugasPortalViewer({ initialBookings, facilities }: Props) {
  const [dateFilter, setDateFilter] = useState<"today" | "tomorrow" | "week" | "all">("today");
  const [selectedFacility, setSelectedFacility] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Live clock WIB
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }) +
          " • " +
          now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) +
          " WIB"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simpan checklist barang di localStorage per perangkat
  useEffect(() => {
    try {
      const saved = localStorage.getItem("polimedia_satpam_checked_items");
      if (saved) setCheckedItems(JSON.parse(saved));
    } catch (_) {}
  }, []);

  const toggleCheckItem = (itemId: string) => {
    setCheckedItems((prev) => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      try {
        localStorage.setItem("polimedia_satpam_checked_items", JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  // Helper format jam
  const fmtTimeRange = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const sTime = start.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const eTime = end.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const sDate = start.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
    return `${sDate}, ${sTime} – ${eTime} WIB`;
  };

  const getStatusBadge = (b: PetugasBooking) => {
    const now = new Date();
    const uStart = new Date(b.usageStart);
    const uEnd = new Date(b.usageEnd);

    if (now >= uStart && now <= uEnd) {
      return {
        label: "SEDANG BERLANGSUNG",
        bg: "bg-emerald-500 text-white animate-pulse",
        desc: "Ruangan & fasilitas sedang aktif digunakan",
      };
    } else if (now < uStart) {
      const isToday = uStart.toDateString() === now.toDateString();
      if (isToday) {
        return {
          label: "HARI INI (AKAN MULAI)",
          bg: "bg-amber-500 text-white",
          desc: "Siapkan pembukaan ruangan & serah terima barang",
        };
      }
      return {
        label: "TERJADWAL MENDATANG",
        bg: "bg-blue-600 text-white",
        desc: "Jadwal resmi telah disetujui",
      };
    } else {
      return {
        label: "SELESAI",
        bg: "bg-slate-400 text-white",
        desc: "Penggunaan fasilitas telah berakhir",
      };
    }
  };

  // Filter list
  const filteredBookings = useMemo(() => {
    const now = new Date();
    const todayStr = now.toDateString();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    const tomorrowStr = tomorrow.toDateString();

    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(now.getDate() + 7);

    return initialBookings.filter((b) => {
      const uStart = new Date(b.usageStart);
      const uEnd = new Date(b.usageEnd);

      // Filter tanggal
      if (dateFilter === "today") {
        const match =
          uStart.toDateString() === todayStr ||
          uEnd.toDateString() === todayStr ||
          (now >= uStart && now <= uEnd);
        if (!match) return false;
      } else if (dateFilter === "tomorrow") {
        if (uStart.toDateString() !== tomorrowStr && uEnd.toDateString() !== tomorrowStr) return false;
      } else if (dateFilter === "week") {
        if (uEnd < now || uStart > sevenDaysLater) return false;
      }

      // Filter Fasilitas
      if (selectedFacility !== "ALL" && b.facilityId !== selectedFacility) {
        return false;
      }

      // Filter Pencarian
      if (search.trim()) {
        const q = search.toLowerCase();
        const mTitle = b.title.toLowerCase().includes(q);
        const mCode = b.code.toLowerCase().includes(q);
        const mOrg = b.orgName.toLowerCase().includes(q);
        const mFac = b.facilityName.toLowerCase().includes(q);
        const mLead = (b.leadName || "").toLowerCase().includes(q);
        if (!mTitle && !mCode && !mOrg && !mFac && !mLead) return false;
      }

      return true;
    });
  }, [initialBookings, dateFilter, selectedFacility, search]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans print:bg-white print:text-black">
      {/* Header Khusus Satpam & Pengelola */}
      <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-xs border-b border-slate-800 print:relative print:bg-white print:text-black print:border-b-2 print:border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 text-white flex items-center justify-center font-bold text-xs shrink-0 print:border-black">
              POS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold leading-tight tracking-tight text-white">
                  Portal Petugas: Satpam & Tim Kebersihan (OB)
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-semibold rounded border border-slate-700 uppercase tracking-wider print:hidden">
                  Operasional Lapangan
                </span>
              </div>
              <p className="text-xs text-slate-400 print:text-slate-600">
                PoliMedia Jakarta • Jadwal Fasilitas Resmi, Kunci Ruangan, & Checklist Barang Inventaris
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            <div className="text-right">
              <span className="text-[11px] font-mono text-slate-300 font-bold block print:text-black">
                {currentTime || "Memuat waktu..."}
              </span>
              <span className="text-[10px] text-slate-400 hidden sm:block print:hidden">
                Zona Waktu Kampus (WIB)
              </span>
            </div>

            <Link
              href="/"
              className="text-xs text-slate-300 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 print:hidden transition"
            >
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </header>

      {/* Info Petugas Banner */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <span className="font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
              Instruksi Petugas
            </span>
            <span>
              Cocokkan izin kode peminjaman, pastikan jam buka-tutup ruangan sesuai jadwal penggunaan, dan lakukan checklist fisik sarana barang sebelum serta sesudah acara.
            </span>
          </div>
          <div className="text-[11px] text-slate-500 shrink-0 font-medium">
            Hanya menampilkan kegiatan yang telah disetujui resmi (APPROVED)
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Controls Bar: Filter & Pencarian */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Tab Filter Tanggal */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                onClick={() => setDateFilter("today")}
                className={`px-3 py-1.5 rounded-md font-bold transition ${
                  dateFilter === "today"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Hari Ini
              </button>
              <button
                onClick={() => setDateFilter("tomorrow")}
                className={`px-3 py-1.5 rounded-md font-bold transition ${
                  dateFilter === "tomorrow"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Besok
              </button>
              <button
                onClick={() => setDateFilter("week")}
                className={`px-3 py-1.5 rounded-md font-bold transition ${
                  dateFilter === "week"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                7 Hari Kedepan
              </button>
              <button
                onClick={() => setDateFilter("all")}
                className={`px-3 py-1.5 rounded-md font-bold transition ${
                  dateFilter === "all"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semua Jadwal
              </button>
            </div>

            {/* Filter Fasilitas */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600 hidden sm:inline">Lokasi:</label>
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-1 focus:ring-slate-500"
              >
                <option value="ALL">Semua Fasilitas / Ruangan</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Kolom Pencarian */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode (PJM-...), nama acara, ormawa, ruangan, atau nama PIC..."
              className="w-full pl-3.5 pr-16 py-2 border border-slate-300 rounded-lg text-xs sm:text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:ring-1 focus:ring-slate-500 focus:border-slate-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-2 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Ringkasan Jumlah */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Menampilkan <strong>{filteredBookings.length}</strong> kegiatan resmi
          </span>
          <span className="font-semibold text-slate-600">
            {dateFilter === "today"
              ? "Jadwal Hari Ini"
              : dateFilter === "tomorrow"
              ? "Jadwal Besok"
              : dateFilter === "week"
              ? "Jadwal 7 Hari Kedepan"
              : "Semua Jadwal Terdaftar"}
          </span>
        </div>

        {/* Daftar Kegiatan */}
        {filteredBookings.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 shadow-2xs space-y-2.5">
            <p className="text-sm font-bold text-slate-800">
              Tidak ada jadwal kegiatan {dateFilter === "today" ? "hari ini" : "yang cocok"}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Tidak ada kegiatan yang disetujui untuk filter yang dipilih. Silakan pilih tab tanggal lain.
            </p>
            <button
              onClick={() => {
                setDateFilter("all");
                setSelectedFacility("ALL");
                setSearch("");
              }}
              className="text-xs font-semibold text-blue-600 hover:underline pt-1 inline-block"
            >
              Tampilkan Semua Jadwal Kegiatan
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredBookings.map((b) => {
              const status = getStatusBadge(b);
              const isExpanded = expandedBooking === b.id;
              const hasItems = b.items && b.items.length > 0;
              const hasRundown = b.rundown && b.rundown.length > 0;
              const hasCommittee = b.committee && b.committee.length > 0;

              return (
                <div
                  key={b.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition space-y-4 print:border-black print:p-4 print:shadow-none"
                >
                  {/* Baris Atas: Kode, Status & Ormawa */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-slate-900 text-white px-2.5 py-1 rounded-md print:border print:border-black print:text-black print:bg-white">
                        {b.code}
                      </span>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${status.bg} print:text-black print:bg-white print:border print:border-black`}>
                        {status.label}
                      </span>
                      <span className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md print:border-black">
                        {b.orgName} ({b.orgType})
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                        Izin Resmi Disahkan Pimpinan
                      </span>
                    </div>
                  </div>

                  {/* Judul Kegiatan & Lokasi */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-1.5">
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                        {b.title}
                      </h3>
                      {b.purpose && (
                        <p className="text-xs text-slate-600">
                          <strong>Perihal:</strong> {b.purpose}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-slate-700 font-medium pt-1">
                        <strong className="text-slate-900">{b.facilityName}</strong>
                        {b.facilityLocation && (
                          <span className="text-slate-500">({b.facilityLocation})</span>
                        )}
                      </div>
                    </div>

                    {/* Kontak PIC Lapangan */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                      <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                        Kontak PIC & Koordinasi Satpam:
                      </span>
                      <div className="space-y-1">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Ketua Pelaksana:</span>
                          <span className="font-bold text-slate-900">{b.leadName || "-"}</span>
                          {b.leadContact && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-slate-700">{b.leadContact}</span>
                              <a
                                href={`https://wa.me/${b.leadContact.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-[10px] font-bold transition print:hidden"
                              >
                                Chat WhatsApp
                              </a>
                            </div>
                          )}
                        </div>

                        {b.chairName && (
                          <div className="pt-1 border-t border-slate-200/60">
                            <span className="text-slate-500 text-[11px] block">Ketua Organisasi:</span>
                            <span className="font-medium text-slate-800">{b.chairName}</span>
                            {b.chairContact && (
                              <span className="font-mono text-slate-600 ml-1.5">({b.chairContact})</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Kotak Jam Operasional Buka-Tutup Ruangan */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                    <div>
                      <span className="text-[11px] font-bold text-slate-800 block">
                        WAKTU PENGGUNAAN RUANGAN (BUKA & KUNCI PINTU):
                      </span>
                      <span className="font-extrabold text-slate-900 text-sm block mt-0.5 font-mono">
                        {fmtTimeRange(b.usageStart, b.usageEnd)}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        *Satpam membuka ruangan saat jam mulai dan mengunci kembali setelah jam selesai.
                      </span>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold text-slate-800 block">
                        WAKTU PELAKSANAAN ACARA INTI (PUBLIK):
                      </span>
                      <span className="font-bold text-slate-900 text-sm block mt-0.5 font-mono">
                        {fmtTimeRange(b.eventStart, b.eventEnd)}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        *Waktu sesi acara utama bagi peserta mahasiswa / umum.
                      </span>
                    </div>
                  </div>

                  {/* KOTAK CHECKLIST INVENTARIS BARANG FASILITAS */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wide">
                        Checklist Sarana Barang yang Dipinjam ({b.items.length} Jenis Sarana)
                      </h4>
                      <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                        Centang fisik untuk serah terima barang
                      </span>
                    </div>

                    {hasItems ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {b.items.map((item) => {
                          const checkKey = `${b.id}_${item.id}`;
                          const isChecked = !!checkedItems[checkKey];

                          return (
                            <div
                              key={item.id}
                              onClick={() => toggleCheckItem(checkKey)}
                              className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2 shadow-2xs select-none ${
                                isChecked
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                                  : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                              }`}
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs truncate">{item.name}</span>
                                </div>
                                <div className="text-[11px] text-slate-700 font-bold">
                                  {item.quantity} Unit
                                </div>
                                {item.notes && (
                                  <span className="text-[10px] text-slate-500 truncate block">
                                    Ket: {item.notes}
                                  </span>
                                )}
                              </div>

                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // handled by div
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 shrink-0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3 bg-white border border-dashed border-slate-200 rounded-lg text-xs text-slate-500 italic text-center">
                        Tidak ada barang tambahan yang dipinjam (hanya pemakaian ruangan dasar).
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>
                        *Centang di layar tersimpan di perangkat ini untuk membantu pengecekan Satpam/OB posko.
                      </span>
                      {hasItems && (
                        <span className="font-bold text-slate-700">
                          Total Checklist:{" "}
                          {b.items.filter((it) => checkedItems[`${b.id}_${it.id}`]).length} /{" "}
                          {b.items.length} Selesai
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tombol Buka Rincian Rundown & Panitia */}
                  <div className="pt-1 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-100">
                    <button
                      onClick={() => setExpandedBooking(isExpanded ? null : b.id)}
                      className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1.5 transition py-1"
                    >
                      <span>{isExpanded ? "Sembunyikan" : "Lihat"} Rundown Acara & Daftar Panitia</span>
                    </button>

                    <div className="text-[11px] text-slate-400">
                      Izin diterbitkan resmi • PoliMedia Jakarta
                    </div>
                  </div>

                  {/* Detail Tambahan: Rundown & Panitia (Expanded) */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-200 space-y-4 animate-in fade-in duration-200">
                      {/* Rundown Acara */}
                      <div>
                        <h5 className="font-bold text-slate-800 text-xs mb-2">
                          Susunan Rundown Acara ({b.rundown.length} Sesi):
                        </h5>
                        {hasRundown ? (
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {b.rundown.map((r, idx) => (
                              <div
                                key={idx}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs flex items-center justify-between gap-2"
                              >
                                <span className="font-medium text-slate-900">{r.agenda}</span>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                                  {r.time && <span>{r.time}</span>}
                                  {r.pic && <span className="font-sans text-slate-700">PIC: {r.pic}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Rundown tidak dilampirkan.</p>
                        )}
                      </div>

                      {/* Panitia Pelaksana */}
                      <div>
                        <h5 className="font-bold text-slate-800 text-xs mb-2">
                          Panitia Pelaksana yang Berhak di Lokasi ({b.committee.length} Orang):
                        </h5>
                        {hasCommittee ? (
                          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                            {b.committee.map((c, idx) => (
                              <span
                                key={idx}
                                className="bg-slate-100 border border-slate-200 text-slate-800 px-2 py-0.5 rounded text-[11px]"
                              >
                                <strong>{c.name}</strong>
                                {c.nim && <span className="font-mono text-slate-600"> ({c.nim})</span>}
                                {c.prodi && <span> • {c.prodi}</span>}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Daftar panitia tidak dilampirkan.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 print:hidden">
        <p>© 2026 Politeknik Negeri Media Kreatif (PoliMedia) • Portal Operasional Lapangan Satpam & Tim Kebersihan (OB)</p>
      </footer>
    </div>
  );
}

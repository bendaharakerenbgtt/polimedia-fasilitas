"use client";

import { useState } from "react";
import Link from "next/link";
import { fmtDateTime, fmtRange, fmtTime } from "@/lib/time";
import type { CampusCalendarEvent } from "@/server/bookings";

export default function CampusCalendarViewer({
  events,
  facilities,
}: {
  events: CampusCalendarEvent[];
  facilities: { id: string; name: string; category: string }[];
}) {
  const [viewMode, setViewMode] = useState<"MONTH" | "LIST">("MONTH");
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>("ALL");
  const [selectedOrgType, setSelectedOrgType] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Bulan aktif kalender: Default adalah bulan ini
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed

  // Modal Detail Acara
  const [selectedEvent, setSelectedEvent] = useState<CampusCalendarEvent | null>(null);

  // Filter events
  const filteredEvents = events.filter((ev) => {
    const matchFacility = selectedFacilityId === "ALL" || ev.facilityId === selectedFacilityId;
    const matchOrgType = selectedOrgType === "ALL" || ev.orgType === selectedOrgType;
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm ||
      ev.title.toLowerCase().includes(q) ||
      ev.orgName.toLowerCase().includes(q) ||
      ev.facilityName.toLowerCase().includes(q) ||
      ev.code.toLowerCase().includes(q);

    return matchFacility && matchOrgType && matchSearch;
  });

  // Nama bulan bahasa Indonesia
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  // Helper navigasi bulan
  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function resetToThisMonth() {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  }

  // Hitung matriks hari dalam bulan aktif
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Minggu
  // Konversi ke hari Senin sebagai hari pertama (0 = Sen, 6 = Min)
  const startOffset = (firstDayOfMonth + 6) % 7;
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Array kotak kalender
  const calendarDays: { dayNumber: number | null; dateStr: string }[] = [];
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push({ dayNumber: null, dateStr: "" });
  }
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const mm = String(currentMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    calendarDays.push({
      dayNumber: d,
      dateStr: `${currentYear}-${mm}-${dd}`,
    });
  }

  // Map events per dateStr (YYYY-MM-DD)
  const eventsByDate = new Map<string, CampusCalendarEvent[]>();
  for (const ev of filteredEvents) {
    const evDate = new Date(ev.eventStart);
    const y = evDate.getFullYear();
    const m = String(evDate.getMonth() + 1).padStart(2, "0");
    const d = String(evDate.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${d}`;

    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key)!.push(ev);
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Navigasi Bulan */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-slate-300 rounded-xl p-1 shadow-2xs">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 font-bold transition cursor-pointer"
              title="Bulan sebelumnya"
            >
              ◀
            </button>
            <span className="px-4 text-xs sm:text-sm font-extrabold text-slate-900 min-w-36 text-center">
              {monthNames[currentMonth]} {currentYear}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 font-bold transition cursor-pointer"
              title="Bulan berikutnya"
            >
              ▶
            </button>
          </div>

          <button
            onClick={resetToThisMonth}
            className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition shadow-2xs cursor-pointer"
          >
            Bulan Ini
          </button>
        </div>

        {/* Filter Fasilitas & Mode Tampilan */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedFacilityId}
            onChange={(e) => setSelectedFacilityId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 font-medium outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Semua Fasilitas Kampus</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Cari kegiatan / organisasi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500 w-44 sm:w-56"
          />

          <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode("MONTH")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "MONTH"
                  ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Kalender
            </button>
            <button
              onClick={() => setViewMode("LIST")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "LIST"
                  ? "bg-white text-blue-700 shadow-2xs font-extrabold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Daftar ({filteredEvents.length})
            </button>
          </div>
        </div>
      </div>

      {/* Keterangan Status Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs bg-white p-3.5 rounded-xl border border-slate-200">
        <span className="font-bold text-slate-700">Keterangan:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
          <span className="text-slate-600">Disetujui Resmi (Terkonfirmasi)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
          <span className="text-slate-600">Sedang Verifikasi (Tahap Pengajuan)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-slate-400 inline-block"></span>
          <span className="text-slate-600">Selesai Berlangsung</span>
        </div>
        <span className="text-slate-400 ml-auto hidden sm:inline">
          Klik pada salah satu agenda untuk melihat detail peminjaman
        </span>
      </div>

      {/* TAMPILAN 1: GRID KALENDER BULANAN */}
      {viewMode === "MONTH" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {/* Header Hari (Senin - Minggu) */}
          <div className="grid grid-cols-7 bg-slate-100/80 border-b border-slate-200 text-center font-bold text-xs text-slate-700 py-2.5">
            <div>Senin</div>
            <div>Selasa</div>
            <div>Rabu</div>
            <div>Kamis</div>
            <div>Jumat</div>
            <div className="text-blue-700">Sabtu</div>
            <div className="text-rose-600">Minggu</div>
          </div>

          {/* Kotak Tanggal */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
            {calendarDays.map((item, index) => {
              if (item.dayNumber === null) {
                return <div key={`empty-${index}`} className="min-h-[68px] sm:min-h-[78px] bg-slate-50/40 p-1.5"></div>;
              }

              const dayEvents = eventsByDate.get(item.dateStr) || [];
              const isToday =
                today.getFullYear() === currentYear &&
                today.getMonth() === currentMonth &&
                today.getDate() === item.dayNumber;

              return (
                <div
                  key={item.dateStr}
                  className={`min-h-[68px] sm:min-h-[78px] p-1.5 sm:p-2 flex flex-col justify-between transition hover:bg-slate-50/80 ${
                    isToday ? "bg-amber-50/30 ring-1 ring-inset ring-amber-400" : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? "bg-purple-800 text-amber-300 font-extrabold shadow-2xs"
                          : "text-slate-700"
                      }`}
                    >
                      {item.dayNumber}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-semibold text-slate-400">
                        {dayEvents.length} acara
                      </span>
                    )}
                  </div>

                  {/* List Event di Tanggal Ini */}
                  <div className="space-y-1 overflow-y-auto max-h-20 pr-0.5">
                    {dayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={`w-full text-left p-1.5 rounded-lg border text-[11px] leading-tight transition cursor-pointer truncate block shadow-2xs ${
                          ev.status === "APPROVED"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100"
                            : ev.status === "PENDING"
                            ? "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                        title={`${ev.title} (${ev.orgName} @ ${ev.facilityName})`}
                      >
                        <div className="font-bold truncate">{ev.title}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          🏛️ {ev.facilityName}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAMPILAN 2: DAFTAR AGENDA LENGKAP (LIST VIEW) */}
      {viewMode === "LIST" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden divide-y divide-slate-100">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Tidak ada agenda kegiatan kampus yang sesuai dengan filter.
            </div>
          ) : (
            filteredEvents.map((ev) => (
              <div
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                className="p-4 sm:p-5 hover:bg-slate-50/80 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
                        ev.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : ev.status === "PENDING"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {ev.status === "APPROVED" ? "Disetujui" : ev.status === "PENDING" ? "Sedang Dicek" : "Selesai"}
                    </span>
                    <span className="font-mono text-xs text-slate-400">{ev.code}</span>
                  </div>

                  <h4 className="text-base font-extrabold text-slate-900 leading-snug">
                    {ev.title}
                  </h4>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="font-semibold text-blue-700">👥 {ev.orgName}</span>
                    <span>🏛️ {ev.facilityName} ({ev.facilityLocation})</span>
                  </div>
                </div>

                <div className="sm:text-right shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-xs font-bold text-slate-800">
                    📅 {new Date(ev.eventStart).toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </div>
                  <div className="text-xs font-mono font-extrabold text-blue-700 mt-0.5">
                    ⏰ {fmtTime(ev.eventStart)} - {fmtTime(ev.eventEnd)} WIB
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Detail Informasi Agenda Kegiatan */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto animate-in fade-in duration-150">
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase inline-block mb-1.5 ${
                    selectedEvent.status === "APPROVED"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : selectedEvent.status === "PENDING"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  {selectedEvent.status === "APPROVED"
                    ? "Disetujui Resmi"
                    : selectedEvent.status === "PENDING"
                    ? "Menunggu Verifikasi"
                    : "Selesai"}
                </span>
                <h4 className="text-lg font-extrabold text-slate-900 leading-snug">
                  {selectedEvent.title}
                </h4>
                <span className="text-xs font-mono text-slate-400">Kode: {selectedEvent.code}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div>
                  <span className="text-slate-400 block text-[11px]">🏛️ Fasilitas yang Digunakan:</span>
                  <strong className="text-slate-900 text-sm">{selectedEvent.facilityName}</strong>
                  <div className="text-slate-500 text-[11px]">{selectedEvent.facilityLocation}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Mulai Acara:</span>
                    <strong className="text-slate-900">{fmtDateTime(selectedEvent.eventStart)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Selesai Acara:</span>
                    <strong className="text-slate-900">{fmtDateTime(selectedEvent.eventEnd)}</strong>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px]">👥 Organisasi Penyelenggara:</span>
                <strong className="text-blue-700 text-sm">{selectedEvent.orgName}</strong>
              </div>

              {selectedEvent.purpose && (
                <div>
                  <span className="text-slate-400 block text-[11px]">🎯 Perihal / Tujuan:</span>
                  <div className="text-slate-800">{selectedEvent.purpose}</div>
                </div>
              )}

              {selectedEvent.description && (
                <div>
                  <span className="text-slate-400 block text-[11px]">📝 Deskripsi Kegiatan:</span>
                  <div className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                    {selectedEvent.description}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">👤 Ketua Pelaksana:</span>
                  <strong className="text-slate-800">{selectedEvent.leadName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">📞 Kontak Penanggung Jawab:</span>
                  <strong className="text-slate-800">{selectedEvent.leadContact}</strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Link
                href={`/dashboard/peminjaman/${selectedEvent.id}`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition"
              >
                Buka Lembar Pengajuan Lengkap →
              </Link>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

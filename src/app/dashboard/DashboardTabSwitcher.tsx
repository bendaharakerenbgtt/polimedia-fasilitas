"use client";

import { useState, useEffect } from "react";
import CampusCalendarViewer from "./kalender/CampusCalendarViewer";
import type { CampusCalendarEvent } from "@/server/bookings";

export default function DashboardTabSwitcher({
  events,
  facilities,
  renderBookings,
  bookingsCount,
  isOrgAccount,
}: {
  events: CampusCalendarEvent[];
  facilities: { id: string; name: string; category: string }[];
  renderBookings: React.ReactNode;
  bookingsCount: number;
  isOrgAccount: boolean;
}) {
  // Default tab: Untuk akun organisasi (HIMA/UKM) tampilkan daftar pengajuan terlebih dahulu agar tidak gantung
  const [activeTab, setActiveTab] = useState<"bookings" | "calendar">("bookings");

  useEffect(() => {
    // Sinkronisasi dengan URL hash: jika user klik "Daftar Pengajuan" di header
    if (window.location.hash === "#daftar-pengajuan") {
      setActiveTab("bookings");
    } else if (window.location.hash === "#kalender") {
      setActiveTab("calendar");
    }

    const handleHashChange = () => {
      if (window.location.hash === "#daftar-pengajuan") {
        setActiveTab("bookings");
      } else if (window.location.hash === "#kalender") {
        setActiveTab("calendar");
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <div className="space-y-5">
      {/* Tab Bar Navigasi Modern */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs sm:text-sm font-bold w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("bookings")}
            className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === "bookings"
                ? "bg-white text-purple-950 shadow-xs border border-slate-200 font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📋</span>
            <span>Daftar Pengajuan</span>
            <span
              className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                activeTab === "bookings"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {bookingsCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("calendar")}
            className={`px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-2 ${
              activeTab === "calendar"
                ? "bg-white text-purple-950 shadow-xs border border-slate-200 font-extrabold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>📅</span>
            <span>Kalender Fasilitas</span>
            <span className="hidden md:inline text-xs text-slate-400 font-normal">
              • Cek Jadwal Ruangan
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          {activeTab === "bookings" ? (
            <span>Memantau status permohonan peminjaman fasilitas Anda</span>
          ) : (
            <span>Klik tanggal/acara untuk melihat siapa penyelenggaranya</span>
          )}
        </div>
      </div>

      {/* Konten Tab 1: Daftar Pengajuan */}
      {activeTab === "bookings" && (
        <div id="daftar-pengajuan" className="scroll-mt-24 animate-in fade-in duration-150">
          {renderBookings}
        </div>
      )}

      {/* Konten Tab 2: Kalender Fasilitas Compact */}
      {activeTab === "calendar" && (
        <div id="kalender" className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4 animate-in fade-in duration-150">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Ketersediaan Fasilitas Kampus
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-0.5">
                Kalender Agenda Kegiatan Mahasiswa & Ruangan
              </h3>
            </div>
            <div className="text-xs text-slate-400">
              PoliMedia Jakarta
            </div>
          </div>

          <CampusCalendarViewer events={events} facilities={facilities} />
        </div>
      )}
    </div>
  );
}

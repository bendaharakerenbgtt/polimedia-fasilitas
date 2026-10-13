"use client";

import { useState } from "react";
import Link from "next/link";
import { fmtDateTime } from "@/lib/time";

// Menghapus segala pola kode pengajuan seperti "PJM-2026-00003 (open rek futsal)", "PJM-2026-00002 — ", atau "PJM-..."
function cleanNotificationBody(body: string) {
  if (!body) return "";
  // 1. Pola: PJM-YYYY-XXXXX (judul) sisa teks -> hilangkan PJM dan tanda kurungnya
  let cleaned = body.replace(/^PJM-\d{4}-\d+\s*\(([^)]+)\)/i, "$1");
  // 2. Pola: PJM-YYYY-XXXXX — atau PJM-YYYY-XXXXX: atau PJM-YYYY-XXXXX -
  cleaned = cleaned.replace(/^PJM-\d{4}-\d+\s*(—|-|:)\s*/i, "");
  // 3. Pola tersisa: PJM-YYYY-XXXXX di awal kalimat
  cleaned = cleaned.replace(/^PJM-\d{4}-\d+\s*/i, "");
  return cleaned.trim();
}

export default function CompactNotifications({
  notifications,
}: {
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    link?: string | null;
    created_at: string;
    read_at?: string | null;
  }>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!notifications || notifications.length === 0) return null;

  const latest = notifications[0];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl p-3 sm:p-3.5 shadow-2xs transition">
      {/* Bar Notifikasi Compact (1 Baris Ringkas) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
            🔔
          </div>
          <div className="flex items-center gap-2 min-w-0 text-xs">
            <span className="font-bold text-slate-800 shrink-0">
              {latest.title}
            </span>
            <span className="text-slate-500 truncate hidden md:inline">
              — {cleanNotificationBody(latest.body)}
            </span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-extrabold text-[10px] rounded-full shrink-0">
                {unreadCount} Baru
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto text-xs">
          {latest.link && !expanded && (
            <Link
              href={latest.link}
              className="text-blue-600 hover:text-blue-800 font-semibold px-2.5 py-1 rounded-md hover:bg-blue-50 transition"
            >
              Lihat Detail →
            </Link>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
          >
            {expanded ? "Tutup" : `Semua (${notifications.length})`}
          </button>
        </div>
      </div>

      {/* Expanded List (Hanya Muncul Jika Diklik) */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 animate-in fade-in duration-150">
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-3 transition ${
                  !n.read_at
                    ? "bg-blue-50/60 border-blue-200"
                    : "bg-slate-50 border-slate-200"
                }`}
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold text-slate-800">{n.title}</div>
                  <div className="text-slate-600 leading-relaxed text-[11px]">{cleanNotificationBody(n.body)}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {fmtDateTime(n.created_at)}
                  </div>
                </div>
                {n.link && (
                  <Link
                    href={n.link}
                    className="shrink-0 px-2.5 py-1 bg-white hover:bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold text-blue-600 transition"
                  >
                    Buka →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { fmtDateTime } from "@/lib/time";
import type { AuditLogRow } from "@/server/admin";

interface ActionMeta {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  icon: string;
  formatDetails: (data: any) => string;
}

const ACTION_MAP: Record<string, ActionMeta> = {
  BOOKING_SUBMITTED: {
    label: "Pengajuan Terkirim",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-200",
    icon: "🚀",
    formatDetails: (d) => `Formulir pengajuan peminjaman fasilitas berhasil dikirim (Kode: ${d?.code || "-"}). Alur persetujuan dimulai.`,
  },
  BOOKING_DRAFT_CREATED: {
    label: "Draft Pengajuan Dibuat",
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-700",
    badgeBorder: "border-slate-200",
    icon: "📝",
    formatDetails: (d) => `Draft awal dibuat (Kode: ${d?.code || "-"}). Slot ditahan sementara.`,
  },
  BOOKING_STEP_FORWARDED: {
    label: "Persetujuan Diteruskan",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    badgeBorder: "border-purple-200",
    icon: "✍️",
    formatDetails: (d) => `Tahap "${d?.step || "Verifikasi"}" ditandatangani dan diteruskan.${d?.note ? ` Catatan: "${d.note}"` : ""}`,
  },
  BOOKING_APPROVED: {
    label: "Peminjaman Disetujui",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-200",
    icon: "✅",
    formatDetails: (d) => `Peminjaman disetujui resmi oleh ${d?.decidedByRole || "Pihak Berwenang"}.${d?.note ? ` Catatan: "${d.note}"` : ""}`,
  },
  BOOKING_REJECTED: {
    label: "Peminjaman Ditolak",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    badgeBorder: "border-rose-200",
    icon: "✕",
    formatDetails: (d) => `Pengajuan ditolak pada tahap "${d?.atStep || "-"}". Alasan: "${d?.note || "-"}"`,
  },
  BOOKING_WITHDRAWN: {
    label: "Pengajuan Ditarik",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    badgeBorder: "border-amber-200",
    icon: "↩️",
    formatDetails: (d) => `Pengajuan ditarik mandiri oleh pemohon.${d?.reason ? ` Alasan: "${d.reason}"` : ""}`,
  },
  BOOKING_REVISION_REQUESTED: {
    label: "Permintaan Revisi",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-800",
    badgeBorder: "border-amber-300",
    icon: "⚠️",
    formatDetails: (d) => `Pengajuan dikembalikan pada tahap "${d?.atStep || "-"}". Catatan revisi: "${d?.note || "-"}"`,
  },
  BOOKING_RESUBMITTED: {
    label: "Revisi Dikirim Ulang",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-800",
    badgeBorder: "border-blue-300",
    icon: "📨",
    formatDetails: (d) => `Hasil perbaikan revisi pengajuan telah dikirimkan kembali oleh pemohon.`,
  },
  CHANGE_REQUEST_CREATED: {
    label: "Permohonan Perubahan",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
    badgeBorder: "border-indigo-200",
    icon: "🔄",
    formatDetails: (d) => `Mengajukan ${d?.type === "RESCHEDULE" ? "perubahan jadwal" : "pembatalan"}. Alasan: "${d?.reason || "-"}"`,
  },
  CHANGE_REQUEST_APPROVED: {
    label: "Perubahan Disetujui",
    badgeBg: "bg-teal-50",
    badgeText: "text-teal-700",
    badgeBorder: "border-teal-200",
    icon: "✨",
    formatDetails: (d) => `Permohonan jadwal baru disetujui oleh ${d?.decidedByRole || "Pejabat"}.${d?.note ? ` Catatan: "${d.note}"` : ""}`,
  },
  FACILITY_CREATED: {
    label: "Fasilitas Ditambah",
    badgeBg: "bg-cyan-50",
    badgeText: "text-cyan-700",
    badgeBorder: "border-cyan-200",
    icon: "🏢",
    formatDetails: (d) => `Fasilitas baru ditambahkan: "${d?.name || "-"}" (${d?.code || "-"}, ${d?.category || "-"})`,
  },
  FACILITY_UPDATED: {
    label: "Fasilitas Diperbarui",
    badgeBg: "bg-blue-50",
    badgeText: "text-blue-700",
    badgeBorder: "border-blue-200",
    icon: "✏️",
    formatDetails: (d) => `Data fasilitas diperbarui: "${d?.name || "-"}" (${d?.code || "-"})`,
  },
  FACILITY_DELETED: {
    label: "Fasilitas Dihapus",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    badgeBorder: "border-rose-200",
    icon: "🗑️",
    formatDetails: (d) => `Fasilitas dihapus dari sistem: "${d?.name || "-"}" (${d?.code || "-"})`,
  },
  USER_CREATED: {
    label: "Pengguna Dibuat",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-200",
    icon: "👤",
    formatDetails: (d) => `Akun pengguna baru dibuat: @${d?.username || "-"} (${d?.displayName || "-"}) dengan peran ${d?.role || "-"}`,
  },
  USER_UPDATED: {
    label: "Pengguna Diperbarui",
    badgeBg: "bg-slate-100",
    badgeText: "text-slate-800",
    badgeBorder: "border-slate-200",
    icon: "🔧",
    formatDetails: (d) => `Profil/peran akun @${d?.username || "-"} diperbarui.`,
  },
  USER_ACTIVE_TOGGLED: {
    label: "Status Akun Diubah",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    badgeBorder: "border-amber-200",
    icon: "🔘",
    formatDetails: (d) => `Status keaktifan akun diubah menjadi: ${d?.active ? "Aktif" : "Nonaktif"}`,
  },
  USER_DELETED: {
    label: "Pengguna Dihapus",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    badgeBorder: "border-rose-200",
    icon: "🗑️",
    formatDetails: (d) => `Akun @${d?.username || "-"} (${d?.displayName || "-"}) telah dihapus permanen.`,
  },
  USER_PASSWORD_RESET: {
    label: "Password Direset",
    badgeBg: "bg-amber-50",
    badgeText: "text-amber-700",
    badgeBorder: "border-amber-200",
    icon: "🔑",
    formatDetails: () => "Kata sandi akun pengguna telah direset oleh Administrator.",
  },
  ORG_ADVISOR_ASSIGNED: {
    label: "Pembina Ditetapkan",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
    badgeBorder: "border-indigo-200",
    icon: "👨‍🏫",
    formatDetails: () => "Dosen pembimbing/pembina baru ditetapkan untuk organisasi.",
  },
  ORG_ADVISOR_REMOVED: {
    label: "Pembina Dicabut",
    badgeBg: "bg-rose-50",
    badgeText: "text-rose-700",
    badgeBorder: "border-rose-200",
    icon: "👋",
    formatDetails: () => "Dosen pembina dicabut dari organisasi.",
  },
  SETTING_UPDATED: {
    label: "Kebijakan Diubah",
    badgeBg: "bg-purple-50",
    badgeText: "text-purple-700",
    badgeBorder: "border-purple-200",
    icon: "⚙️",
    formatDetails: (d) => `Nilai aturan sistem diperbarui menjadi: ${JSON.stringify(d?.value)}`,
  },
  SBA_CREATED: {
    label: "Laporan SBA Dibuat",
    badgeBg: "bg-teal-50",
    badgeText: "text-teal-700",
    badgeBorder: "border-teal-200",
    icon: "📑",
    formatDetails: () => "Formulir Laporan Pertanggungjawaban SBA dibuat oleh organisasi.",
  },
  SBA_SUBMITTED: {
    label: "Laporan SBA Dikirim",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-700",
    badgeBorder: "border-emerald-200",
    icon: "📤",
    formatDetails: () => "Laporan SBA selesai dan dikirim ke pengelola sarana.",
  },
  USER_LOGGED_IN: {
    label: "Masuk ke Sistem (Login)",
    badgeBg: "bg-sky-50",
    badgeText: "text-sky-700",
    badgeBorder: "border-sky-200",
    icon: "🔓",
    formatDetails: (d) => `Pengguna berhasil login ke dalam portal sistem (IP: ${d?.ip || "Lokal"}).`,
  },
};

const ENTITY_LABEL: Record<string, string> = {
  booking: "Peminjaman Fasilitas",
  facility: "Fasilitas Kampus",
  user: "Pengguna / Akun",
  organization: "Ormawa / UKM",
  setting: "Kebijakan Sistem",
  change_request: "Perubahan Jadwal",
  sba_report: "Laporan SBA",
};

export default function AuditLogViewer({ logs }: { logs: AuditLogRow[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = logs.filter((l) => {
    const q = searchTerm.toLowerCase();
    const meta = ACTION_MAP[l.action];
    const actionLabel = meta?.label.toLowerCase() || "";
    const matchesSearch =
      l.action.toLowerCase().includes(q) ||
      actionLabel.includes(q) ||
      (l.actor_name && l.actor_name.toLowerCase().includes(q)) ||
      (l.actor_username && l.actor_username.toLowerCase().includes(q)) ||
      JSON.stringify(l.data).toLowerCase().includes(q);

    const matchesAction = !filterAction || l.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const distinctActions = Array.from(new Set(logs.map((l) => l.action))).sort();

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            placeholder="Cari log audit (aktor, aksi, kata kunci)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-80"
          />

          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">Semua Jenis Aksi ({logs.length})</option>
            {distinctActions.map((act) => {
              const meta = ACTION_MAP[act];
              return (
                <option key={act} value={act}>
                  {meta ? `${meta.icon} ${meta.label}` : act}
                </option>
              );
            })}
          </select>
        </div>

        <div className="text-xs text-slate-500 font-medium whitespace-nowrap self-end sm:self-center">
          Menampilkan <strong>{filteredLogs.length}</strong> dari {logs.length} catatan
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Waktu</th>
                <th className="px-6 py-3.5">Aktivitas / Aksi</th>
                <th className="px-6 py-3.5">Pelaku (Aktor)</th>
                <th className="px-6 py-3.5">Keterangan & Rincian</th>
                <th className="px-6 py-3.5 text-right">Data Teknis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400">
                    Tidak ada catatan log yang cocok dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => {
                  const meta = ACTION_MAP[l.action] || {
                    label: l.action,
                    badgeBg: "bg-slate-100",
                    badgeText: "text-slate-800",
                    badgeBorder: "border-slate-200",
                    icon: "📌",
                    formatDetails: (d: any) => JSON.stringify(d),
                  };

                  const isExpanded = expandedLogId === l.id;
                  const readableText = meta.formatDetails(l.data);
                  const entityName = ENTITY_LABEL[l.entity_type] || l.entity_type;

                  return (
                    <tr key={l.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-[11px] font-mono">
                        {fmtDateTime(l.created_at)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                          >
                            <span>{meta.icon}</span>
                            <span>{meta.label}</span>
                          </span>
                          <div className="text-[10px] text-slate-400">
                            Entitas: <strong className="text-slate-600">{entityName}</strong>
                            {l.entity_title && (
                              <span className="block text-[11px] font-semibold text-blue-700 mt-0.5">
                                "{l.entity_title}"
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <strong className="text-slate-900 block font-semibold">
                            {l.actor_name || "Sistem"}
                          </strong>
                          {l.actor_username ? (
                            <span className="font-mono text-[11px] text-slate-500">
                              @{l.actor_username}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">(Otomatisasi)</span>
                          )}
                          {l.ip && <span className="block text-[10px] text-slate-400">IP: {l.ip}</span>}
                        </div>
                      </td>

                      <td className="px-6 py-4 max-w-sm sm:max-w-md">
                        <p className="text-slate-700 font-medium leading-relaxed">
                          {readableText}
                        </p>

                        {/* Rincian Akurat: Barang, Panitia, Rundown */}
                        {l.entity_type === "booking" && (l.booking_items_summary || (Array.isArray(l.booking_committee) && l.booking_committee.length > 0) || (Array.isArray(l.booking_rundown) && l.booking_rundown.length > 0)) && (
                          <div className="mt-2.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px]">
                            {l.booking_items_summary && (
                              <div className="flex items-start gap-1 text-slate-700">
                                <span className="font-bold shrink-0 text-blue-700">Barang:</span>
                                <span>{l.booking_items_summary}</span>
                              </div>
                            )}
                            {Array.isArray(l.booking_committee) && l.booking_committee.length > 0 && (
                              <div className="flex items-start gap-1 text-slate-700">
                                <span className="font-bold shrink-0 text-emerald-700">Panitia ({l.booking_committee.length}):</span>
                                <span className="line-clamp-1">{l.booking_committee.map((c: any) => `${c.name}${c.nim ? ` (${c.nim})` : ""}`).join(", ")}</span>
                              </div>
                            )}
                            {Array.isArray(l.booking_rundown) && l.booking_rundown.length > 0 && (
                              <div className="flex items-start gap-1 text-slate-700">
                                <span className="font-bold shrink-0 text-purple-700">Rundown ({l.booking_rundown.length}):</span>
                                <span className="line-clamp-1">{l.booking_rundown.map((r: any) => `${r.agenda}${r.time ? ` [${r.time}]` : ""}`).join(" → ")}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : l.id)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition shadow-2xs"
                        >
                          {isExpanded ? "Tutup JSON ▲" : "Lihat JSON ▼"}
                        </button>

                        {isExpanded && (
                          <div className="mt-3 text-left">
                            <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl border border-slate-800 text-[11px] font-mono overflow-x-auto max-h-48 whitespace-pre-wrap">
                              {JSON.stringify(l.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

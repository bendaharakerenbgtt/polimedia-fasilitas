"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSettingAction } from "@/app/actions/admin";
import type { SettingItem } from "@/server/admin";

interface SettingMeta {
  label: string;
  category: string;
  badge: string;
  explanation: string;
  unit?: string;
  hint: string;
}

const SETTING_INFO: Record<string, SettingMeta> = {
  hold_minutes: {
    label: "Durasi Hold Slot Sementara Formulir",
    category: "Pemesanan & Jadwal",
    badge: "Jadwal & Slot",
    explanation:
      "Batas waktu (dalam menit) fasilitas ditahan sementara saat ormawa/UKM mulai mengisi formulir pengajuan baru. Jika formulir tidak dikirim sebelum waktu habis, slot jadwal otomatis dilepas untuk organisasi lain.",
    unit: "Menit",
    hint: "Rekomendasi: 60 menit. Minimal 15 menit.",
  },
  reschedule_hold_new_slot: {
    label: "Kunci Otomatis Jadwal Baru saat Permohonan Reschedule",
    category: "Perubahan Jadwal",
    badge: "Reschedule",
    explanation:
      "Bila diaktifkan (Aktif), slot jadwal baru yang diminta organisasi akan langsung dikunci/ditahan agar tidak diambil pihak lain selagi menunggu persetujuan Wakil Direktur atau Subbagian Umum.",
    hint: "Disarankan Aktif (True) agar jadwal yang diminta tidak bentrok selagi ditinjau.",
  },
  wadir_can_reject_early: {
    label: "Hak Penolakan Cepat oleh Wakil Direktur",
    category: "Alur Persetujuan",
    badge: "Wewenang Wadir",
    explanation:
      "Mengizinkan Wakil Direktur Bidang Kemahasiswaan untuk langsung menolak pengajuan yang tidak sesuai ketentuan kampus tanpa harus menunggu tahapan penandatanganan di bawahnya selesai.",
    hint: "Disarankan Aktif (True) untuk mempercepat proses jika permohonan jelas melanggar aturan.",
  },
  spz_deadline_days: {
    label: "Tenggat Waktu Penyerahan SPZ (Surat Persetujuan)",
    category: "Batas Waktu Dokumen",
    badge: "Administrasi",
    explanation:
      "Batas hari minimum (H-n) sebelum tanggal kegiatan dimana SPZ wajib diserahkan. Masukkan angka hari, atau kosongkan jika kampus tidak menerapkan batas tenggat otomatis.",
    unit: "Hari (H-n)",
    hint: "Kosongkan (null) jika tidak ada batas waktu otomatis yang membatalkan pengajuan.",
  },
  sba_deadline_days: {
    label: "Tenggat Pengumpulan Laporan Pertanggungjawaban (SBA)",
    category: "Batas Waktu Dokumen",
    badge: "Pelaporan Kegiatan",
    explanation:
      "Batas maksimum hari setelah kegiatan selesai bagi organisasi untuk mengunggah Laporan Penggunaan Sarana & Prasarana (SBA). Kosongkan jika tidak dibatasi sistem secara kaku.",
    unit: "Hari setelah acara",
    hint: "Kosongkan (null) jika pengumpulan laporan dilakukan secara fleksibel.",
  },
  standard_inventory_items: {
    label: "Daftar Barang & Sarana Standar Kampus",
    category: "Peralatan & Fasilitas",
    badge: "Inventaris / Sarana",
    explanation:
      "Daftar perlengkapan standar yang dapat dipilih dan dipinjam ormawa saat mengajukan fasilitas. Pisahkan setiap barang dengan tanda koma.",
    hint: "Format nama barang dipisahkan tanda koma: Speaker, Kursi, Sofa, Meja, Kursi Operator, Meja Operator",
  },
};

export default function SettingsManager({
  settings,
}: {
  settings: SettingItem[];
}) {
  const router = useRouter();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Local values state
  const [values, setValues] = useState<Record<string, any>>(() => {
    const map: Record<string, any> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  });

  async function handleSave(key: string) {
    setLoadingKey(key);
    setError(null);
    setSuccess(null);
    const val = values[key];
    const res = await updateSettingAction(key, val);
    setLoadingKey(null);
    if (res.error) {
      setError(res.error);
    } else {
      const meta = SETTING_INFO[key];
      setSuccess(`Aturan "${meta?.label || key}" berhasil disimpan!`);
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
          <span>✅</span>
          <span>{success}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="font-extrabold text-slate-900 text-base">
            Daftar Aturan Operasional & Kebijakan Kampus
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Ubah parameter operasional peminjaman fasilitas di bawah ini. Perubahan akan langsung berlaku ke seluruh alur pengajuan sistem.
          </p>
        </div>

        <div className="space-y-4">
          {settings.map((s) => {
            const meta = SETTING_INFO[s.key] || {
              label: s.key,
              category: "Pengaturan Umum",
              badge: "Sistem",
              explanation: s.description,
              hint: "",
            };

            const isBool = typeof s.value === "boolean";
            const isNum =
              typeof s.value === "number" ||
              (s.value === null && (s.key.includes("days") || s.key.includes("minutes")));

            return (
              <div
                key={s.key}
                className="bg-slate-50/70 hover:bg-slate-50 p-5 rounded-2xl border border-slate-200/90 transition flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                      {meta.badge}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">{meta.label}</h4>
                    <span className="text-[11px] font-mono text-slate-400">({s.key})</span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                    {meta.explanation}
                  </p>

                  {meta.hint && (
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-0.5">
                      <span className="text-amber-500 font-bold">💡</span>
                      <span>{meta.hint}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-center bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  {isBool ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={values[s.key] ? "true" : "false"}
                        onChange={(e) =>
                          setValues({ ...values, [s.key]: e.target.value === "true" })
                        }
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="true">✅ Aktif (True)</option>
                        <option value="false">⛔ Nonaktif (False)</option>
                      </select>
                    </div>
                  ) : isNum ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={values[s.key] ?? ""}
                        onChange={(e) =>
                          setValues({
                            ...values,
                            [s.key]: e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        placeholder="Tidak diterapkan"
                        className="w-28 px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-semibold placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-blue-500 outline-none text-right"
                      />
                      {meta.unit && (
                        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                          {meta.unit}
                        </span>
                      )}
                    </div>
                  ) : s.key === "standard_inventory_items" || Array.isArray(s.value) ? (
                    <div className="flex flex-col gap-1">
                      <input
                        type="text"
                        value={
                          Array.isArray(values[s.key])
                            ? values[s.key].join(", ")
                            : values[s.key] ?? ""
                        }
                        onChange={(e) => {
                          const arr = e.target.value
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean);
                          setValues({ ...values, [s.key]: arr });
                        }}
                        placeholder="Speaker, Kursi, Sofa..."
                        className="w-72 px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={values[s.key] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [s.key]: e.target.value })
                      }
                      className="w-48 px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  )}

                  <button
                    onClick={() => handleSave(s.key)}
                    disabled={loadingKey === s.key}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    {loadingKey === s.key ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

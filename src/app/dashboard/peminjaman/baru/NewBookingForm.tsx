"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createBookingDraftAction, updateBookingDraftAction } from "@/app/actions/bookings";
import { fmtDateTime, fmtRange, fmtTime, toLocalInput, isWithinOperationalHours, OPERATIONAL_START_TIME, OPERATIONAL_END_TIME } from "@/lib/time";
import type { BookedSlotInfo } from "@/server/bookings";

interface InventoryItemState {
  name: string;
  quantity: number;
  notes: string;
}

interface CommitteeMemberState {
  name: string;
  nim: string;
  prodi: string;
}

interface RundownItemState {
  agenda: string;
  time: string;
  pic: string;
}

export default function NewBookingForm({
  facilities,
  bookedSlots = [],
  standardItems = [],
  facilityItemsMap = {},
  initialBooking,
  initialItems = [],
  mode = "create",
}: {
  facilities: { id: string; name: string; category: string; location: string; code: string }[];
  bookedSlots?: BookedSlotInfo[];
  standardItems?: string[];
  facilityItemsMap?: Record<string, { name: string; quantity: number }[]>;
  initialBooking?: any;
  initialItems?: { name: string; quantity: number; notes?: string }[];
  mode?: "create" | "edit";
}) {
  const formActionFn = mode === "edit" && initialBooking
    ? updateBookingDraftAction.bind(null, initialBooking.id)
    : createBookingDraftAction;
  const [state, formAction, isPending] = useActionState(formActionFn, null);

  // STEP STATE: 1 | 2 | 3
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // TAHAP 1: FASILITAS & WAKTU
  const [facilityId, setFacilityId] = useState(initialBooking?.facility_id ?? "");
  const [usageStart, setUsageStart] = useState(initialBooking ? toLocalInput(initialBooking.usage_start) : "");
  const [eventStart, setEventStart] = useState(initialBooking ? toLocalInput(initialBooking.event_start) : "");
  const [eventEnd, setEventEnd] = useState(initialBooking ? toLocalInput(initialBooking.event_end) : "");
  const [usageEnd, setUsageEnd] = useState(initialBooking ? toLocalInput(initialBooking.usage_end) : "");
  const [shortcutDate, setShortcutDate] = useState("");
  const [shortcutTimeSlot, setShortcutTimeSlot] = useState("");

  // TAHAP 2: INFORMASI, DESKRIPSI, BARANG, PANITIA & RUNDOWN
  const [title, setTitle] = useState(initialBooking?.title ?? "");
  const [purpose, setPurpose] = useState(initialBooking?.purpose ?? "");
  const [description, setDescription] = useState(initialBooking?.description ?? "");

  // Inisialisasi daftar barang bawaan dari facilityItemsMap jika ada, atau standardItems
  const [inventoryItems, setInventoryItems] = useState<InventoryItemState[]>(() => {
    const fId = initialBooking?.facility_id;
    const baseList = (fId && facilityItemsMap[fId]) || standardItems.map((name) => ({ name, quantity: 0 }));
    return baseList.map((it: any) => {
      const existing = initialItems.find((x) => x.name === it.name);
      return {
        name: it.name,
        quantity: existing ? existing.quantity : 0,
        notes: existing?.notes || "",
      };
    });
  });

  // Handler pergantian fasilitas: otomatis sesuaikan daftar barang sesuai fasilitas yang dipilih
  function handleFacilityChange(newFacilityId: string) {
    setFacilityId(newFacilityId);
    const facilitySpecificItems = facilityItemsMap[newFacilityId];
    if (facilitySpecificItems && facilitySpecificItems.length > 0) {
      setInventoryItems(
        facilitySpecificItems.map((it) => {
          const existing = initialItems.find((x) => x.name === it.name);
          return {
            name: it.name,
            quantity: existing ? existing.quantity : 0,
            notes: existing?.notes || "",
          };
        })
      );
    } else {
      setInventoryItems(
        standardItems.map((name) => {
          const existing = initialItems.find((x) => x.name === name);
          return {
            name,
            quantity: existing ? existing.quantity : 0,
            notes: existing?.notes || "",
          };
        })
      );
    }
  }

  // Panitia (Nama lengkap, NIM, Program Studi)
  const [committee, setCommittee] = useState<CommitteeMemberState[]>(() => {
    if (Array.isArray(initialBooking?.committee) && initialBooking.committee.length > 0) {
      return initialBooking.committee;
    }
    return [{ name: "", nim: "", prodi: "" }];
  });

  // Rundown (Nama kegiatan / Agenda, Waktu, Penanggung Jawab)
  const [rundown, setRundown] = useState<RundownItemState[]>(() => {
    if (Array.isArray(initialBooking?.rundown) && initialBooking.rundown.length > 0) {
      return initialBooking.rundown;
    }
    return [{ agenda: "", time: "", pic: "" }];
  });

  // TAHAP 3: PENANGGUNG JAWAB KEGIATAN (WAJIB KONTAK)
  const [leadName, setLeadName] = useState(initialBooking?.lead_name ?? "");
  const [leadContact, setLeadContact] = useState(initialBooking?.lead_contact ?? "");
  const [chairName, setChairName] = useState(initialBooking?.chair_name ?? "");
  const [chairContact, setChairContact] = useState(initialBooking?.chair_contact ?? "");

  // Hitung tanggal minimal peminjaman (H-3 dari hari ini jika baru, bebas jika mengedit data yang sudah ada)
  const minDate = mode === "edit" ? undefined : (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();

  // Filter jadwal slot yang sudah dibooking untuk fasilitas yang dipilih
  const activeFacilitySlots = bookedSlots.filter(
    (s) => !facilityId || s.facilityId === facilityId
  );

  const selectedFacilityObj = facilities.find((f) => f.id === facilityId);

  // Handler preset jam
  function applyTimePreset(dateVal: string, presetType: string) {
    if (!dateVal) return;
    setShortcutDate(dateVal);
    setShortcutTimeSlot(presetType);

    if (presetType === "PAGI_SIANG") {
      setUsageStart(`${dateVal}T07:00`);
      setEventStart(`${dateVal}T08:00`);
      setEventEnd(`${dateVal}T12:00`);
      setUsageEnd(`${dateVal}T13:00`);
    } else if (presetType === "SIANG_SORE") {
      setUsageStart(`${dateVal}T12:00`);
      setEventStart(`${dateVal}T13:00`);
      setEventEnd(`${dateVal}T17:00`);
      setUsageEnd(`${dateVal}T18:00`);
    } else if (presetType === "SEHARIAN") {
      setUsageStart(`${dateVal}T07:00`);
      setEventStart(`${dateVal}T08:00`);
      setEventEnd(`${dateVal}T16:00`);
      setUsageEnd(`${dateVal}T17:00`);
    }
  }

  // Helper manipulasi barang
  function updateItemQty(index: number, delta: number) {
    setInventoryItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
      )
    );
  }

  function setItemQtyDirect(index: number, qty: number) {
    setInventoryItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(0, qty) } : item
      )
    );
  }

  // Helper panitia
  function addCommitteeMember() {
    setCommittee((prev) => [...prev, { name: "", nim: "", prodi: "" }]);
  }

  function removeCommitteeMember(idx: number) {
    setCommittee((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCommittee(idx: number, field: keyof CommitteeMemberState, val: string) {
    setCommittee((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: val } : c))
    );
  }

  // Helper rundown
  function addRundownItem() {
    setRundown((prev) => [...prev, { agenda: "", time: "", pic: "" }]);
  }

  function removeRundownItem(idx: number) {
    setRundown((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRundown(idx: number, field: keyof RundownItemState, val: string) {
    setRundown((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r))
    );
  }

  // Validasi sebelum lanjut ke step berikutnya
  function handleNextStep(targetStep: 2 | 3) {
    if (targetStep === 2) {
      if (!facilityId) {
        alert("Silakan pilih fasilitas kampus terlebih dahulu.");
        return;
      }
      if (!usageStart || !eventStart || !eventEnd || !usageEnd) {
        alert("Silakan tentukan waktu mulai dan selesai penggunaan fasilitas serta acara.");
        return;
      }
      if (usageStart > eventStart || eventStart >= eventEnd || eventEnd > usageEnd) {
        alert("Urutan waktu harus valid: Mulai Fasilitas ≤ Mulai Acara < Selesai Acara ≤ Selesai Fasilitas.");
        return;
      }
      const opCheck = isWithinOperationalHours(usageStart, usageEnd);
      if (!opCheck.valid) {
        alert(opCheck.reason);
        return;
      }
      const minLeadTimeMs = 3 * 24 * 60 * 60 * 1000;
      if (mode !== "edit" && new Date(usageStart).getTime() - Date.now() < minLeadTimeMs) {
        alert("Peminjaman fasilitas harus diajukan minimal 3 hari (H-3) sebelum kegiatan dimulai.");
        return;
      }
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (targetStep === 3) {
      if (!title.trim() || !purpose.trim() || !description.trim()) {
        alert("Nama kegiatan, perihal/tujuan, dan deskripsi kegiatan wajib diisi.");
        return;
      }
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Filter barang yang kuantitasnya > 0 untuk dikirim
  const activeItemsToSubmit = inventoryItems.filter((it) => it.quantity > 0);
  const activeCommitteeToSubmit = committee.filter((c) => c.name.trim().length > 0);
  const activeRundownToSubmit = rundown.filter((r) => r.agenda.trim().length > 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Banner Khusus Mode Edit / Revisi */}
      {mode === "edit" && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">✏️</span>
              <h3 className="font-extrabold text-amber-950 text-base">
                Mode Perbaikan / Revisi Formulir Pengajuan ({initialBooking?.code})
              </h3>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-amber-200 text-amber-900 rounded-lg">
              Status: {initialBooking?.status === "REVISION" ? "Perlu Revisi" : initialBooking?.status}
            </span>
          </div>
          {initialBooking?.decision_note && (
            <div className="bg-white rounded-xl p-3.5 border border-amber-200 text-xs text-amber-950 space-y-1">
              <strong className="text-amber-900 block font-bold">Catatan Arahan Revisi dari Peninjau:</strong>
              <p className="whitespace-pre-line text-slate-800 font-medium">{initialBooking.decision_note}</p>
            </div>
          )}
          <p className="text-xs text-amber-800">
            Perbarui data kegiatan, susunan panitia, rundown acara, sarana barang fasilitas, atau jam kegiatan sesuai arahan di atas.
          </p>
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={mode === "edit" && initialBooking ? `/dashboard/peminjaman/${initialBooking.id}` : "/dashboard"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition shadow-2xs"
            >
              <span>←</span>
              <span>{mode === "edit" ? "Batal & Kembali ke Detail Pengajuan" : "Kembali ke Dashboard"}</span>
            </Link>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {mode === "edit" ? "Perbarui / Edit Formulir Pengajuan" : "Formulir Pengajuan Peminjaman Fasilitas"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {mode === "edit"
              ? "Ubah data pengajuan Anda lalu simpan perubahan atau langsung kirimkan kembali hasil revisi."
              : "Pengajuan dibagi menjadi 3 tahapan sistematis. Slot akan otomatis ditahan (HOLD) selama 1 jam saat draft berhasil disimpan."}
          </p>
        </div>
      </div>

      {/* STEPPER INDICATOR TAHAP 1 - 2 - 3 */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div
            onClick={() => setStep(1)}
            className={`p-3 rounded-xl border transition cursor-pointer flex flex-col items-center gap-1 ${
              step === 1
                ? "bg-blue-50 border-blue-300 text-blue-900 font-bold shadow-2xs"
                : "bg-slate-50/60 border-slate-200 text-slate-500 hover:bg-slate-100"
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
              1
            </span>
            <span className="font-semibold text-xs sm:text-sm">Fasilitas & Jadwal</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">Pilihan jam & cek ketersediaan</span>
          </div>

          <div
            onClick={() => handleNextStep(2)}
            className={`p-3 rounded-xl border transition cursor-pointer flex flex-col items-center gap-1 ${
              step === 2
                ? "bg-blue-50 border-blue-300 text-blue-900 font-bold shadow-2xs"
                : "bg-slate-50/60 border-slate-200 text-slate-500 hover:bg-slate-100"
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= 2 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
            }`}>
              2
            </span>
            <span className="font-semibold text-xs sm:text-sm">Informasi & Kebutuhan</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">Sarana, panitia & susunan acara</span>
          </div>

          <div
            onClick={() => handleNextStep(3)}
            className={`p-3 rounded-xl border transition cursor-pointer flex flex-col items-center gap-1 ${
              step === 3
                ? "bg-blue-50 border-blue-300 text-blue-900 font-bold shadow-2xs"
                : "bg-slate-50/60 border-slate-200 text-slate-500 hover:bg-slate-100"
            }`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              step === 3 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
            }`}>
              3
            </span>
            <span className="font-semibold text-xs sm:text-sm">Penanggung Jawab</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">Ketua pelaksana & organisasi</span>
          </div>
        </div>
      </div>

      {state?.error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>{state.error}</span>
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {/* Hidden inputs to pass data through formAction */}
        <input type="hidden" name="facilityId" value={facilityId} />
        <input type="hidden" name="usageStart" value={usageStart} />
        <input type="hidden" name="eventStart" value={eventStart} />
        <input type="hidden" name="eventEnd" value={eventEnd} />
        <input type="hidden" name="usageEnd" value={usageEnd} />
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="purpose" value={purpose} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="leadName" value={leadName} />
        <input type="hidden" name="leadContact" value={leadContact} />
        <input type="hidden" name="chairName" value={chairName} />
        <input type="hidden" name="chairContact" value={chairContact} />
        <input type="hidden" name="itemsJson" value={JSON.stringify(activeItemsToSubmit)} />
        <input type="hidden" name="committeeJson" value={JSON.stringify(activeCommitteeToSubmit)} />
        <input type="hidden" name="rundownJson" value={JSON.stringify(activeRundownToSubmit)} />

        {/* =========================================================================
            TAHAP 1: PILIHAN FASILITAS, JAM & DAFTAR PEMINJAMAN YANG SEDANG DIGUNAKAN
            ========================================================================= */}
        {step === 1 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in duration-150">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Tahap 1 dari 3
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                Pilihan Fasilitas & Jadwal Acara
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Pilih fasilitas yang ingin dipinjam. Anda dapat melihat daftar peminjaman fasilitas yang sudah terisi beserta nama kegiatan, organisasi peminjam, jam pemakaian, dan tujuannya.
              </p>
            </div>

            {/* Pilihan Fasilitas */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Pilih Fasilitas Kampus *
              </label>
              <select
                required
                value={facilityId}
                onChange={(e) => handleFacilityChange(e.target.value)}
                className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm bg-white text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Pilih Fasilitas Kampus PoliMedia --</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} — ({f.location || f.category})
                  </option>
                ))}
              </select>
            </div>

            {/* DAFTAR KEGIATAN & JADWAL FASILITAS YANG DIPAKAI PIHAK LAIN */}
            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📋</span>
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      Daftar Jadwal Pemakaian Fasilitas Ini
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Informasi lengkap kegiatan, organisasi, waktu, dan perihal peminjaman
                    </p>
                  </div>
                </div>
                {selectedFacilityObj && (
                  <span className="text-xs font-bold px-3 py-1 bg-white border border-slate-200 rounded-full text-blue-700 w-fit">
                    🏢 {selectedFacilityObj.name}
                  </span>
                )}
              </div>

              {!facilityId ? (
                <div className="p-6 text-center text-slate-400 text-xs italic">
                  Silakan pilih fasilitas kampus di atas untuk melihat jadwal penggunaan yang telah terdaftar.
                </div>
              ) : activeFacilitySlots.length === 0 ? (
                <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>✨</span>
                    <span>Fasilitas ini sepenuhnya kosong dan belum ada peminjaman lain!</span>
                  </div>
                  <p className="text-emerald-700 text-[11px]">
                    Anda bebas memilih tanggal dan jam berapa pun (minimal H-3 dari hari ini).
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs text-slate-600 font-medium">
                    Terdapat <strong>{activeFacilitySlots.length} jadwal terisi</strong>. Pilihlah jam atau hari yang tidak bertabrakan dengan jadwal berikut:
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeFacilitySlots.map((slot, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-900 text-sm leading-snug">
                            {slot.title}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 shrink-0">
                            {slot.kind === "HOLD" ? "Sedang Hold" : "Terbooking"}
                          </span>
                        </div>

                        <div className="space-y-1 text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-slate-400 text-[11px] block">Waktu Penggunaan:</span>
                            <span className="font-mono font-bold text-rose-600 text-xs">
                              ⏰ {fmtRange(slot.start, slot.end)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[11px] block">Dipakai Oleh:</span>
                            <span className="font-semibold text-slate-800">
                              🏛️ {slot.orgName}
                            </span>
                          </div>
                          {slot.purpose && slot.purpose !== "-" && (
                            <div>
                              <span className="text-slate-400 text-[11px] block">Untuk Keperluan:</span>
                              <span className="italic text-slate-700">
                                "{slot.purpose}"
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* PENGISIAN CEPAT WAKTU */}
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>Pengisian Cepat Waktu Acara</span>
                </span>
                <span className="text-[11px] text-blue-700 font-medium">
                  Aturan: Min. H-3 Acara
                </span>
              </div>
              <p className="text-xs text-blue-800 leading-relaxed">
                Pilih tanggal kegiatan (minimal {minDate}), lalu klik tombol preset jam di bawah untuk mengisi jam mulai dan selesai secara otomatis:
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="sm:w-60">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tanggal Acara (Min. {minDate}):
                  </label>
                  <input
                    type="date"
                    min={minDate}
                    value={shortcutDate}
                    onChange={(e) => {
                      const d = e.target.value;
                      setShortcutDate(d);
                      if (shortcutTimeSlot) applyTimePreset(d, shortcutTimeSlot);
                    }}
                    className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex-1">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Pilihan Preset Jam:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!shortcutDate}
                      onClick={() => applyTimePreset(shortcutDate, "PAGI_SIANG")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer disabled:opacity-50 ${
                        shortcutTimeSlot === "PAGI_SIANG"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      Pagi – Siang (08:00 – 12:00)
                    </button>
                    <button
                      type="button"
                      disabled={!shortcutDate}
                      onClick={() => applyTimePreset(shortcutDate, "SIANG_SORE")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer disabled:opacity-50 ${
                        shortcutTimeSlot === "SIANG_SORE"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      Siang – Sore (13:00 – 17:00)
                    </button>
                    <button
                      type="button"
                      disabled={!shortcutDate}
                      onClick={() => applyTimePreset(shortcutDate, "SEHARIAN")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer disabled:opacity-50 ${
                        shortcutTimeSlot === "SEHARIAN"
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      Seharian Penuh (08:00 – 16:00)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* JAM OPERASIONAL INFO BANNER */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold">Jam Operasional Perizinan Fasilitas Kampus:</span>{" "}
                <span>Pukul <strong>06:00 s.d. 18:30 WIB</strong> pada hari yang sama.</span>
              </div>
              <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded shrink-0">
                WIB (UTC+7)
              </span>
            </div>

            {/* DETAIL INPUT DATETIME-LOCAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  1. Mulai Penggunaan Fasilitas *
                </label>
                <input
                  type="datetime-local"
                  required
                  min={`${minDate}T00:00`}
                  value={usageStart}
                  onChange={(e) => setUsageStart(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <span className="text-[11px] text-slate-500">Persiapan & muat alat (paling awal 06:00 WIB)</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2. Mulai Acara Resmi *
                </label>
                <input
                  type="datetime-local"
                  required
                  min={`${minDate}T00:00`}
                  value={eventStart}
                  onChange={(e) => setEventStart(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <span className="text-[11px] text-slate-500">Waktu acara resmi dibuka</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  3. Selesai Acara Resmi *
                </label>
                <input
                  type="datetime-local"
                  required
                  min={`${minDate}T00:00`}
                  value={eventEnd}
                  onChange={(e) => setEventEnd(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <span className="text-[11px] text-slate-500">Waktu acara resmi selesai</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  4. Selesai Penggunaan Fasilitas *
                </label>
                <input
                  type="datetime-local"
                  required
                  min={`${minDate}T00:00`}
                  value={usageEnd}
                  onChange={(e) => setUsageEnd(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <span className="text-[11px] text-slate-500">Bersih-bersih & serah kunci (maks. 18:30 WIB)</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => handleNextStep(2)}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-xs cursor-pointer flex items-center gap-2"
              >
                <span>Lanjut ke Tahap 2: Informasi & Kebutuhan</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAHAP 2: INFORMASI, DESKRIPSI, BARANG, SUSUNAN PANITIA & RUNDOWN
            ========================================================================= */}
        {step === 2 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-8 animate-in fade-in duration-150">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Tahap 2 dari 3
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                Informasi Kegiatan, Lampiran Barang, Panitia & Rundown
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Lengkapi rincian kegiatan, sesuaikan jumlah barang yang dibutuhkan, serta cantumkan susunan panitia dan rundown acara.
              </p>
            </div>

            {/* Nama Kegiatan, Perihal, Deskripsi */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nama / Tajuk Kegiatan *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masukkan nama / tajuk kegiatan resmi"
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Perihal / Tujuan Peminjaman *
                </label>
                <input
                  type="text"
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Perihal dan tujuan peminjaman fasilitas"
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Deskripsi Kegiatan *
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan ringkasan agenda, target peserta, dan rangkaian kegiatan yang akan berlangsung..."
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>
            </div>

            {/* LAMPIRAN BARANG YANG DIBUTUHKAN (TETAPKAN RATA: SPEAKER, KURSI, SOFA, MEJA, DLL) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    📦 Lampiran Barang / Sarana yang Dibutuhkan
                  </h4>
                  <p className="text-xs text-slate-500">
                    Gunakan tombol (+ / -) untuk menambah atau mengurangi jumlah barang yang diperlukan
                  </p>
                </div>
                <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
                  {activeItemsToSubmit.length} barang dipilih
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {inventoryItems.map((item, idx) => {
                  const facilityItems = facilityId ? facilityItemsMap[facilityId] : undefined;
                  const itemStock = facilityItems?.find((fi) => fi.name === item.name)?.quantity;

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border transition flex items-center justify-between ${
                        item.quantity > 0
                          ? "bg-blue-50/70 border-blue-300 shadow-2xs"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.quantity > 0 ? (
                            <span className="text-blue-700 font-semibold">{item.quantity} unit dipinjam</span>
                          ) : (
                            "Tidak dipinjam"
                          )}
                          {itemStock !== undefined && (
                            <span className="block text-[10px] text-slate-400">
                              (Maksimal tersedia: {itemStock} unit)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateItemQty(idx, -1)}
                          disabled={item.quantity <= 0}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm disabled:opacity-40 cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          max={itemStock !== undefined ? itemStock : undefined}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const capped = itemStock !== undefined ? Math.min(itemStock, val) : val;
                            setItemQtyDirect(idx, capped);
                          }}
                          className="w-12 text-center py-1 text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (itemStock !== undefined && item.quantity >= itemStock) return;
                            updateItemQty(idx, 1);
                          }}
                          disabled={itemStock !== undefined && item.quantity >= itemStock}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm disabled:opacity-40 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SUSUNAN PANITIA (NAMA LENGKAP, NIM, PROGRAM STUDI) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    👥 Susunan Panitia Pelaksana
                  </h4>
                  <p className="text-xs text-slate-500">
                    Cantumkan nama lengkap panitia, NIM, dan Program Studi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCommitteeMember}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  + Tambah Panitia
                </button>
              </div>

              <div className="space-y-2.5">
                {committee.map((member, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 items-center"
                  >
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        placeholder="Nama Lengkap Panitia *"
                        value={member.name}
                        onChange={(e) => updateCommittee(idx, "name", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="NIM *"
                        value={member.nim}
                        onChange={(e) => updateCommittee(idx, "nim", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="Program Studi *"
                        value={member.prodi}
                        onChange={(e) => updateCommittee(idx, "prodi", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-1 text-right">
                      {committee.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCommitteeMember(idx)}
                          className="w-7 h-7 rounded-lg text-rose-600 hover:bg-rose-100 font-bold transition inline-flex items-center justify-center cursor-pointer"
                          title="Hapus baris"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SUSUNAN KEGIATAN / RUNDOWN (NAMA KEGIATAN, WAKTU, PENANGGUNG JAWAB) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    ⏱️ Susunan Kegiatan (Rundown Acara)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Nama kegiatan, perkiraan waktu pelaksanaan, dan penanggung jawab mata acara
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addRundownItem}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  + Tambah Susunan
                </button>
              </div>

              <div className="space-y-2.5">
                {rundown.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 items-center"
                  >
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        placeholder="Nama Kegiatan / Sesi *"
                        value={item.agenda}
                        onChange={(e) => updateRundown(idx, "agenda", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="Waktu (e.g. 08:30 - 09:30)"
                        value={item.time}
                        onChange={(e) => updateRundown(idx, "time", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="Penanggung Jawab (PIC)"
                        value={item.pic}
                        onChange={(e) => updateRundown(idx, "pic", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-1 text-right">
                      {rundown.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRundownItem(idx)}
                          className="w-7 h-7 rounded-lg text-rose-600 hover:bg-rose-100 font-bold transition inline-flex items-center justify-center cursor-pointer"
                          title="Hapus baris"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigasi Tahap 2 */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                ← Kembali ke Tahap 1
              </button>
              <button
                type="button"
                onClick={() => handleNextStep(3)}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-xs cursor-pointer flex items-center gap-2"
              >
                <span>Lanjut ke Tahap 3: Penanggung Jawab</span>
                <span>→</span>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAHAP 3: PENANGGUNG JAWAB KEGIATAN & KONTAK WAJIB (TANPA CATATAN KHUSUS)
            ========================================================================= */}
        {step === 3 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in duration-150">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Tahap 3 dari 3
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                Penanggung Jawab Kegiatan
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Lengkapi identitas ketua pelaksana dan ketua organisasi. Kontak (nomor telepon/WhatsApp) <strong>wajib diisi</strong> untuk verifikasi dan konfirmasi peminjaman.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span>🎖️</span>
                  <span>Ketua Pelaksana Kegiatan</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Lengkap Ketua Pelaksana *
                  </label>
                  <input
                    type="text"
                    required
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="Nama lengkap ketua pelaksana"
                    className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kontak WhatsApp / No. HP (Wajib) *
                  </label>
                  <input
                    type="text"
                    required
                    value={leadContact}
                    onChange={(e) => setLeadContact(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                  <span>🏛️</span>
                  <span>Ketua Organisasi (BEM / HIMA / UKM)</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Lengkap Ketua Organisasi *
                  </label>
                  <input
                    type="text"
                    required
                    value={chairName}
                    onChange={(e) => setChairName(e.target.value)}
                    placeholder="Nama lengkap ketua organisasi"
                    className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Kontak WhatsApp / No. HP (Wajib) *
                  </label>
                  <input
                    type="text"
                    required
                    value={chairContact}
                    onChange={(e) => setChairContact(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* RINGKASAN SEBELUM SIMPAN */}
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>ℹ️</span>
                <span>Konfirmasi Akhir Peminjaman:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {mode === "edit"
                  ? "Anda dapat menyimpan perubahan formulir untuk diteliti lagi, atau langsung mengirimkan kembali hasil revisi agar alur persetujuan pejabat kampus berlanjut."
                  : 'Setelah tombol "Simpan Draft & Kunci Slot" ditekan, jadwal peminjaman fasilitas Anda akan langsung ditahan sementara (HOLD) selama 60 menit. Anda dapat memeriksa pratinjau formulir sebelum mengirimkannya ke alur persetujuan pejabat kampus.'}
              </p>
            </div>

            {/* Navigasi Tahap 3 */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                ← Kembali ke Tahap 2
              </button>

              {mode === "edit" ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="submit"
                    name="andSubmit"
                    value="false"
                    disabled={isPending}
                    className="px-4 py-2.5 rounded-xl border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {isPending ? "Menyimpan..." : "Simpan Perubahan Formulir"}
                  </button>
                  <button
                    type="submit"
                    name="andSubmit"
                    value="true"
                    disabled={isPending}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {isPending ? "Menyimpan & Mengirim..." : "Simpan & Kirim Ulang Hasil Revisi →"}
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isPending ? "Menyimpan & Menahan Slot..." : "Simpan Draft & Kunci Slot →"}
                </button>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

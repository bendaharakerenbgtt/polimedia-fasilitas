"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createBookingDraftAction, updateBookingDraftAction } from "@/app/actions/bookings";
import { fmtDateTime, fmtRange, fmtTime, toLocalInput, isWithinOperationalHours, OPERATIONAL_START_TIME, OPERATIONAL_END_TIME } from "@/lib/time";
import type { BookedSlotInfo } from "@/server/bookings";
import { getFacilityImage } from "@/lib/facilityImages";

interface InventoryItemState {
  name: string;
  quantity: number;
  notes: string;
  isCustom?: boolean;
}

interface ParticipantMemberState {
  name: string;
  nim: string;
  delegation: string;
}

interface CommitteeMemberState {
  name: string;
  division?: string;
  nim: string;
  prodi: string;
}

interface OtherPartyState {
  name: string;
  role: string;
  contact: string;
}

interface RundownItemState {
  agenda: string;
  time: string;
  startTime?: string;
  endTime?: string;
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

  // Peserta Kegiatan (Nama, NIM, Delegasi / Asal Utusan) - Opsional
  const [participantsList, setParticipantsList] = useState<ParticipantMemberState[]>(() => {
    if (Array.isArray(initialBooking?.participants) && initialBooking.participants.length > 0) {
      return initialBooking.participants.map((p: any) => ({
        name: p.name || "",
        nim: p.nim || "",
        delegation: p.delegation || "",
      }));
    }
    // Jika ada string tersimpan dari versi sebelumnya
    if (typeof initialBooking?.participants === "string" && initialBooking.participants.trim()) {
      return [{ name: initialBooking.participants, nim: "", delegation: "" }];
    }
    return [{ name: "", nim: "", delegation: "" }];
  });

  // Inisialisasi daftar barang bawaan dari facilityItemsMap jika ada, atau standardItems
  const [inventoryItems, setInventoryItems] = useState<InventoryItemState[]>(() => {
    const fId = initialBooking?.facility_id;
    const baseList = (fId && facilityItemsMap[fId]) || standardItems.map((name) => ({ name, quantity: 0 }));
    const baseNames = new Set(baseList.map((x: any) => x.name));

    const standardLoaded = baseList.map((it: any) => {
      const existing = initialItems.find((x) => x.name === it.name);
      return {
        name: it.name,
        quantity: existing ? existing.quantity : 0,
        notes: existing?.notes || "",
        isCustom: false,
      };
    });

    // Custom items dari initialItems yang tidak ada di fasilitas standar
    const customLoaded = initialItems
      .filter((x) => !baseNames.has(x.name))
      .map((it) => ({
        name: it.name,
        quantity: it.quantity,
        notes: it.notes || "",
        isCustom: true,
      }));

    return [...standardLoaded, ...customLoaded];
  });

  // State input untuk menambah barang baru kustom
  const [customItemName, setCustomItemName] = useState("");
  const [customItemQty, setCustomItemQty] = useState(1);

  // Handler pergantian fasilitas: otomatis sesuaikan daftar barang sesuai fasilitas yang dipilih
  function handleFacilityChange(newFacilityId: string) {
    setFacilityId(newFacilityId);
    const customItemsCurrent = inventoryItems.filter((it) => it.isCustom);
    const facilitySpecificItems = facilityItemsMap[newFacilityId];
    if (facilitySpecificItems && facilitySpecificItems.length > 0) {
      const baseLoaded = facilitySpecificItems.map((it) => {
        const existing = initialItems.find((x) => x.name === it.name);
        return {
          name: it.name,
          quantity: existing ? existing.quantity : 0,
          notes: existing?.notes || "",
          isCustom: false,
        };
      });
      setInventoryItems([...baseLoaded, ...customItemsCurrent]);
    } else {
      const baseLoaded = standardItems.map((name) => {
        const existing = initialItems.find((x) => x.name === name);
        return {
          name,
          quantity: existing ? existing.quantity : 0,
          notes: existing?.notes || "",
          isCustom: false,
        };
      });
      setInventoryItems([...baseLoaded, ...customItemsCurrent]);
    }
  }

  // Panitia (Nama lengkap, Divisi/Bidang, NIM, Program Studi) - Opsional
  const [committee, setCommittee] = useState<CommitteeMemberState[]>(() => {
    if (Array.isArray(initialBooking?.committee) && initialBooking.committee.length > 0) {
      return initialBooking.committee.map((c: any) => ({
        name: c.name || "",
        division: c.division || c.position || "",
        nim: c.nim || "",
        prodi: c.prodi || "",
      }));
    }
    return [{ name: "", division: "", nim: "", prodi: "" }];
  });

  // Delegasi / Pihak Lain yang Terlibat - Opsional
  const [otherParties, setOtherParties] = useState<OtherPartyState[]>(() => {
    if (Array.isArray(initialBooking?.other_parties) && initialBooking.other_parties.length > 0) {
      return initialBooking.other_parties;
    }
    return [];
  });

  // Rundown (Nama kegiatan / Agenda, Waktu mulai-selesai, Penanggung Jawab) - Opsional
  const [rundown, setRundown] = useState<RundownItemState[]>(() => {
    if (Array.isArray(initialBooking?.rundown) && initialBooking.rundown.length > 0) {
      return initialBooking.rundown.map((r: any) => {
        let startTime = r.startTime || "";
        let endTime = r.endTime || "";
        if (!startTime && r.time) {
          const match = r.time.match(/(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})/);
          if (match) {
            startTime = match[1].replace(".", ":");
            endTime = match[2].replace(".", ":");
          }
        }
        return {
          agenda: r.agenda || "",
          time: r.time || "",
          startTime,
          endTime,
          pic: r.pic || "",
        };
      });
    }
    return [{ agenda: "", time: "08:00 - 09:00", startTime: "08:00", endTime: "09:00", pic: "" }];
  });

  // TAHAP 3: PENANGGUNG JAWAB KEGIATAN
  // Opsi ada ketuplak atau tanpa ketuplak (dipimpin langsung ketua organisasi)
  const initialHasLead = Boolean(initialBooking?.lead_name && initialBooking.lead_name !== initialBooking?.chair_name);
  const [hasLead, setHasLead] = useState<boolean>(initialBooking ? initialHasLead : true);
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

  // Helper format tanggal ramah pengguna: "Jumat, 30 Okt 2026"
  function formatReadableDate(dateStr: string) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return "";
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    if (isNaN(dateObj.getTime())) return "";

    const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const fullDays = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return `${fullDays[dateObj.getDay()]}, ${d} ${months[m]} ${y}`;
  }

  // Helper format ringkasan waktu lengkap: "Jum, 30 Okt 2026, 07.00–17.00 WIB"
  function formatScheduleSummary(startDt: string, endDt: string) {
    if (!startDt || !endDt) return "";
    const startDatePart = startDt.split("T")[0];
    const startTimePart = startDt.split("T")[1] || "";
    const endTimePart = endDt.split("T")[1] || "";

    const parts = startDatePart.split("-");
    if (parts.length !== 3) return "";
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    if (isNaN(dateObj.getTime())) return "";

    const shortDays = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const shortMonths = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const dayName = shortDays[dateObj.getDay()];
    const monthName = shortMonths[m];

    const sTime = startTimePart.replace(":", ".");
    const eTime = endTimePart.replace(":", ".");

    return `${dayName}, ${d} ${monthName} ${y}, ${sTime}–${eTime} WIB`;
  }

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

  // Helper peserta kegiatan
  function addParticipantMember() {
    setParticipantsList((prev) => [...prev, { name: "", nim: "", delegation: "" }]);
  }

  function removeParticipantMember(idx: number) {
    setParticipantsList((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateParticipant(idx: number, field: keyof ParticipantMemberState, val: string) {
    setParticipantsList((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p))
    );
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

  // Tambah barang kustom sendiri
  function handleAddCustomItem() {
    const trimmed = customItemName.trim();
    if (!trimmed) {
      alert("Silakan masukkan nama barang yang ingin ditambahkan.");
      return;
    }
    const existingIndex = inventoryItems.findIndex(
      (it) => it.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existingIndex >= 0) {
      updateItemQty(existingIndex, customItemQty || 1);
    } else {
      setInventoryItems((prev) => [
        ...prev,
        {
          name: trimmed,
          quantity: Math.max(1, customItemQty || 1),
          notes: "Barang tambahan fasilitas",
          isCustom: true,
        },
      ]);
    }
    setCustomItemName("");
    setCustomItemQty(1);
  }

  function removeCustomItem(nameToRemove: string) {
    setInventoryItems((prev) => prev.filter((it) => it.name !== nameToRemove));
  }

  // Helper panitia
  function addCommitteeMember() {
    setCommittee((prev) => [...prev, { name: "", division: "", nim: "", prodi: "" }]);
  }

  function removeCommitteeMember(idx: number) {
    setCommittee((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCommittee(idx: number, field: keyof CommitteeMemberState, val: string) {
    setCommittee((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: val } : c))
    );
  }

  // Helper delegasi / pihak lain yang terlibat
  function addOtherParty() {
    setOtherParties((prev) => [...prev, { name: "", role: "", contact: "" }]);
  }

  function removeOtherParty(idx: number) {
    setOtherParties((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateOtherParty(idx: number, field: keyof OtherPartyState, val: string) {
    setOtherParties((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: val } : p))
    );
  }

  // Helper rundown
  function addRundownItem() {
    // Cari waktu selesai dari item sebelumnya jika ada
    const lastItem = rundown[rundown.length - 1];
    let nextStart = lastItem?.endTime || "09:00";
    let nextEnd = "10:00";
    if (nextStart) {
      const [h, m] = nextStart.split(":").map(Number);
      if (!isNaN(h)) {
        const endH = Math.min(23, h + 1);
        nextEnd = `${String(endH).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
      }
    }
    const formattedTime = `${nextStart.replace(":", ".")} – ${nextEnd.replace(":", ".")} WIB`;
    setRundown((prev) => [
      ...prev,
      { agenda: "", time: formattedTime, startTime: nextStart, endTime: nextEnd, pic: "" },
    ]);
  }

  function removeRundownItem(idx: number) {
    setRundown((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateRundown(idx: number, field: keyof RundownItemState, val: string) {
    setRundown((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [field]: val };
        // Jika mengubah startTime atau endTime, otomatis sinkronkan string time tampilan
        if (field === "startTime" || field === "endTime") {
          const s = field === "startTime" ? val : updated.startTime || "";
          const e = field === "endTime" ? val : updated.endTime || "";
          if (s && e) {
            updated.time = `${s.replace(":", ".")} – ${e.replace(":", ".")} WIB`;
          } else if (s) {
            updated.time = `${s.replace(":", ".")} WIB`;
          }
        }
        return updated;
      })
    );
  }

  // Preset durasi cepat per mata acara rundown
  function applyRundownDurationPreset(idx: number, startVal: string, durationMinutes: number) {
    if (!startVal) return;
    const [h, m] = startVal.split(":").map(Number);
    if (isNaN(h)) return;
    const totalMinutes = h * 60 + (m || 0) + durationMinutes;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    const endStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    const formatted = `${startVal.replace(":", ".")} – ${endStr.replace(":", ".")} WIB`;
    setRundown((prev) =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, startTime: startVal, endTime: endStr, time: formatted }
          : r
      )
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
      const activeCommittee = committee.filter((c) => c.name.trim().length > 0);
      if (activeCommittee.length === 0) {
        alert("Susunan Panitia Pelaksana wajib diisi minimal 1 orang.");
        return;
      }
      const activeRundown = rundown.filter((r) => r.agenda.trim().length > 0);
      if (activeRundown.length === 0) {
        alert("Susunan Kegiatan (Rundown Acara) wajib diisi minimal 1 mata acara.");
        return;
      }
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Filter data untuk dikirim
  const activeItemsToSubmit = inventoryItems.filter((it) => it.quantity > 0);
  const activeParticipantsToSubmit = participantsList.filter((p) => p.name.trim().length > 0);
  const activeCommitteeToSubmit = committee.filter((c) => c.name.trim().length > 0);
  const activeOtherPartiesToSubmit = otherParties.filter((p) => p.name.trim().length > 0);
  const activeRundownToSubmit = rundown.filter((r) => r.agenda.trim().length > 0);

  // Penanggung jawab efektif: jika hasLead dimatikan, otomatis fallback ke Ketua Organisasi
  const effectiveLeadName = hasLead ? leadName : chairName;
  const effectiveLeadContact = hasLead ? leadContact : chairContact;

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
        <input type="hidden" name="participantsJson" value={JSON.stringify(activeParticipantsToSubmit)} />
        <input type="hidden" name="leadName" value={effectiveLeadName} />
        <input type="hidden" name="leadContact" value={effectiveLeadContact} />
        <input type="hidden" name="chairName" value={chairName} />
        <input type="hidden" name="chairContact" value={chairContact} />
        <input type="hidden" name="itemsJson" value={JSON.stringify(activeItemsToSubmit)} />
        <input type="hidden" name="committeeJson" value={JSON.stringify(activeCommitteeToSubmit)} />
        <input type="hidden" name="otherPartiesJson" value={JSON.stringify(activeOtherPartiesToSubmit)} />
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

              {/* Preview Landscape Foto Fasilitas Terpilih */}
              {selectedFacilityObj && (
                <div className="mt-3 relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 group h-40 sm:h-48 shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getFacilityImage(selectedFacilityObj.name).imageUrl}
                    alt={selectedFacilityObj.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex flex-col justify-end p-4">
                    <span className="w-fit px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                      Fasilitas Terpilih
                    </span>
                    <h4 className="text-white font-extrabold text-base sm:text-lg">
                      {selectedFacilityObj.name}
                    </h4>
                    <p className="text-slate-300 text-xs">
                      📍 {selectedFacilityObj.location || selectedFacilityObj.category}
                    </p>
                  </div>
                </div>
              )}
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
            <div className="bg-gradient-to-br from-purple-50/70 to-blue-50/60 border border-purple-200/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                  <span className="text-amber-500 text-sm">⚡</span>
                  <span>Pengisian Cepat Waktu Acara</span>
                </span>
                <span className="text-[11px] text-purple-800 font-semibold bg-white/80 border border-purple-200 px-2.5 py-0.5 rounded-full w-fit">
                  Aturan: Min. H-3 Acara
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                Pilih tanggal kegiatan, lalu klik preset jam di bawah untuk mengisi jadwal persiapan, acara, hingga bersih-bersih secara otomatis:
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="sm:w-64 space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
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
                    className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-purple-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-purple-500 outline-none shadow-2xs"
                  />
                  {shortcutDate && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-purple-900 bg-purple-100/80 px-2.5 py-1 rounded-lg border border-purple-200 mt-1">
                      <span>📅</span>
                      <span>{formatReadableDate(shortcutDate)}</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Pilihan Preset Jam:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!shortcutDate}
                      onClick={() => applyTimePreset(shortcutDate, "PAGI_SIANG")}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs ${
                        shortcutTimeSlot === "PAGI_SIANG"
                          ? "bg-purple-800 text-amber-300 border-purple-900 shadow-xs font-extrabold"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-purple-50 hover:text-purple-900"
                      }`}
                    >
                      Pagi – Siang (08:00 – 12:00)
                    </button>
                    <button
                      type="button"
                      disabled={!shortcutDate}
                      onClick={() => applyTimePreset(shortcutDate, "SIANG_SORE")}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs ${
                        shortcutTimeSlot === "SIANG_SORE"
                          ? "bg-purple-800 text-amber-300 border-purple-900 shadow-xs font-extrabold"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-purple-50 hover:text-purple-900"
                      }`}
                    >
                      Siang – Sore (13:00 – 17:00)
                    </button>
                    <button
                      type="button"
                      disabled={!shortcutDate}
                      onClick={() => applyTimePreset(shortcutDate, "SEHARIAN")}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs ${
                        shortcutTimeSlot === "SEHARIAN"
                          ? "bg-purple-800 text-amber-300 border-purple-900 shadow-xs font-extrabold"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-purple-50 hover:text-purple-900"
                      }`}
                    >
                      Seharian Penuh (08:00 – 16:00)
                    </button>
                  </div>
                </div>
              </div>

              {/* Ringkasan Jadwal Otomatis yang Terbentuk */}
              {usageStart && usageEnd && (
                <div className="pt-3 border-t border-purple-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-600">Total Waktu Penggunaan:</span>
                    <strong className="text-purple-950 font-extrabold bg-white px-2.5 py-1 rounded-lg border border-purple-200 shadow-2xs">
                      {formatScheduleSummary(usageStart, usageEnd)}
                    </strong>
                  </div>
                  {eventStart && eventEnd && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span>Waktu Acara Utama:</span>
                      <strong className="text-slate-800">
                        {eventStart.split("T")[1]?.replace(":", ".")} – {eventEnd.split("T")[1]?.replace(":", ".")} WIB
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* JAM OPERASIONAL INFO BANNER */}
            <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl text-xs text-purple-950 flex items-start sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold">Jam Operasional Perizinan Fasilitas Kampus:</span>{" "}
                <span>Pukul <strong>06:00 s.d. 18:30 WIB</strong> pada hari yang sama.</span>
              </div>
              <span className="text-[11px] font-semibold bg-purple-200/80 text-purple-900 px-2 py-0.5 rounded shrink-0">
                WIB (UTC+7)
              </span>
            </div>

            {/* DETAIL INPUT DATETIME-LOCAL DENGAN TOOLTIP LENGKAP */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* 1. Mulai Penggunaan Fasilitas */}
              <div className="bg-slate-50/60 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>1. Mulai Penggunaan Fasilitas *</span>
                  </label>
                  {/* Tooltip Icon */}
                  <div className="relative group cursor-pointer inline-flex items-center">
                    <span className="w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-800 flex items-center justify-center text-xs font-bold transition">
                      ?
                    </span>
                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl z-20 pointer-events-none leading-relaxed border border-slate-800">
                      <strong className="block text-amber-300 font-extrabold mb-1">Mulai Penggunaan Fasilitas:</strong>
                      Waktu pertama kali masuk ke ruangan/gedung untuk persiapan, bongkar muat logistik, gladi resik, dan dekorasi (paling awal 06:00 WIB).
                    </div>
                  </div>
                </div>

                <input
                  type="datetime-local"
                  required
                  min={`${minDate}T00:00`}
                  value={usageStart}
                  onChange={(e) => setUsageStart(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-600 font-mono shadow-2xs"
                />
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Persiapan, gladi & muat alat</span>
                  {usageStart && (
                    <span className="text-purple-800 font-bold">
                      {formatReadableDate(usageStart.split("T")[0])}
                    </span>
                  )}
                </div>
              </div>

              {/* 2. Mulai Acara Resmi */}
              <div className="bg-slate-50/60 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>2. Mulai Acara Resmi *</span>
                  </label>
                  {/* Tooltip Icon */}
                  <div className="relative group cursor-pointer inline-flex items-center">
                    <span className="w-5 h-5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-800 flex items-center justify-center text-xs font-bold transition">
                      ?
                    </span>
                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl z-20 pointer-events-none leading-relaxed border border-slate-800">
                      <strong className="block text-blue-300 font-extrabold mb-1">Mulai Acara Resmi:</strong>
                      Waktu acara utama dibuka untuk peserta/undangan. Jam ini yang akan <strong>didisplay di portal publik kampus & kalender agenda</strong>.
                    </div>
                  </div>
                </div>

                <input
                  type="datetime-local"
                  required
                  min={`${minDate}T00:00`}
                  value={eventStart}
                  onChange={(e) => setEventStart(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 font-mono shadow-2xs"
                />
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Waktu acara resmi dibuka (tampil di publik)</span>
                  {eventStart && (
                    <span className="text-blue-800 font-bold">
                      {formatReadableDate(eventStart.split("T")[0])}
                    </span>
                  )}
                </div>
              </div>

              {/* 3. Selesai Acara Resmi */}
              <div className="bg-slate-50/60 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>3. Selesai Acara Resmi *</span>
                  </label>
                  {/* Tooltip Icon */}
                  <div className="relative group cursor-pointer inline-flex items-center">
                    <span className="w-5 h-5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-800 flex items-center justify-center text-xs font-bold transition">
                      ?
                    </span>
                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl z-20 pointer-events-none leading-relaxed border border-slate-800">
                      <strong className="block text-blue-300 font-extrabold mb-1">Selesai Acara Resmi:</strong>
                      Waktu penutupan kegiatan utama dan peserta meninggalkan ruangan. Jam ini yang <strong>didisplay di portal publik</strong> sebagai batas akhir kegiatan.
                    </div>
                  </div>
                </div>

                <input
                  type="datetime-local"
                  required
                  min={`${minDate}T00:00`}
                  value={eventEnd}
                  onChange={(e) => setEventEnd(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-600 font-mono shadow-2xs"
                />
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Waktu acara resmi ditutup</span>
                  {eventEnd && (
                    <span className="text-blue-800 font-bold">
                      {formatReadableDate(eventEnd.split("T")[0])}
                    </span>
                  )}
                </div>
              </div>

              {/* 4. Selesai Penggunaan Fasilitas */}
              <div className="bg-slate-50/60 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>4. Selesai Penggunaan Fasilitas *</span>
                  </label>
                  {/* Tooltip Icon */}
                  <div className="relative group cursor-pointer inline-flex items-center">
                    <span className="w-5 h-5 rounded-full bg-purple-100 hover:bg-purple-200 text-purple-800 flex items-center justify-center text-xs font-bold transition">
                      ?
                    </span>
                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-64 p-3 bg-slate-900 text-white text-[11px] rounded-xl shadow-xl z-20 pointer-events-none leading-relaxed border border-slate-800">
                      <strong className="block text-amber-300 font-extrabold mb-1">Selesai Penggunaan Fasilitas:</strong>
                      Waktu akhir setelah selesai bersih-bersih (clear area), pengembalian perlengkapan/inventaris, dan penyerahan kunci ke satpam (maks. 18:30 WIB).
                    </div>
                  </div>
                </div>

                <input
                  type="datetime-local"
                  required
                  min={`${minDate}T00:00`}
                  value={usageEnd}
                  onChange={(e) => setUsageEnd(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-600 font-mono shadow-2xs"
                />
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Bersih-bersih & serah kunci (maks. 18:30 WIB)</span>
                  {usageEnd && (
                    <span className="text-purple-800 font-bold">
                      {formatReadableDate(usageEnd.split("T")[0])}
                    </span>
                  )}
                </div>
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
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Nama / Tajuk Kegiatan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masukkan nama / tajuk kegiatan resmi"
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Perihal / Tujuan Peminjaman <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Perihal dan tujuan peminjaman fasilitas"
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Deskripsi Kegiatan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Jelaskan ringkasan agenda dan rangkaian kegiatan yang akan berlangsung..."
                  className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 shadow-2xs"
                ></textarea>
              </div>
            </div>

            {/* DAFTAR PESERTA KEGIATAN (NAMA, NIM, DELEGASI) - OPSIONAL */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-slate-900">
                      🎓 Peserta Kegiatan
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300 uppercase tracking-wide">
                      Opsional
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Cantumkan nama lengkap peserta kegiatan, NIM, serta delegasi / asal utusan (kelas/jurusan/lembaga).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addParticipantMember}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                >
                  + Tambah Peserta
                </button>
              </div>

              <div className="space-y-2.5">
                {participantsList.map((participant, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50/60 p-3 rounded-xl border border-slate-200 items-center hover:bg-slate-50 transition"
                  >
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        placeholder="Nama Lengkap Peserta (Opsional)"
                        value={participant.name}
                        onChange={(e) => updateParticipant(idx, "name", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="NIM Peserta"
                        value={participant.nim}
                        onChange={(e) => updateParticipant(idx, "nim", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="Delegasi / Asal Utusan (e.g. HIMA D3, Kelas A)"
                        value={participant.delegation}
                        onChange={(e) => updateParticipant(idx, "delegation", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-1 text-right">
                      {participantsList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeParticipantMember(idx)}
                          className="w-7 h-7 rounded-lg text-rose-600 hover:bg-rose-100 font-bold transition inline-flex items-center justify-center cursor-pointer"
                          title="Hapus baris peserta"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* LAMPIRAN BARANG YANG DIBUTUHKAN & TAMBAH BARANG LAINNYA */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <span>📦 Lampiran Barang & Sarana Fasilitas</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wide">
                      Tersedia & Tambahan
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Gunakan tombol (+ / -) untuk sarana ruangan, atau tambahkan barang sarana lainnya jika tidak ada di daftar.
                  </p>
                </div>
                <span className="text-xs font-bold bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-200 w-fit">
                  {activeItemsToSubmit.length} barang dipilih
                </span>
              </div>

              {/* Grid Barang Standar & Tambahan */}
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
                      <div className="pr-2 flex-1">
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>{item.name}</span>
                          {item.isCustom && (
                            <span className="text-[9px] font-extrabold bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded border border-slate-300">
                              Tambahan
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.quantity > 0 ? (
                            <span className="text-blue-700 font-semibold">
                              {item.quantity} unit dipinjam
                            </span>
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

                      <div className="flex items-center gap-1.5 shrink-0">
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
                        {item.isCustom && (
                          <button
                            type="button"
                            onClick={() => removeCustomItem(item.name)}
                            className="w-6 h-6 rounded text-rose-500 hover:bg-rose-100 flex items-center justify-center text-xs font-bold cursor-pointer"
                            title="Hapus barang tambahan"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Form Tambah Barang / Sarana Lainnya */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📦</span>
                  <span className="text-xs font-extrabold text-slate-800">
                    Tambah Barang / Sarana Lainnya:
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <input
                    type="text"
                    placeholder="Nama barang sarana lainnya (e.g. Kabel Roll 20M, Mic Wireless, Podium, Flipchart...)"
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white px-2.5 py-1.5 border border-slate-300 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-600">Qty:</span>
                      <input
                        type="number"
                        min="1"
                        value={customItemQty}
                        onChange={(e) => setCustomItemQty(Math.max(1, Number(e.target.value)))}
                        className="w-12 text-center text-xs font-bold text-slate-900 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomItem}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                    >
                      + Tambah Barang
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Barang yang Anda tambahkan sendiri akan otomatis dimasukkan ke dalam daftar lampiran sarana peminjaman fasilitas.
                </p>
              </div>
            </div>

            {/* SUSUNAN PANITIA PELAKSANA - WAJIB */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-slate-900">
                      👥 Susunan Panitia Pelaksana <span className="text-rose-500">*</span>
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wide">
                      Wajib Diisi
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Wajib diisi minimal 1 anggota panitia (nama lengkap, divisi / seksi, NIM, dan Program Studi).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCommitteeMember}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                >
                  + Tambah Panitia
                </button>
              </div>

              <div className="space-y-2.5">
                {committee.map((member, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50/60 p-3 rounded-xl border border-slate-200 items-center hover:bg-slate-50 transition"
                  >
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        placeholder="Nama Lengkap Panitia *"
                        value={member.name}
                        onChange={(e) => updateCommittee(idx, "name", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="Divisi / Bidang"
                        value={member.division || ""}
                        onChange={(e) => updateCommittee(idx, "division", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="NIM"
                        value={member.nim}
                        onChange={(e) => updateCommittee(idx, "nim", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        placeholder="Program Studi"
                        value={member.prodi}
                        onChange={(e) => updateCommittee(idx, "prodi", e.target.value)}
                        className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-1 text-right">
                      {committee.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCommitteeMember(idx)}
                          className="w-7 h-7 rounded-lg text-rose-600 hover:bg-rose-100 font-bold transition inline-flex items-center justify-center cursor-pointer"
                          title="Hapus baris panitia"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DELEGASI / PIHAK LAIN YANG TERLIBAT - OPSIONAL */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-slate-900">
                      🤝 Delegasi / Pihak Eksternal yang Terlibat
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300 uppercase tracking-wide">
                      Opsional
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Bila kegiatan melibatkan pengisi acara eksternal, pemateri, juri lomba, atau perwakilan sponsor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addOtherParty}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                >
                  + Tambah Delegasi
                </button>
              </div>

              {otherParties.length === 0 ? (
                <div className="p-3 bg-slate-50/60 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                  Belum ada delegasi/pihak eksternal yang ditambahkan. Klik <strong>+ Tambah Delegasi</strong> bila kegiatan Anda melibatkan pihak luar.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {otherParties.map((party, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50/60 p-3 rounded-xl border border-slate-200 items-center hover:bg-slate-50 transition"
                    >
                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          placeholder="Nama Pihak / Instansi (Opsional)"
                          value={party.name}
                          onChange={(e) => updateOtherParty(idx, "name", e.target.value)}
                          className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          placeholder="Peran (e.g. Pemateri, Juri, Sponsor)"
                          value={party.role}
                          onChange={(e) => updateOtherParty(idx, "role", e.target.value)}
                          className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          type="text"
                          placeholder="Kontak HP / Email"
                          value={party.contact}
                          onChange={(e) => updateOtherParty(idx, "contact", e.target.value)}
                          className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="sm:col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() => removeOtherParty(idx)}
                          className="w-7 h-7 rounded-lg text-rose-600 hover:bg-rose-100 font-bold transition inline-flex items-center justify-center cursor-pointer"
                          title="Hapus baris delegasi"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SUSUNAN KEGIATAN / RUNDOWN (FORMAT JAM MUDAH DIISI, TIDAK MANUAL) - WAJIB */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-slate-900">
                      ⏱️ Susunan Kegiatan (Rundown Acara) <span className="text-rose-500">*</span>
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wide">
                      Wajib Diisi
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Wajib diisi minimal 1 agenda. Pilih jam mulai & selesai agar waktu tersusun rapi otomatis, serta nama agenda dan PIC.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addRundownItem}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer shrink-0"
                >
                  + Tambah Susunan
                </button>
              </div>

              <div className="space-y-3">
                {rundown.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2.5 hover:bg-slate-50 transition"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      <div className="sm:col-span-5">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Nama Kegiatan / Sesi Acara <span className="text-rose-500">*</span>:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Pembukaan & Sambutan Ketua *"
                          value={item.agenda}
                          onChange={(e) => updateRundown(idx, "agenda", e.target.value)}
                          className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      {/* Time Picker Mulai & Selesai yang otomatis membentuk format rapi */}
                      <div className="sm:col-span-4 space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700">
                          Waktu Pelaksanaan (Mulai – Selesai):
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="time"
                            value={item.startTime || ""}
                            onChange={(e) => updateRundown(idx, "startTime", e.target.value)}
                            className="w-1/2 px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-slate-400 font-bold">–</span>
                          <input
                            type="time"
                            value={item.endTime || ""}
                            onChange={(e) => updateRundown(idx, "endTime", e.target.value)}
                            className="w-1/2 px-2.5 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          PIC / Pemateri:
                        </label>
                        <input
                          type="text"
                          placeholder="Nama PIC"
                          value={item.pic}
                          onChange={(e) => updateRundown(idx, "pic", e.target.value)}
                          className="w-full px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="sm:col-span-1 text-right pt-4 sm:pt-0">
                        {rundown.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRundownItem(idx)}
                            className="w-7 h-7 rounded-lg text-rose-600 hover:bg-rose-100 font-bold transition inline-flex items-center justify-center cursor-pointer"
                            title="Hapus baris susunan acara"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Ringkasan waktu otomatis & tombol durasi cepat */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <span className="font-semibold text-slate-500">Tampilan Waktu:</span>
                        <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-300">
                          {item.time || (item.startTime && item.endTime ? `${item.startTime.replace(":", ".")} – ${item.endTime.replace(":", ".")} WIB` : "Belum diatur")}
                        </span>
                      </div>

                      {/* Tombol preset durasi cepat (30 mnt, 45 mnt, 60 mnt, 90 mnt, 120 mnt) */}
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[10px]">Set Durasi:</span>
                        <button
                          type="button"
                          onClick={() => applyRundownDurationPreset(idx, item.startTime || "08:00", 30)}
                          className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium cursor-pointer"
                        >
                          +30m
                        </button>
                        <button
                          type="button"
                          onClick={() => applyRundownDurationPreset(idx, item.startTime || "08:00", 45)}
                          className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium cursor-pointer"
                        >
                          +45m
                        </button>
                        <button
                          type="button"
                          onClick={() => applyRundownDurationPreset(idx, item.startTime || "08:00", 60)}
                          className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium cursor-pointer"
                        >
                          +1 jam
                        </button>
                        <button
                          type="button"
                          onClick={() => applyRundownDurationPreset(idx, item.startTime || "08:00", 90)}
                          className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium cursor-pointer"
                        >
                          +1.5 jam
                        </button>
                        <button
                          type="button"
                          onClick={() => applyRundownDurationPreset(idx, item.startTime || "08:00", 120)}
                          className="px-2 py-0.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-medium cursor-pointer"
                        >
                          +2 jam
                        </button>
                      </div>
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

            <div className="space-y-4">
              {/* Opsi / Checkbox Pilihan Ada Ketuplak vs Tanpa Ketuplak */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-extrabold text-xs text-slate-800 block">
                    Penetapan Ketua Pelaksana Kegiatan
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Awalnya disediakan ketua pelaksana khusus, namun kegiatan dapat diajukan tanpa ketua pelaksana (dipimpin langsung oleh Ketua Organisasi).
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer shrink-0 bg-white px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 select-none shadow-2xs">
                  <input
                    type="checkbox"
                    checked={hasLead}
                    onChange={(e) => setHasLead(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Ada Ketua Pelaksana Khusus
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* 1. KETUA PELAKSANA (JIKA ADA) */}
                {hasLead ? (
                  <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4 animate-in fade-in duration-150">
                    <div className="font-extrabold text-slate-900 text-sm flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span>🎖️</span>
                        <span>Ketua Pelaksana Kegiatan</span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        Opsional Diaktifkan
                      </span>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Nama Lengkap Ketua Pelaksana
                      </label>
                      <input
                        type="text"
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                        placeholder="Nama lengkap ketua pelaksana (opsional)"
                        className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Kontak WhatsApp / No. HP Ketuplak
                      </label>
                      <input
                        type="text"
                        value={leadContact}
                        onChange={(e) => setLeadContact(e.target.value)}
                        placeholder="08xxxxxxxxxx (opsional)"
                        className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-purple-50/70 p-5 rounded-2xl border border-purple-200/80 flex flex-col justify-center space-y-2 text-xs text-purple-950 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 font-bold text-sm text-purple-900">
                      <span>✓</span>
                      <span>Tanpa Ketua Pelaksana Khusus</span>
                    </div>
                    <p className="text-[11px] text-purple-800 leading-relaxed">
                      Kegiatan ini dipimpin dan dipertanggungjawabkan langsung oleh <strong>Ketua Organisasi</strong>. Data kontak Ketua Organisasi di sebelah kanan otomatis menjadi penanggung jawab resmi peminjaman fasilitas.
                    </p>
                  </div>
                )}

                {/* 2. KETUA ORGANISASI (UTAMA & WAJIB) */}
                <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="font-extrabold text-slate-900 text-sm flex items-center justify-between border-b border-slate-200 pb-2">
                    <div className="flex items-center gap-2">
                      <span>🏛️</span>
                      <span>Ketua Organisasi (BEM / HIMA / UKM)</span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      Penanggung Jawab Utama *
                    </span>
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
                      placeholder="Nama lengkap ketua organisasi pemohon"
                      className="w-full px-3.5 py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Kontak WhatsApp / No. HP (Wajib Konfirmasi) *
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

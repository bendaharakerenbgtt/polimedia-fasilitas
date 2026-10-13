"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveBookingAction } from "@/app/actions/bookings";

export default function MarkReadArchiveButton({
  bookingId,
  isArchived,
}: {
  bookingId: string;
  isArchived: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (isArchived) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-100/70 px-3 py-1.5 rounded-lg border border-emerald-200 w-fit">
        <span>✓</span>
        <span>Sudah ditandai dibaca & diarsipkan ke Histori Pengajuan</span>
      </div>
    );
  }

  async function handleArchive() {
    setLoading(true);
    await archiveBookingAction(bookingId);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="mt-3.5 pt-3 border-t border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <p className="text-[11px] text-rose-700">
        Klik tombol ini setelah Anda membaca alasan penolakan agar pengajuan dipindahkan dari Beranda ke <strong>Histori Pengajuan</strong>.
      </p>
      <button
        type="button"
        onClick={handleArchive}
        disabled={loading}
        className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold transition shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
      >
        <span>✓</span>
        <span>{loading ? "Menyimpan..." : "Tandai Sudah Dibaca & Pindahkan ke Histori"}</span>
      </button>
    </div>
  );
}

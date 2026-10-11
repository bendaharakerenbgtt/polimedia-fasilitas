import { requireUser } from "@/server/auth";
import { getFacilitiesAdmin } from "@/server/admin";
import FacilityManager from "./FacilityManager";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminFacilitiesPage() {
  await requireUser(["ADMIN", "SUBBAG_UMUM"]);
  const facilities = await getFacilitiesAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition shadow-2xs"
            >
              <span>←</span>
              <span>Kembali ke Dashboard</span>
            </Link>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Manajemen Fasilitas & Ruangan Kampus
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Kelola data gedung, ruangan, kelas, laboratorium, dan sarana prasarana yang dapat dipinjam
          </p>
        </div>
      </div>

      <FacilityManager facilities={facilities} />
    </div>
  );
}

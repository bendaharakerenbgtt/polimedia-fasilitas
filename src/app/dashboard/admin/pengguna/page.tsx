import { requireUser } from "@/server/auth";
import { getUsersAdmin, getOrganizationsAdmin } from "@/server/admin";
import { query } from "@/server/db";
import UserManager from "./UserManager";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireUser(["ADMIN"]);
  const [users, organizations, prodis] = await Promise.all([
    getUsersAdmin(),
    getOrganizationsAdmin(),
    query<{ id: string; name: string }>(`SELECT id, name FROM prodi WHERE active ORDER BY name`),
  ]);

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
            Manajemen Pengguna & Organisasi
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Kelola akun pengguna, reset kredensial kepengurusan organisasi, dan tetapkan dosen pembina
          </p>
        </div>
      </div>

      <UserManager users={users} organizations={organizations} prodis={prodis} />
    </div>
  );
}

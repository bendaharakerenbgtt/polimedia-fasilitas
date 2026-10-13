import Link from "next/link";
import { requireUser } from "@/server/auth";
import { LogoutButton } from "./LogoutButton";
import { query } from "@/server/db";
import { ROLE_LABEL } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  // Ambil jumlah notifikasi belum dibaca
  const unreadRows = await query<{ count: string }>(
    `SELECT count(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
    [user.id]
  );
  const unreadCount = Number(unreadRows[0]?.count ?? 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar Dashboard */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/dashboard" className="flex items-center space-x-2.5">
              <span className="w-8 h-8 rounded-lg bg-purple-900 text-amber-400 border border-amber-500/30 flex items-center justify-center font-extrabold text-sm shadow-xs">
                PM
              </span>
              <span className="font-extrabold text-slate-900 text-sm sm:text-base hidden sm:inline tracking-tight">
                PoliMedia <span className="text-purple-800 font-bold">Fasilitas</span>
              </span>
            </Link>

            <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm font-medium text-slate-600">
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition font-semibold"
              >
                Beranda
              </Link>
              <Link
                href="/dashboard/aktivitas"
                className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition font-semibold"
              >
                Histori Pengajuan
              </Link>
              {(user.role === "ADMIN" || user.role === "SUBBAG_UMUM") && (
                <Link
                  href="/dashboard/admin/fasilitas"
                  className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition"
                >
                  Fasilitas
                </Link>
              )}
              {user.role === "ADMIN" && (
                <>
                  <Link
                    href="/dashboard/admin/pengguna"
                    className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition"
                  >
                    Pengguna
                  </Link>
                  <Link
                    href="/dashboard/admin/pengaturan"
                    className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition"
                  >
                    Pengaturan
                  </Link>
                  <Link
                    href="/dashboard/admin/audit"
                    className="px-2.5 py-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition"
                  >
                    Audit
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-900">{user.displayName}</div>
              {user.role !== "ORG" && (
                <div className="text-[11px] text-slate-500 font-medium">
                  {ROLE_LABEL[user.role]}
                </div>
              )}
            </div>

            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Konten Halaman */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {children}
      </main>
    </div>
  );
}

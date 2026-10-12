import Link from "next/link";
import { getPublicConfirmedSchedules } from "@/server/public";
import { fmtRange, fmtDate, fmtTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const schedules = await getPublicConfirmedSchedules();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
      {/* Header Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-blue-700 text-white flex items-center justify-center font-bold text-xl shadow-xs">
              PM
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                PoliMedia Event & Fasilitas
              </h1>
              <p className="text-xs text-slate-500">Agenda Kegiatan Mahasiswa & Civitas Kampus</p>
            </div>
          </div>
          <div className="flex items-center space-x-2.5">
            <Link
              href="/petugas"
              className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-semibold rounded-lg text-slate-800 bg-white hover:bg-slate-100 transition shadow-2xs border border-slate-300"
              title="Portal Khusus Petugas Lapangan, Satpam, dan Tim Kebersihan (OB)"
            >
              <span>Portal Satpam & OB</span>
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition shadow-xs"
            >
              Portal Masuk / Login →
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white py-12 px-4 sm:px-6 border-b border-slate-800">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold rounded-full border border-blue-400/30">
            Agenda Resmi Kampus PoliMedia
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Ada Acara Apa Saja di Kampus PoliMedia?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            Forum informasi publik untuk seluruh mahasiswa. Cek agenda kegiatan, seminar, pameran, 
            dan workshop resmi yang diselenggarakan oleh UKM, HIMA, BEM, MPM, dan program studi.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/petugas"
              className="inline-flex items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl shadow-xs border border-slate-700 transition"
            >
              <span>Portal Lapangan Satpam & Tim Kebersihan (OB) →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content: Fokus ke Event Kampus */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900">Daftar Agenda Kegiatan Resmi</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Hanya menampilkan kegiatan yang telah disetujui resmi oleh pimpinan kampus
            </p>
          </div>
          <div className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 px-3.5 py-1.5 rounded-full self-start sm:self-auto">
            {schedules.length} Kegiatan Terjadwal
          </div>
        </div>

        {schedules.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-xs space-y-3">
            <span className="text-4xl block">📅</span>
            <p className="text-base font-bold text-slate-800">Belum Ada Agenda Kegiatan Kampus Saat Ini</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Saat organisasi mahasiswa atau prodi mengajukan peminjaman fasilitas dan disetujui oleh Wakil Direktur, 
              agenda acara akan otomatis terbit di sini.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
              >
                Organisasi ingin mengajukan peminjaman? Masuk di sini →
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schedules.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
                      {item.orgName} ({item.orgType})
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      Resmi Disetujui
                    </span>
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-slate-900 leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5">
                      <span>📍 Lokasi:</span>
                      <strong className="text-slate-800">{item.facilityName}</strong>
                      {item.facilityLocation && `(${item.facilityLocation})`}
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Waktu Acara Resmi
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm block">
                      {fmtRange(item.eventStart, item.eventEnd)} WIB
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>PoliMedia Kampus</span>
                  <span className="text-blue-600 font-semibold">Terkonfirmasi</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p>© 2026 Politeknik Negeri Media Kreatif (PoliMedia) • Sistem Peminjaman Fasilitas Kampus</p>
      </footer>
    </div>
  );
}

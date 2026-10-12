"use client";

import { useActionState, useState, useRef } from "react";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

interface FlowAccount {
  label: string;
  role: string;
  username: string;
  badge: string;
  desc: string;
}

interface FlowSection {
  title: string;
  subtitle: string;
  theme: "blue" | "emerald" | "purple";
  accounts: FlowAccount[];
}

const FLOW_TEMPLATES: FlowSection[] = [
  {
    title: "Alur 1: Pemohon Kegiatan",
    subtitle: "Organisasi Mahasiswa (HIMA / UKM / BEM)",
    theme: "blue",
    accounts: [
      {
        label: "HIMA Desain Grafis",
        role: "HIMA (Prodi)",
        username: "hima.dg",
        badge: "HIMA DG",
        desc: "Mengajukan pinjam Lab/Ruang untuk prodi",
      },
      {
        label: "UKM Futsal",
        role: "UKM",
        username: "ukm.futsal",
        badge: "UKM Futsal",
        desc: "Mengajukan pinjam Lapangan/Fasilitas olahraga",
      },
      {
        label: "BEM Polimedia",
        role: "BEM",
        username: "bem",
        badge: "BEM",
        desc: "Mengajukan kegiatan akbar kampus / Hall",
      },
    ],
  },
  {
    title: "Alur 2: Peninjau Ormawa & Akademik",
    subtitle: "Verifikator tingkat awal & legislatif sebelum ke Subbag",
    theme: "emerald",
    accounts: [
      {
        label: "Kaprodi Desain Grafis",
        role: "Kaprodi",
        username: "kaprodi.dg",
        badge: "Kaprodi",
        desc: "Menyetujui usulan permohonan HIMA DG",
      },
      {
        label: "Dosen Pembina UKM Futsal",
        role: "Dosen Pembimbing",
        username: "dosen.futsal",
        badge: "Pembina UKM",
        desc: "Menyetujui usulan permohonan UKM Futsal",
      },
      {
        label: "MPM Polimedia",
        role: "MPM (Legislatif)",
        username: "mpm",
        badge: "MPM",
        desc: "Verifikasi izin HIMA (langsung dari Kaprodi) & UKM",
      },
    ],
  },
  {
    title: "Alur 3: Pengelola & Pengesah",
    subtitle: "Pemeriksa ketersediaan sarpras hingga pimpinan",
    theme: "purple",
    accounts: [
      {
        label: "Subbag Umum & Sarpras",
        role: "Subbag Umum",
        username: "subbag",
        badge: "Subbag Umum",
        desc: "Cek jadwal fasilitas & verifikasi sarpras",
      },
      {
        label: "Wakil Direktur (Wadir)",
        role: "Pimpinan Kampus",
        username: "wadir",
        badge: "Wadir",
        desc: "Persetujuan final & penerbitan izin resmi",
      },
      {
        label: "Administrator Sistem",
        role: "Super Admin",
        username: "admin",
        badge: "Admin",
        desc: "Akses penuh fasilitas, user & audit log",
      },
    ],
  },
];

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleQuickLogin = (uname: string, label: string) => {
    setUsername(uname);
    setPassword("demo12345");
    setActivePreset(label);

    // Auto submit form in next tick so react state is flushed to inputs
    setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 50);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl text-center">
        <Link href="/" className="inline-flex items-center space-x-2 text-blue-700 font-bold text-2xl hover:opacity-90">
          <span>🏛️</span>
          <span>PoliMedia Fasilitas</span>
        </Link>
        <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Masuk ke Akun Anda
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-600">
          Gunakan formulir atau pilih <strong>Template 1-Klik Masuk</strong> di bawah sesuai alur pengujian Anda.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-6 sm:py-8 px-6 shadow-sm rounded-2xl border border-slate-200">
          {state?.error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
              <span>{state.error}</span>
            </div>
          )}

          {activePreset && isPending && (
            <div className="mb-5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium flex items-center space-x-2">
              <span className="animate-spin text-sm">⏳</span>
              <span>Masuk otomatis sebagai <strong>{activePreset}</strong>...</span>
            </div>
          )}

          <form ref={formRef} action={formAction} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Nama Pengguna (Username)
              </label>
              <div className="mt-1.5">
                <input
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="mis. hima.dg, kaprodi.dg, subbag, wadir"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Kata Sandi
              </label>
              <div className="mt-1.5">
                <input
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition disabled:opacity-50"
              >
                {isPending ? "Sedang Memeriksa..." : "Masuk ke Sistem"}
              </button>
            </div>
          </form>

          {/* TEMPLATE 1-KLIK LOGIN BERDASARKAN 3 ALUR */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                <span>⚡</span>
                <span>Template Login Cepat (1-Klik Langsung Masuk)</span>
              </h3>
              <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">
                PW: demo12345
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Klik salah satu akun di bawah untuk otomatis mengisi username & password dan langsung masuk ke dashboard:
            </p>

            <div className="space-y-4">
              {FLOW_TEMPLATES.map((section, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{section.title}</h4>
                      <p className="text-[11px] text-slate-500">{section.subtitle}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {section.accounts.map((acc) => (
                      <button
                        key={acc.username}
                        type="button"
                        onClick={() => handleQuickLogin(acc.username, acc.label)}
                        disabled={isPending}
                        className={`text-left p-2.5 rounded-lg border bg-white transition shadow-2xs hover:shadow-xs group disabled:opacity-50 ${
                          username === acc.username
                            ? "border-blue-500 ring-2 ring-blue-200"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition truncate">
                            {acc.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          @{acc.username}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                          {acc.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs">
          <Link
            href="/petugas"
            className="font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-2xs"
          >
            <span>🛡️</span>
            <span>Petugas Satpam & OB? Cek Jadwal & Rincian Barang di Sini →</span>
          </Link>
          <Link href="/" className="text-slate-500 hover:text-slate-800 transition py-1.5">
            ← Kembali ke Halaman Utama
          </Link>
        </div>
      </div>
    </div>
  );
}

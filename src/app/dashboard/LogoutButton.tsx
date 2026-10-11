"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition shadow-2xs ${
          isPending
            ? "bg-rose-50 border-rose-300 text-rose-600 cursor-wait opacity-80"
            : "text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border-slate-200 hover:border-rose-200 active:scale-95"
        }`}
        title="Keluar dari akun"
      >
        {isPending ? (
          <>
            <svg
              className="animate-spin h-3.5 w-3.5 text-rose-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <span>Keluar...</span>
          </>
        ) : (
          <>
            <svg
              className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span>Keluar</span>
          </>
        )}
      </button>

      {/* Indikator Overlay Animasi Saat Logout */}
      {isPending && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white px-6 py-5 rounded-2xl shadow-2xl border border-slate-100 flex flex-col items-center gap-3 text-center max-w-xs mx-4">
            <div className="relative flex items-center justify-center">
              <div className="w-10 h-10 border-3 border-rose-100 border-t-rose-600 rounded-full animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Sedang Keluar...</h4>
              <p className="text-xs text-slate-500 mt-0.5">Menutup sesi Anda dengan aman</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

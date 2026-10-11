"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSbaAction } from "@/app/actions/sba";

export default function SbaEditor({
  sba,
  booking,
  rundownItems,
  financeItems,
  isOwner,
}: {
  sba: any;
  booking: any;
  rundownItems: any[];
  financeItems: any[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States
  const [docNumber, setDocNumber] = useState(sba.doc_number || "");
  const [description, setDescription] = useState(sba.description || "");
  const [outcomes, setOutcomes] = useState(sba.outcomes || "");
  const [obstacles, setObstacles] = useState(sba.obstacles || "");
  const [evaluation, setEvaluation] = useState(sba.evaluation || "");

  const [finances, setFinances] = useState<any[]>(
    financeItems.length > 0
      ? financeItems.map((f) => ({
          type: f.type,
          category: f.category,
          description: f.description,
          quantity: f.quantity,
          unitPrice: Number(f.unit_price),
        }))
      : [
          { type: "INCOME", category: "KAS", description: "Dana Organisasi / Kampus", quantity: 1, unitPrice: 0 },
          { type: "EXPENSE", category: "KONSUMSI", description: "Snack & Minum", quantity: 1, unitPrice: 0 },
        ]
  );

  const [rundown, setRundown] = useState<any[]>(
    rundownItems.length > 0
      ? rundownItems.map((r) => ({
          agenda: r.agenda,
          actualTime: r.actual_time,
          pic: r.pic,
          notes: r.notes || "",
        }))
      : [{ agenda: "Pembukaan Acara", actualTime: "09:00 - 09:30", pic: "Ketupel", notes: "" }]
  );

  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Perhitungan live frontend (akan divalidasi dan dihitung ulang di server)
  const totalIncome = finances
    .filter((f) => f.type === "INCOME")
    .reduce((sum, f) => sum + (f.quantity || 0) * (f.unitPrice || 0), 0);

  const totalExpense = finances
    .filter((f) => f.type === "EXPENSE")
    .reduce((sum, f) => sum + (f.quantity || 0) * (f.unitPrice || 0), 0);

  const balance = totalIncome - totalExpense;

  async function handleSave(submit = false) {
    setLoading(true);
    setError(null);

    const res = await saveSbaAction(sba.id, booking.id, {
      docNumber,
      description,
      outcomes,
      obstacles,
      evaluation,
      rundown,
      finances,
      submit,
    });

    setLoading(false);
    if (res.error) setError(res.error);
    else {
      alert(submit ? "Laporan SBA berhasil dikirim!" : "Draft SBA berhasil disimpan.");
      router.refresh();
    }
  }

  const isCompleted = sba.status === "COMPLETED";

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
          {error}
        </div>
      )}

      {/* Bagian Pelaksanaan */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
          1. Pelaksanaan & Evaluasi Kegiatan
        </h3>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Nomor Dokumen SBA
          </label>
          <input
            type="text"
            disabled={!isOwner || isCompleted}
            value={docNumber}
            onChange={(e) => setDocNumber(e.target.value)}
            placeholder="mis. SBA/UKM-FOTO/X/2026"
            className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Deskripsi Pelaksanaan
          </label>
          <textarea
            rows={3}
            disabled={!isOwner || isCompleted}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ringkasan bagaimana acara berjalan..."
            className="w-full p-3 border border-slate-300 rounded-lg text-xs"
          ></textarea>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Hasil & Capaian Kegiatan (Output)
          </label>
          <textarea
            rows={2}
            disabled={!isOwner || isCompleted}
            value={outcomes}
            onChange={(e) => setOutcomes(e.target.value)}
            placeholder="Output yang dicapai..."
            className="w-full p-3 border border-slate-300 rounded-lg text-xs"
          ></textarea>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Kendala / Hambatan
            </label>
            <textarea
              rows={2}
              disabled={!isOwner || isCompleted}
              value={obstacles}
              onChange={(e) => setObstacles(e.target.value)}
              placeholder="Kendala di lapangan..."
              className="w-full p-3 border border-slate-300 rounded-lg text-xs"
            ></textarea>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Evaluasi & Rekomendasi
            </label>
            <textarea
              rows={2}
              disabled={!isOwner || isCompleted}
              value={evaluation}
              onChange={(e) => setEvaluation(e.target.value)}
              placeholder="Rekomendasi untuk perbaikan..."
              className="w-full p-3 border border-slate-300 rounded-lg text-xs"
            ></textarea>
          </div>
        </div>
      </div>

      {/* Bagian Keuangan Otomatis */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">2. Laporan Pertanggungjawaban Keuangan</h3>
            <p className="text-xs text-slate-500">Total pemasukan, pengeluaran, dan saldo dihitung secara otomatis</p>
          </div>
          {isOwner && !isCompleted && (
            <button
              onClick={() =>
                setFinances([
                  ...finances,
                  { type: "EXPENSE", category: "UMUM", description: "", quantity: 1, unitPrice: 0 },
                ])
              }
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-3 py-1.5 rounded-lg transition"
            >
              + Tambah Transaksi
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
              <tr>
                <th className="py-2.5 px-3">Tipe</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3">Uraian Transaksi</th>
                <th className="py-2.5 px-3">Jumlah (Qty)</th>
                <th className="py-2.5 px-3">Harga Satuan (Rp)</th>
                <th className="py-2.5 px-3 text-right">Total (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {finances.map((f, idx) => (
                <tr key={idx}>
                  <td className="py-2 px-3">
                    <select
                      disabled={!isOwner || isCompleted}
                      value={f.type}
                      onChange={(e) => {
                        const copy = [...finances];
                        copy[idx].type = e.target.value;
                        setFinances(copy);
                      }}
                      className="border rounded p-1 text-xs"
                    >
                      <option value="INCOME">Pemasukan (+)</option>
                      <option value="EXPENSE">Pengeluaran (-)</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      disabled={!isOwner || isCompleted}
                      value={f.category}
                      onChange={(e) => {
                        const copy = [...finances];
                        copy[idx].category = e.target.value;
                        setFinances(copy);
                      }}
                      placeholder="Kategori"
                      className="border rounded p-1 w-24 text-xs"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      disabled={!isOwner || isCompleted}
                      value={f.description}
                      onChange={(e) => {
                        const copy = [...finances];
                        copy[idx].description = e.target.value;
                        setFinances(copy);
                      }}
                      placeholder="Uraian"
                      className="border rounded p-1 w-full text-xs"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min={1}
                      disabled={!isOwner || isCompleted}
                      value={f.quantity}
                      onChange={(e) => {
                        const copy = [...finances];
                        copy[idx].quantity = Number(e.target.value);
                        setFinances(copy);
                      }}
                      className="border rounded p-1 w-16 text-xs"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min={0}
                      disabled={!isOwner || isCompleted}
                      value={f.unitPrice}
                      onChange={(e) => {
                        const copy = [...finances];
                        copy[idx].unitPrice = Number(e.target.value);
                        setFinances(copy);
                      }}
                      className="border rounded p-1 w-28 text-xs"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-medium text-slate-800">
                    {((f.quantity || 0) * (f.unitPrice || 0)).toLocaleString("id-ID")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ringkasan Rekap Keuangan Otomatis */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <span className="text-[11px] text-slate-500 font-semibold block">Total Pemasukan</span>
            <span className="text-sm font-bold text-emerald-600">
              Rp {totalIncome.toLocaleString("id-ID")}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-semibold block">Total Pengeluaran</span>
            <span className="text-sm font-bold text-rose-600">
              Rp {totalExpense.toLocaleString("id-ID")}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-semibold block">Saldo Akhir</span>
            <span className={`text-sm font-extrabold ${balance >= 0 ? "text-slate-900" : "text-rose-700"}`}>
              Rp {balance.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      {/* Tombol Aksi */}
      {isOwner && !isCompleted && (
        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={() => handleSave(false)}
            disabled={loading}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition"
          >
            {loading ? "Menyimpan..." : "Simpan Draft SBA"}
          </button>
          <button
            onClick={() => setShowSubmitModal(true)}
            disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            {loading ? "Memproses..." : "Kirim Laporan SBA →"}
          </button>
        </div>
      )}

      {/* Modal Modern: Konfirmasi Kirim Laporan SBA */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl border border-slate-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                📑
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Kirim Laporan SBA?</h4>
                <p className="text-xs text-slate-500">Pertanggungjawaban Kegiatan Peminjaman</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              Laporan Pertanggungjawaban (SBA) akan dikirim ke pihak kampus dan pengelola sistem. Pastikan ringkasan kegiatan, realisasi rundown, dan data rincian keuangan sudah sesuai.
            </p>
            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowSubmitModal(false)}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-xl transition"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setShowSubmitModal(false);
                  handleSave(true);
                }}
                disabled={loading}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50"
              >
                {loading ? "Mengirim..." : "Ya, Kirim Laporan SBA"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

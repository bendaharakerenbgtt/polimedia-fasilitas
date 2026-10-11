"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createFacilityAction,
  updateFacilityAction,
  toggleFacilityActiveAction,
  deleteFacilityAction,
} from "@/app/actions/admin";
import type { FacilityData, FacilityItemData } from "@/server/admin";

interface EditableItem {
  id?: string;
  name: string;
  quantity: number;
}

const DEFAULT_STANDARD_ITEMS = [
  { name: "Speaker", quantity: 2 },
  { name: "Kursi", quantity: 50 },
  { name: "Sofa", quantity: 2 },
  { name: "Meja", quantity: 10 },
  { name: "Kursi Operator", quantity: 2 },
  { name: "Meja Operator", quantity: 1 },
];

export default function FacilityManager({
  facilities,
}: {
  facilities: FacilityData[];
}) {
  const router = useRouter();
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editFacility, setEditFacility] = useState<FacilityData | null>(null);

  // Items State for Add Modal
  const [addItems, setAddItems] = useState<EditableItem[]>([...DEFAULT_STANDARD_ITEMS]);

  // Items State for Edit Modal
  const [editItems, setEditItems] = useState<EditableItem[]>([]);

  // Selected Facility to view/manage items in detail
  const [viewItemsFacility, setViewItemsFacility] = useState<FacilityData | null>(null);

  // Categories list
  const categories = Array.from(new Set(facilities.map((f) => f.category)));

  const filteredFacilities = facilities.filter((f) => {
    const matchCat = filterCategory === "ALL" || f.category === filterCategory;
    const matchSearch =
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.location.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  async function handleToggle(id: string) {
    if (!confirm("Ubah status aktif fasilitas ini?")) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const res = await toggleFacilityActiveAction(id);
    setLoading(false);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  async function handleDelete(f: FacilityData) {
    if (
      !confirm(
        `Apakah Anda yakin ingin menghapus fasilitas "${f.name}" (${f.code})?\n\nTindakan ini permanen dan tidak dapat dibatalkan.`
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    const res = await deleteFacilityAction(f.id);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Fasilitas "${f.name}" berhasil dihapus.`);
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    formData.set("items", JSON.stringify(addItems.filter((it) => it.name.trim() !== "")));
    const res = await createFacilityAction(formData);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setShowAddModal(false);
      setAddItems([...DEFAULT_STANDARD_ITEMS]);
      setSuccess("Fasilitas baru berhasil ditambahkan!");
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editFacility) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    formData.set("items", JSON.stringify(editItems.filter((it) => it.name.trim() !== "")));
    const res = await updateFacilityAction(editFacility.id, formData);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setEditFacility(null);
      setSuccess("Data fasilitas & inventaris barang berhasil diperbarui!");
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    }
  }

  // Open edit modal and load facility's items
  function openEditModal(f: FacilityData) {
    setEditFacility(f);
    if (f.items && f.items.length > 0) {
      setEditItems(f.items.map((it) => ({ id: it.id, name: it.name, quantity: it.quantity })));
    } else {
      setEditItems([...DEFAULT_STANDARD_ITEMS]);
    }
  }

  // Helper item manipulation for Add Modal
  function handleAddModalItemChange(index: number, field: "name" | "quantity", val: any) {
    setAddItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, [field]: field === "quantity" ? Math.max(0, Number(val) || 0) : val }
          : item
      )
    );
  }

  function handleAddModalAddItem() {
    setAddItems((prev) => [...prev, { name: "", quantity: 1 }]);
  }

  function handleAddModalRemoveItem(index: number) {
    setAddItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Helper item manipulation for Edit Modal
  function handleEditModalItemChange(index: number, field: "name" | "quantity", val: any) {
    setEditItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, [field]: field === "quantity" ? Math.max(0, Number(val) || 0) : val }
          : item
      )
    );
  }

  function handleEditModalAddItem() {
    setEditItems((prev) => [...prev, { name: "", quantity: 1 }]);
  }

  function handleEditModalRemoveItem(index: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl">
          {success}
        </div>
      )}

      {/* Filter Kategori & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterCategory("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
              filterCategory === "ALL"
                ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Semua ({facilities.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                filterCategory === cat
                  ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat} ({facilities.filter((f) => f.category === cat).length})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Cari fasilitas / gedung..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => {
            setAddItems([...DEFAULT_STANDARD_ITEMS]);
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <span>+</span> Tambah Fasilitas Baru
        </button>
      </div>

      {/* Daftar Fasilitas */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Nama Fasilitas</th>
                <th className="px-6 py-3.5">Kategori & Lokasi</th>
                <th className="px-6 py-3.5">Inventaris Barang</th>
                <th className="px-6 py-3.5">Kapasitas</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFacilities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-400">
                    Tidak ada fasilitas yang sesuai dengan pencarian / filter.
                  </td>
                </tr>
              ) : (
                filteredFacilities.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4">
                      <strong className="text-slate-900 block">{f.name}</strong>
                      <span className="font-mono text-xs text-slate-500">{f.code}</span>
                      {f.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{f.description}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{f.category}</div>
                      <div className="text-xs text-slate-500">{f.location}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(f.items && f.items.length > 0 ? f.items : []).slice(0, 4).map((it) => (
                            <span
                              key={it.id}
                              className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-medium text-slate-700"
                            >
                              <span>{it.name}:</span>
                              <strong className="text-blue-700">{it.quantity}</strong>
                            </span>
                          ))}
                          {(f.items?.length || 0) > 4 && (
                            <span className="text-[11px] text-slate-400 font-semibold self-center">
                              +{f.items!.length - 4} lainnya
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewItemsFacility(f)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold hover:underline block cursor-pointer"
                        >
                          Lihat semua ({f.items?.length || 0} barang) →
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {f.capacity ? `${f.capacity} Orang` : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggle(f.id)}
                        disabled={loading}
                        className={`px-2.5 py-1 text-xs font-bold rounded-full border transition cursor-pointer ${
                          f.active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                        }`}
                      >
                        {f.active ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(f)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition shadow-2xs cursor-pointer"
                        >
                          Kelola & Edit
                        </button>
                        <button
                          onClick={() => handleDelete(f)}
                          disabled={loading}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition shadow-2xs disabled:opacity-50 cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detail Inventaris Barang Suatu Fasilitas */}
      {viewItemsFacility && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">
                  Inventaris Barang di {viewItemsFacility.name}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lokasi: {viewItemsFacility.location}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewItemsFacility(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
              {(viewItemsFacility.items && viewItemsFacility.items.length > 0) ? (
                viewItemsFacility.items.map((it) => (
                  <div key={it.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <span className="font-bold text-slate-800">{it.name}</span>
                    <span className="font-mono bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-extrabold border border-blue-200">
                      {it.quantity} Unit
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-400 italic">
                  Belum ada barang yang didaftarkan di fasilitas ini.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const target = viewItemsFacility;
                  setViewItemsFacility(null);
                  openEditModal(target);
                }}
                className="px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl"
              >
                ✏️ Edit Daftar Barang Ini
              </button>
              <button
                type="button"
                onClick={() => setViewItemsFacility(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Fasilitas */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-xl w-full space-y-4 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h4 className="font-extrabold text-slate-900 text-base">Tambah Fasilitas Kampus Baru</h4>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Fasilitas (Unik)*</label>
                  <input
                    type="text"
                    name="code"
                    required
                    placeholder="Kode unik fasilitas"
                    className="w-full p-2.5 border border-slate-300 rounded-xl uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori*</label>
                  <input
                    type="text"
                    name="category"
                    required
                    placeholder="Auditorium / Aula / Laboratorium"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Fasilitas*</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="Nama resmi fasilitas / ruangan"
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lokasi Gedung / Lantai*</label>
                  <input
                    type="text"
                    name="location"
                    required
                    placeholder="Lokasi lengkap ruangan"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kapasitas (Orang)</label>
                  <input
                    type="number"
                    name="capacity"
                    placeholder="Kapasitas maksimal"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi Fasilitas</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Informasi mengenai fasilitas ini"
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                ></textarea>
              </div>

              {/* SEKSI INVENTARIS BARANG DI FASILITAS */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold text-slate-800">
                      📦 Ketersediaan Inventaris Barang di Fasilitas Ini
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Tentukan barang bawaan standar & jumlah unit yang ada di dalam ruangan ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddModalAddItem}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    + Tambah Barang
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {addItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nama barang..."
                        value={item.name}
                        onChange={(e) => handleAddModalItemChange(idx, "name", e.target.value)}
                        className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => handleAddModalItemChange(idx, "quantity", e.target.value)}
                          className="w-16 p-2 bg-white border border-slate-300 rounded-lg text-xs text-center font-bold"
                        />
                        <span className="text-[11px] text-slate-500">Unit</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddModalRemoveItem(idx)}
                        className="text-rose-500 hover:text-rose-700 font-bold p-1 hover:bg-rose-50 rounded"
                        title="Hapus barang"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fasilitas Pendukung</label>
                <input
                  type="text"
                  name="amenities"
                  placeholder="AC, Proyektor, Sound System, WiFi, dll."
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Aturan Penggunaan</label>
                <textarea
                  name="rules"
                  rows={2}
                  placeholder="Tata tertib & ketentuan khusus pemakaian fasilitas"
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Menyimpan..." : "Simpan Fasilitas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Fasilitas & Inventaris Barang */}
      {editFacility && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-xl w-full space-y-4 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h4 className="font-extrabold text-slate-900 text-base">
              Kelola & Edit Fasilitas: {editFacility.name}
            </h4>
            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Fasilitas*</label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editFacility.name}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori*</label>
                  <input
                    type="text"
                    name="category"
                    required
                    defaultValue={editFacility.category}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lokasi Gedung / Lantai*</label>
                  <input
                    type="text"
                    name="location"
                    required
                    defaultValue={editFacility.location}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kapasitas (Orang)</label>
                  <input
                    type="number"
                    name="capacity"
                    defaultValue={editFacility.capacity ?? ""}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi Fasilitas</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editFacility.description}
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                ></textarea>
              </div>

              {/* SEKSI EDIT INVENTARIS BARANG DI FASILITAS */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-bold text-slate-800">
                      📦 Ketersediaan Inventaris Barang di Fasilitas Ini
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Kelola daftar barang dan jumlah unit yang akurat untuk fasilitas ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleEditModalAddItem}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    + Tambah Barang
                  </button>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {editItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Nama barang..."
                        value={item.name}
                        onChange={(e) => handleEditModalItemChange(idx, "name", e.target.value)}
                        className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          value={item.quantity}
                          onChange={(e) => handleEditModalItemChange(idx, "quantity", e.target.value)}
                          className="w-16 p-2 bg-white border border-slate-300 rounded-lg text-xs text-center font-bold"
                        />
                        <span className="text-[11px] text-slate-500">Unit</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleEditModalRemoveItem(idx)}
                        className="text-rose-500 hover:text-rose-700 font-bold p-1 hover:bg-rose-50 rounded"
                        title="Hapus barang"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fasilitas Pendukung</label>
                <input
                  type="text"
                  name="amenities"
                  defaultValue={editFacility.amenities}
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Aturan Penggunaan</label>
                <textarea
                  name="rules"
                  rows={2}
                  defaultValue={editFacility.rules}
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                ></textarea>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Ketersediaan</label>
                <select
                  name="active"
                  defaultValue={editFacility.active ? "true" : "false"}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="true">Aktif (Tersedia untuk dipinjam)</option>
                  <option value="false">Nonaktif (Dalam perbaikan / ditutup)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditFacility(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Menyimpan..." : "Perbarui Fasilitas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserAction,
  updateUserAction,
  resetPasswordAction,
  toggleUserActiveAction,
  deleteUserAction,
  assignAdvisorAction,
  removeAdvisorAction,
  assignOrgProdiAction,
  updateOrganizationAction,
} from "@/app/actions/admin";
import type { UserRowAdmin, OrgRowAdmin } from "@/server/admin";
import { ROLE_LABEL, type Role } from "@/lib/roles";

export default function UserManager({
  users,
  organizations,
  prodis,
}: {
  users: UserRowAdmin[];
  organizations: OrgRowAdmin[];
  prodis: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"USERS" | "ORGS">("USERS");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal States
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRowAdmin | null>(null);
  const [editingOrg, setEditingOrg] = useState<OrgRowAdmin | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<UserRowAdmin | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [assignAdvisorModal, setAssignAdvisorModal] = useState<OrgRowAdmin | null>(null);
  const [selectedAdvisorId, setSelectedAdvisorId] = useState("");
  const [assignProdiModal, setAssignProdiModal] = useState<OrgRowAdmin | null>(null);
  const [selectedProdiId, setSelectedProdiId] = useState("");
  const [toggleUserModal, setToggleUserModal] = useState<UserRowAdmin | null>(null);
  const [deleteUserModal, setDeleteUserModal] = useState<UserRowAdmin | null>(null);
  const [removeAdvisorModal, setRemoveAdvisorModal] = useState<{ org: OrgRowAdmin; advisor: { id: string; display_name: string } } | null>(null);

  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");
  const [selectedAccountType, setSelectedAccountType] = useState<string>("UKM");
  const [editRole, setEditRole] = useState<Role>("ORG");

  const advisorUsers = users.filter((u) => u.role === "ADVISOR" && u.active);

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      u.username.toLowerCase().includes(q) ||
      u.display_name.toLowerCase().includes(q) ||
      ROLE_LABEL[u.role]?.toLowerCase().includes(q) ||
      (u.organization_name && u.organization_name.toLowerCase().includes(q));

    if (!matchSearch) return false;

    if (selectedRoleFilter === "ALL") return true;
    if (selectedRoleFilter === "ORMAWA") {
      return u.role === "ORG" && (u.organization_type === "BEM" || u.organization_type === "MPM" || u.organization_type === "HIMA");
    }
    if (selectedRoleFilter === "UKM") {
      return u.role === "ORG" && (u.organization_type === "UKM" || u.organization_type === "BO" || u.organization_type === "BSO" || u.organization_type === "ODD");
    }
    if (selectedRoleFilter === "AKADEMIK") {
      return u.role === "ADVISOR" || u.role === "KAPRODI";
    }
    if (selectedRoleFilter === "MANAGEMENT") {
      return u.role === "WADIR" || u.role === "SUBBAG_UMUM" || u.role === "ADMIN";
    }
    return true;
  });

  const filteredOrgs = organizations.filter((o) => {
    const q = searchTerm.toLowerCase();
    return (
      o.code.toLowerCase().includes(q) ||
      o.name.toLowerCase().includes(q) ||
      o.type.toLowerCase().includes(q)
    );
  });

  async function handleToggleUserConfirm() {
    if (!toggleUserModal) return;
    setLoading(true);
    setError(null);
    const res = await toggleUserActiveAction(toggleUserModal.id);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Status akun @${toggleUserModal.username} berhasil diubah.`);
      setTimeout(() => setSuccess(null), 3000);
      setToggleUserModal(null);
      router.refresh();
    }
  }

  async function handleDeleteUserConfirm() {
    if (!deleteUserModal) return;
    setLoading(true);
    setError(null);
    const res = await deleteUserAction(deleteUserModal.id);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Akun pengguna @${deleteUserModal.username} (${deleteUserModal.display_name}) berhasil dihapus.`);
      setTimeout(() => setSuccess(null), 3000);
      setDeleteUserModal(null);
      router.refresh();
    }
  }

  async function handleAssignProdi(e: React.FormEvent) {
    e.preventDefault();
    if (!assignProdiModal) return;
    setLoading(true);
    setError(null);
    const res = await assignOrgProdiAction(assignProdiModal.id, selectedProdiId || null);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setSuccess(`Program studi untuk ${assignProdiModal.name} berhasil diperbarui.`);
      setTimeout(() => setSuccess(null), 3000);
      setAssignProdiModal(null);
      setSelectedProdiId("");
      router.refresh();
    }
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await createUserAction(formData);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setShowAddUserModal(false);
      setSuccess("Akun pengguna berhasil dibuat!");
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    }
  }

  async function handleUpdateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingUser) return;
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await updateUserAction(editingUser.id, formData);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setEditingUser(null);
      setSuccess(`Data pengguna @${editingUser.username} berhasil diperbarui!`);
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    }
  }

  async function handleUpdateOrg(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingOrg) return;
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const code = formData.get("code") as string;
    const res = await updateOrganizationAction(editingOrg.id, { name, code });
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setEditingOrg(null);
      setSuccess(`Data organisasi "${name}" berhasil diperbarui!`);
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetPwdUser) return;
    setLoading(true);
    setError(null);
    const res = await resetPasswordAction(resetPwdUser.id, newPassword);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setResetPwdUser(null);
      setNewPassword("");
      setSuccess(`Kata sandi akun ${resetPwdUser.username} berhasil direset!`);
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    }
  }

  async function handleAssignAdvisor(e: React.FormEvent) {
    e.preventDefault();
    if (!assignAdvisorModal || !selectedAdvisorId) return;
    setLoading(true);
    setError(null);
    const res = await assignAdvisorAction(assignAdvisorModal.id, selectedAdvisorId);
    setLoading(false);
    if (res.error) setError(res.error);
    else {
      setAssignAdvisorModal(null);
      setSelectedAdvisorId("");
      router.refresh();
    }
  }

  async function handleRemoveAdvisorConfirm() {
    if (!removeAdvisorModal) return;
    setLoading(true);
    setError(null);
    const res = await removeAdvisorAction(removeAdvisorModal.org.id, removeAdvisorModal.advisor.id);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Dosen pembina ${removeAdvisorModal.advisor.display_name} berhasil dicabut dari ${removeAdvisorModal.org.name}.`);
      setTimeout(() => setSuccess(null), 3000);
      setRemoveAdvisorModal(null);
      router.refresh();
    }
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

      {/* Tab Switcher & Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex bg-slate-200/80 p-1 rounded-xl text-xs font-bold w-fit">
          <button
            onClick={() => setActiveTab("USERS")}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === "USERS"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            👥 Akun Pengguna ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("ORGS")}
            className={`px-4 py-2 rounded-lg transition ${
              activeTab === "ORGS"
                ? "bg-white text-blue-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🏛️ Organisasi & Dosen Pembina ({organizations.length})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            placeholder={activeTab === "USERS" ? "Cari pengguna / username..." : "Cari organisasi..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-64"
          />

          {activeTab === "USERS" && (
            <button
              onClick={() => {
                setSelectedAccountType("UKM");
                setShowAddUserModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition shadow-xs whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>+</span>
              <span>Buat Akun Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Kategori Khusus untuk Akun Pengguna */}
      {activeTab === "USERS" && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] whitespace-nowrap">
            Kategori:
          </span>
          {[
            { id: "ALL", label: `Semua (${users.length})` },
            {
              id: "ORMAWA",
              label: `Ormawa: BEM / MPM / HIMA (${
                users.filter(
                  (u) =>
                    u.role === "ORG" &&
                    (u.organization_type === "BEM" ||
                      u.organization_type === "MPM" ||
                      u.organization_type === "HIMA")
                ).length
              })`,
            },
            {
              id: "UKM",
              label: `UKM & Otonom (${
                users.filter(
                  (u) =>
                    u.role === "ORG" &&
                    (u.organization_type === "UKM" ||
                      u.organization_type === "BO" ||
                      u.organization_type === "BSO" ||
                      u.organization_type === "ODD")
                ).length
              })`,
            },
            {
              id: "AKADEMIK",
              label: `Dosen & Kaprodi (${
                users.filter((u) => u.role === "ADVISOR" || u.role === "KAPRODI")
                  .length
              })`,
            },
            {
              id: "MANAGEMENT",
              label: `Pimpinan & Admin (${
                users.filter(
                  (u) =>
                    u.role === "WADIR" ||
                    u.role === "SUBBAG_UMUM" ||
                    u.role === "ADMIN"
                ).length
              })`,
            },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedRoleFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap cursor-pointer border ${
                selectedRoleFilter === cat.id
                  ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* TAB 1: PENGGUNA */}
      {activeTab === "USERS" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Nama & Username</th>
                  <th className="px-6 py-3.5">Kategori / Peran</th>
                  <th className="px-6 py-3.5">Afiliasi Organisasi / Prodi</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400">
                      Tidak ada akun pengguna yang cocok dengan kriteria pencarian atau kategori ini.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4">
                        <strong className="text-slate-900 block">{u.display_name}</strong>
                        <span className="font-mono text-xs text-slate-500">@{u.username}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${
                              u.role === "ORG" && u.organization_type === "UKM"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : u.role === "ORG" && (u.organization_type === "BO" || u.organization_type === "BSO" || u.organization_type === "ODD")
                                ? "bg-teal-50 text-teal-800 border-teal-200"
                                : u.role === "ORG"
                                ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                                : u.role === "KAPRODI"
                                ? "bg-purple-50 text-purple-800 border-purple-200"
                                : u.role === "ADVISOR"
                                ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                                : "bg-slate-100 text-slate-800 border-slate-200"
                            }`}
                          >
                            {u.role === "ORG"
                              ? u.organization_type === "UKM"
                                ? "UKM"
                                : u.organization_type === "BO"
                                ? "BO"
                                : u.organization_type === "BSO"
                                ? "BSO"
                                : u.organization_type === "ODD"
                                ? "ODD"
                                : `Ormawa (${u.organization_type || "BEM/MPM/HIMA"})`
                              : ROLE_LABEL[u.role] || u.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {u.organization_name ? (
                          <div className="font-semibold text-blue-700">
                            {u.organization_name}
                          </div>
                        ) : u.prodi_name ? (
                          <div className="font-medium text-slate-700">Prodi: {u.prodi_name}</div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setToggleUserModal(u)}
                          className={`px-3 py-1 text-xs font-bold rounded-full border transition cursor-pointer shadow-2xs ${
                            u.active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          {u.active ? "Aktif" : "Nonaktif"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingUser(u);
                              setEditRole(u.role);
                            }}
                            className="text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setResetPwdUser(u);
                              setNewPassword("");
                            }}
                            className="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => setDeleteUserModal(u)}
                            className="text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
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
      )}

      {/* TAB 2: ORGANISASI & DOSEN PEMBINA */}
      {activeTab === "ORGS" && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Organisasi</th>
                  <th className="px-6 py-3.5">Tipe & Prodi / Kaprodi</th>
                  <th className="px-6 py-3.5">Dosen Pembina Terdaftar</th>
                  <th className="px-6 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrgs.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4">
                      <strong className="text-slate-900 block">{o.name}</strong>
                      <span className="font-mono text-xs text-slate-500">{o.code}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                            o.type === "UKM"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : o.type === "BO" || o.type === "BSO" || o.type === "ODD"
                              ? "bg-teal-50 text-teal-700 border-teal-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {o.type === "UKM"
                            ? "UKM"
                            : o.type === "BO"
                            ? "Badan Otonom (BO)"
                            : o.type === "BSO"
                            ? "Badan Semi Otonom (BSO)"
                            : o.type === "ODD"
                            ? "Organisasi Daerah (ODD)"
                            : `Ormawa (${o.type})`}
                        </span>
                        {o.type === "HIMA" && (
                          <div className="text-xs space-y-0.5 mt-0.5">
                            {o.prodi_name ? (
                              <div className="font-medium text-slate-800">
                                📚 Prodi: <strong>{o.prodi_name}</strong>
                              </div>
                            ) : (
                              <span className="text-amber-700 font-medium">⚠️ Belum pilih Prodi</span>
                            )}
                            {o.kaprodi ? (
                              <div className="text-emerald-700 font-medium">
                                🎓 Kaprodi: {o.kaprodi.display_name}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic block">
                                (Belum ada akun Kaprodi aktif di prodi ini)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {o.advisors.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">Belum ada pembina</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {o.advisors.map((adv) => (
                            <div
                              key={adv.id}
                              className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-800"
                            >
                              <span>👨‍🏫 {adv.display_name}</span>
                              <button
                                onClick={() => setRemoveAdvisorModal({ org: o, advisor: adv })}
                                className="text-rose-500 hover:text-rose-700 font-bold ml-1 hover:bg-rose-100 rounded-full w-4 h-4 flex items-center justify-center transition cursor-pointer"
                                title="Cabut pembina"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setEditingOrg(o)}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
                        >
                          ✏️ Edit
                        </button>
                        {o.type === "HIMA" && (
                          <button
                            onClick={() => {
                              setAssignProdiModal(o);
                              setSelectedProdiId(o.prodi_id || "");
                            }}
                            className="text-xs font-semibold text-purple-700 hover:bg-purple-100 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
                          >
                            Atur Prodi & Kaprodi
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setAssignAdvisorModal(o);
                            setSelectedAdvisorId("");
                          }}
                          className="text-xs font-semibold text-blue-700 hover:bg-blue-100 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer"
                        >
                          + Dosen Pembina
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Buat Akun Pengguna Baru (Dengan Pemilihan Jenis Akun Jelas) */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-900 text-lg">Buat Akun Pengguna Baru</h4>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Pilih jenis akun yang ingin dibuat agar sistem otomatis menampilkan formulir dan relasi yang tepat.
              </p>
            </div>

            {/* Pilihan Jenis Akun (UKM, HIMA, BEM / MPM, Dosen Pembimbing, Kaprodi, Pimpinan / Admin) */}
            <div>
              <label className="block font-bold text-slate-800 text-xs mb-2 uppercase tracking-wider">
                1. Tentukan Jenis Akun yang Ingin Dibuat:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: "UKM", label: "UKM", desc: "Unit Kegiatan Mahasiswa", role: "ORG" },
                  { id: "HIMA", label: "HIMA", desc: "Himpunan Mahasiswa", role: "ORG" },
                  { id: "BEM_MPM", label: "BEM / MPM", desc: "Organisasi Mahasiswa", role: "ORG" },
                  { id: "OTONOM", label: "BO / BSO / ODD", desc: "Badan Otonom & Semi Otonom", role: "ORG" },
                  { id: "ADVISOR", label: "Dosen Pembimbing", desc: "Pembimbing Kegiatan", role: "ADVISOR" },
                  { id: "KAPRODI", label: "Kaprodi", desc: "Ketua Program Studi", role: "KAPRODI" },
                  { id: "STAFF", label: "Pimpinan / Admin", desc: "Wadir / Subbag / Admin", role: "WADIR" },
                ].map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedAccountType(type.id)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                      selectedAccountType === type.id
                        ? "bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-900 font-bold"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-xs font-bold leading-tight">{type.label}</span>
                    <span className="text-[10px] text-slate-400 mt-1">{type.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs pt-3 border-t border-slate-100">
              {/* Role Hidden atau Terpilih Berdasarkan Jenis Akun */}
              {selectedAccountType === "UKM" && (
                <>
                  <input type="hidden" name="role" value="ORG" />
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Pilih Organisasi UKM *
                    </label>
                    <select
                      name="organizationId"
                      required
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs text-slate-900 font-medium"
                    >
                      <option value="">-- Pilih UKM --</option>
                      {organizations
                        .filter((org) => org.type === "UKM")
                        .map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name} ({org.code})
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              {selectedAccountType === "HIMA" && (
                <>
                  <input type="hidden" name="role" value="ORG" />
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Pilih Organisasi HIMA *
                    </label>
                    <select
                      name="organizationId"
                      required
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs text-slate-900 font-medium"
                    >
                      <option value="">-- Pilih HIMA --</option>
                      {organizations
                        .filter((org) => org.type === "HIMA")
                        .map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name} ({org.code})
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              {selectedAccountType === "BEM_MPM" && (
                <>
                  <input type="hidden" name="role" value="ORG" />
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Pilih Organisasi BEM / MPM *
                    </label>
                    <select
                      name="organizationId"
                      required
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs text-slate-900 font-medium"
                    >
                      <option value="">-- Pilih Lembaga --</option>
                      {organizations
                        .filter((org) => org.type === "BEM" || org.type === "MPM")
                        .map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name} ({org.type})
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              {selectedAccountType === "OTONOM" && (
                <>
                  <input type="hidden" name="role" value="ORG" />
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Pilih Lembaga BO / BSO / ODD *
                    </label>
                    <select
                      name="organizationId"
                      required
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs text-slate-900 font-medium"
                    >
                      <option value="">-- Pilih Lembaga Otonom --</option>
                      {organizations
                        .filter((org) => org.type === "BO" || org.type === "BSO" || org.type === "ODD")
                        .map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name} ({org.type})
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}

              {selectedAccountType === "ADVISOR" && (
                <input type="hidden" name="role" value="ADVISOR" />
              )}

              {selectedAccountType === "KAPRODI" && (
                <>
                  <input type="hidden" name="role" value="KAPRODI" />
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Program Studi *
                    </label>
                    <select
                      name="prodiId"
                      required
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs text-slate-900 font-medium"
                    >
                      <option value="">-- Pilih Program Studi --</option>
                      {prodis.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {selectedAccountType === "STAFF" && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Pilih Peran Pejabat / Pengelola Kampus *
                  </label>
                  <select
                    name="role"
                    required
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs text-slate-900 font-medium"
                  >
                    <option value="WADIR">Wakil Direktur Bidang Kemahasiswaan</option>
                    <option value="SUBBAG_UMUM">Sub Bagian Umum (Pemberi Izin Fasilitas)</option>
                    <option value="ADMIN">Administrator Sistem Kampus</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Username Login *
                </label>
                <input
                  type="text"
                  name="username"
                  required
                  placeholder={
                    selectedAccountType === "UKM"
                      ? "ukm"
                      : selectedAccountType === "HIMA"
                      ? "hima"
                      : selectedAccountType === "ADVISOR"
                      ? "dosen.pembimbing"
                      : selectedAccountType === "KAPRODI"
                      ? "kaprodi"
                      : "admin"
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl lowercase bg-white text-slate-900 font-mono text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nama Tampilan Lengkap *
                </label>
                <input
                  type="text"
                  name="displayName"
                  required
                  placeholder={
                    selectedAccountType === "UKM"
                      ? "UKM"
                      : selectedAccountType === "HIMA"
                      ? "HIMA"
                      : selectedAccountType === "ADVISOR"
                      ? "Dosen Pembimbing"
                      : selectedAccountType === "KAPRODI"
                      ? "Kaprodi"
                      : "Administrator Sistem"
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kata Sandi Awal (Min. 8 Karakter) *
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={8}
                  placeholder="Ketik kata sandi akun..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {loading ? "Menyimpan..." : "Buat Akun"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Pengguna */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-lg w-full space-y-4 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">
                  Edit Pengguna: @{editingUser.username}
                </h4>
                <p className="text-xs text-slate-500">
                  Perbarui profil, peran, atau afiliasi organisasi/prodi
                </p>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Username *
                </label>
                <input
                  name="username"
                  required
                  defaultValue={editingUser.username}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-mono"
                  placeholder="username unik"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Tampilan *
                </label>
                <input
                  name="displayName"
                  required
                  defaultValue={editingUser.display_name}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                  placeholder="Nama Akun Lengkap"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Peran (Role) *
                </label>
                <select
                  name="role"
                  required
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="ORG">Organisasi Mahasiswa (HIMA / BEM / MPM / UKM)</option>
                  <option value="ADVISOR">Dosen Pembimbing</option>
                  <option value="KAPRODI">Ketua Program Studi (Kaprodi)</option>
                  <option value="WADIR">Wakil Direktur Bidang Kemahasiswaan</option>
                  <option value="SUBBAG_UMUM">Sub Bagian Umum</option>
                  <option value="ADMIN">Administrator Sistem</option>
                </select>
              </div>

              {editRole === "ORG" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Hubungkan ke Organisasi *
                  </label>
                  <select
                    name="organizationId"
                    required
                    defaultValue={editingUser.organization_id || ""}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="">-- Pilih Organisasi --</option>
                    <optgroup label="UKM">
                      {organizations
                        .filter((o) => o.type === "UKM")
                        .map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Badan Otonom & Semi Otonom (BO / BSO / ODD)">
                      {organizations
                        .filter((o) => o.type === "BO" || o.type === "BSO" || o.type === "ODD")
                        .map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name} ({org.type})
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="Ormawa (HIMA / BEM / MPM)">
                      {organizations
                        .filter((o) => o.type === "HIMA" || o.type === "BEM" || o.type === "MPM")
                        .map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {editRole === "KAPRODI" && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Program Studi *
                  </label>
                  <select
                    name="prodiId"
                    required
                    defaultValue={editingUser.prodi_id || ""}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="">-- Pilih Program Studi --</option>
                    {prodis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Status Akun
                </label>
                <select
                  name="active"
                  defaultValue={editingUser.active ? "true" : "false"}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Organisasi (Nama & Kode Organisasi) */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">
                  Edit Data Organisasi
                </h4>
                <p className="text-xs text-slate-500">
                  Ubah nama resmi organisasi dan kode singkat
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrg(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateOrg} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Resmi Organisasi *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={editingOrg.name}
                  placeholder="Contoh: BEM Polimedia, HIMA Desain Grafis..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-medium focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Nama ini akan tampil di seluruh formulir, lembar pengajuan, dan berita acara.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kode Organisasi *
                </label>
                <input
                  name="code"
                  type="text"
                  required
                  defaultValue={editingOrg.code}
                  placeholder="Contoh: BEM, MPM, UKM-FOTO..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-slate-900 font-mono uppercase focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tipe Lembaga
                </label>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 font-medium">
                  {editingOrg.type}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingOrg(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {resetPwdUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100">
            <h4 className="font-extrabold text-slate-900 text-base">
              Reset Password: @{resetPwdUser.username}
            </h4>
            <p className="text-xs text-slate-500">
              Ganti kata sandi pengurus baru atau reset kredensial untuk akun{" "}
              <strong>{resetPwdUser.display_name}</strong>.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Kata Sandi Baru (Min. 8 Karakter)*
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Masukkan kata sandi baru..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResetPwdUser(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Reset Kata Sandi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tetapkan Dosen Pembina */}
      {assignAdvisorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100">
            <h4 className="font-extrabold text-slate-900 text-base">
              Tetapkan Dosen Pembina
            </h4>
            <p className="text-xs text-slate-500">
              Pilih dosen pembina untuk organisasi <strong>{assignAdvisorModal.name}</strong>
            </p>
            <form onSubmit={handleAssignAdvisor} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Dosen Pembimbing / Pembina*
                </label>
                <select
                  required
                  value={selectedAdvisorId}
                  onChange={(e) => setSelectedAdvisorId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="">-- Pilih Dosen --</option>
                  {advisorUsers.map((adv) => (
                    <option key={adv.id} value={adv.id}>
                      {adv.display_name} (@{adv.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignAdvisorModal(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Tetapkan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Atur Prodi & Kaprodi untuk Organisasi (HIMA) */}
      {assignProdiModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100">
            <h4 className="font-extrabold text-slate-900 text-base">
              Atur Program Studi & Kaprodi
            </h4>
            <p className="text-xs text-slate-500">
              Pilih program studi yang menaungi organisasi <strong>{assignProdiModal.name}</strong>. Pejabat Kaprodi akan otomatis terhubung sesuai prodi yang dipilih.
            </p>
            <form onSubmit={handleAssignProdi} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Program Studi*
                </label>
                <select
                  value={selectedProdiId}
                  onChange={(e) => setSelectedProdiId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="">-- Tanpa Program Studi --</option>
                  {prodis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignProdiModal(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl disabled:opacity-50"
                >
                  {loading ? "Menyimpan..." : "Simpan Prodi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Ubah Status Pengguna (Ganti alert browser) */}
      {toggleUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl mx-auto">
              ⚠️
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-extrabold text-slate-900 text-base">
                {toggleUserModal.active ? "Nonaktifkan Akun?" : "Aktifkan Akun?"}
              </h4>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin mengubah status akun{" "}
                <strong className="text-slate-800">@{toggleUserModal.username}</strong> ({toggleUserModal.display_name}) menjadi{" "}
                <span className={toggleUserModal.active ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                  {toggleUserModal.active ? "Nonaktif" : "Aktif"}
                </span>?
              </p>
            </div>

            <div className="flex justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setToggleUserModal(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleToggleUserConfirm}
                disabled={loading}
                className={`px-5 py-2 font-bold text-white rounded-xl text-xs transition disabled:opacity-50 ${
                  toggleUserModal.active
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {loading ? "Memproses..." : toggleUserModal.active ? "Ya, Nonaktifkan" : "Ya, Aktifkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Cabut Dosen Pembina (Ganti window.confirm) */}
      {removeAdvisorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-xl mx-auto">
              👨‍🏫
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-extrabold text-slate-900 text-base">
                Cabut Dosen Pembimbing?
              </h4>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin mencabut dosen pembina{" "}
                <strong className="text-slate-800">{removeAdvisorModal.advisor.display_name}</strong> dari{" "}
                <strong className="text-slate-800">{removeAdvisorModal.org.name}</strong>?
              </p>
            </div>

            <div className="flex justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRemoveAdvisorModal(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRemoveAdvisorConfirm}
                disabled={loading}
                className="px-5 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl text-xs transition disabled:opacity-50"
              >
                {loading ? "Mencabut..." : "Ya, Cabut Pembina"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Akun Pengguna */}
      {deleteUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center text-xl mx-auto">
              🗑️
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-extrabold text-slate-900 text-base">
                Hapus Akun Pengguna?
              </h4>
              <p className="text-xs text-slate-500">
                Apakah Anda yakin ingin menghapus akun{" "}
                <strong className="text-slate-800">@{deleteUserModal.username}</strong> ({deleteUserModal.display_name})?
              </p>
              <p className="text-[11px] text-rose-600 font-medium pt-1">
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteUserModal(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteUserConfirm}
                disabled={loading}
                className="px-5 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl text-xs transition disabled:opacity-50"
              >
                {loading ? "Menghapus..." : "Ya, Hapus Akun"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

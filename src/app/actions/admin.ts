"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import {
  createFacilityAdmin,
  updateFacilityAdmin,
  toggleFacilityActiveAdmin,
  deleteFacilityAdmin,
  createUserAdmin,
  updateUserAdmin,
  resetUserPasswordAdmin,
  toggleUserActiveAdmin,
  deleteUserAdmin,
  assignAdvisorAdmin,
  removeAdvisorAdmin,
  assignOrgProdiAdmin,
  updateSettingAdmin,
} from "@/server/admin";
import type { Role } from "@/lib/roles";

export async function createFacilityAction(formData: FormData) {
  const user = await requireUser(["ADMIN", "SUBBAG_UMUM"]);
  try {
    const code = String(formData.get("code") ?? "");
    const name = String(formData.get("name") ?? "");
    const category = String(formData.get("category") ?? "");
    const location = String(formData.get("location") ?? "");
    const description = String(formData.get("description") ?? "");
    const amenities = String(formData.get("amenities") ?? "");
    const capacityStr = String(formData.get("capacity") ?? "");
    const rules = String(formData.get("rules") ?? "");
    const itemsRaw = String(formData.get("items") ?? "");

    let items: { name: string; quantity: number }[] | undefined;
    if (itemsRaw) {
      try {
        items = JSON.parse(itemsRaw);
      } catch {}
    }

    await createFacilityAdmin(user, {
      code,
      name,
      category,
      location,
      description,
      amenities,
      capacity: capacityStr ? Number(capacityStr) : null,
      rules,
      active: true,
      items,
    });

    revalidatePath("/dashboard/admin/fasilitas");
    revalidatePath("/dashboard/peminjaman/baru");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal menambahkan fasilitas." };
  }
}

export async function updateFacilityAction(facilityId: string, formData: FormData) {
  const user = await requireUser(["ADMIN", "SUBBAG_UMUM"]);
  try {
    const name = String(formData.get("name") ?? "");
    const category = String(formData.get("category") ?? "");
    const location = String(formData.get("location") ?? "");
    const description = String(formData.get("description") ?? "");
    const amenities = String(formData.get("amenities") ?? "");
    const capacityStr = String(formData.get("capacity") ?? "");
    const rules = String(formData.get("rules") ?? "");
    const active = formData.get("active") === "true";
    const itemsRaw = String(formData.get("items") ?? "");

    let items: { id?: string; name: string; quantity: number }[] | undefined;
    if (itemsRaw) {
      try {
        items = JSON.parse(itemsRaw);
      } catch {}
    }

    await updateFacilityAdmin(user, facilityId, {
      name,
      category,
      location,
      description,
      amenities,
      capacity: capacityStr ? Number(capacityStr) : null,
      rules,
      active,
      items,
    });

    revalidatePath("/dashboard/admin/fasilitas");
    revalidatePath("/dashboard/peminjaman/baru");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal memperbarui fasilitas." };
  }
}

export async function toggleFacilityActiveAction(facilityId: string) {
  const user = await requireUser(["ADMIN", "SUBBAG_UMUM"]);
  try {
    await toggleFacilityActiveAdmin(user, facilityId);
    revalidatePath("/dashboard/admin/fasilitas");
    revalidatePath("/dashboard/peminjaman/baru");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal mengubah status fasilitas." };
  }
}

export async function deleteFacilityAction(facilityId: string) {
  const user = await requireUser(["ADMIN", "SUBBAG_UMUM"]);
  try {
    await deleteFacilityAdmin(user, facilityId);
    revalidatePath("/dashboard/admin/fasilitas");
    revalidatePath("/dashboard/peminjaman/baru");
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal menghapus fasilitas." };
  }
}

export async function createUserAction(formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  try {
    const username = String(formData.get("username") ?? "");
    const displayName = String(formData.get("displayName") ?? "");
    const password = String(formData.get("password") ?? "");
    const role = String(formData.get("role") ?? "") as Role;
    const organizationId = String(formData.get("organizationId") ?? "") || null;
    const prodiId = String(formData.get("prodiId") ?? "") || null;

    await createUserAdmin(user, {
      username,
      displayName,
      password,
      role,
      organizationId,
      prodiId,
    });

    revalidatePath("/dashboard/admin/pengguna");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal membuat akun pengguna." };
  }
}

export async function updateUserAction(userId: string, formData: FormData) {
  const user = await requireUser(["ADMIN"]);
  try {
    const username = String(formData.get("username") ?? "");
    const displayName = String(formData.get("displayName") ?? "");
    const role = String(formData.get("role") ?? "") as Role;
    const organizationId = String(formData.get("organizationId") ?? "") || null;
    const prodiId = String(formData.get("prodiId") ?? "") || null;
    const active = formData.has("active") ? formData.get("active") === "true" : undefined;

    await updateUserAdmin(user, userId, {
      username,
      displayName,
      role,
      organizationId,
      prodiId,
      active,
    });

    revalidatePath("/dashboard/admin/pengguna");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal memperbarui data pengguna." };
  }
}

export async function resetPasswordAction(userId: string, newPassword: string) {
  const user = await requireUser(["ADMIN"]);
  try {
    await resetUserPasswordAdmin(user, userId, newPassword);
    revalidatePath("/dashboard/admin/pengguna");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal mereset kata sandi pengguna." };
  }
}

export async function toggleUserActiveAction(userId: string) {
  const user = await requireUser(["ADMIN"]);
  try {
    await toggleUserActiveAdmin(user, userId);
    revalidatePath("/dashboard/admin/pengguna");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal mengubah status aktif pengguna." };
  }
}

export async function deleteUserAction(userId: string) {
  const user = await requireUser(["ADMIN"]);
  try {
    await deleteUserAdmin(user, userId);
    revalidatePath("/dashboard/admin/pengguna");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal menghapus akun pengguna." };
  }
}

export async function assignAdvisorAction(orgId: string, advisorUserId: string) {
  const user = await requireUser(["ADMIN"]);
  try {
    await assignAdvisorAdmin(user, orgId, advisorUserId);
    revalidatePath("/dashboard/admin/pengguna");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal menetapkan dosen pembina." };
  }
}

export async function removeAdvisorAction(orgId: string, advisorUserId: string) {
  const user = await requireUser(["ADMIN"]);
  try {
    await removeAdvisorAdmin(user, orgId, advisorUserId);
    revalidatePath("/dashboard/admin/pengguna");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal mencabut dosen pembina." };
  }
}

export async function assignOrgProdiAction(orgId: string, prodiId: string | null) {
  const user = await requireUser(["ADMIN"]);
  try {
    await assignOrgProdiAdmin(user, orgId, prodiId);
    revalidatePath("/dashboard/admin/pengguna");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal memperbarui program studi organisasi." };
  }
}

export async function updateSettingAction(key: string, value: any) {
  const user = await requireUser(["ADMIN"]);
  try {
    await updateSettingAdmin(user, key, value);
    revalidatePath("/dashboard/admin/pengaturan");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal memperbarui pengaturan sistem." };
  }
}

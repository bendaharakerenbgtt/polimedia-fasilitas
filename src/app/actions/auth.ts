"use server";

import { redirect } from "next/navigation";
import { login, logout, requireUser } from "@/server/auth";

export async function loginAction(prevState: any, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!username || !password) {
    return { error: "Nama pengguna dan kata sandi wajib diisi." };
  }

  const res = await login(username, password);
  if (!res.ok) {
    return { error: res.error };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { query, queryOne } from "./db";
import { verifyPassword } from "./password";
import type { Role } from "@/lib/roles";

const COOKIE = "pm_session";
const SESSION_HOURS = 12;

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  organizationId: string | null;
  organizationName: string | null;
  organizationType: string | null;
  prodiId: string | null;
  mustChangePassword: boolean;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

// --- Pembatasan percobaan login sederhana (per proses) ---------------------
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

export async function login(username: string, password: string) {
  const ip = (await clientIp()) ?? "unknown";
  const key = `${username.toLowerCase()}|${ip}`;
  const a = attempts.get(key);
  if (a && a.count >= MAX_ATTEMPTS && a.until > Date.now()) {
    return { ok: false as const, error: "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." };
  }
  const row = await queryOne<{ id: string; password_hash: string; active: boolean }>(
    `SELECT id, password_hash, active FROM users 
     WHERE lower(username) = lower($1) 
        OR (lower($1) = 'bem' AND lower(username) = 'bempolimedia')
        OR (lower($1) = 'bempolimedia' AND lower(username) = 'bem')`,
    [username],
  );
  const valid = row ? await verifyPassword(row.password_hash, password) : false;
  if (!row || !valid || !row.active) {
    const count = (a && a.until > Date.now() ? a.count : 0) + 1;
    attempts.set(key, { count, until: Date.now() + LOCK_MS });
    return { ok: false as const, error: "Nama pengguna atau kata sandi salah." };
  }
  attempts.delete(key);

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  const h = await headers();
  await query(
    `INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5)`,
    [sha256(token), row.id, expires, ip, h.get("user-agent")?.slice(0, 300) ?? null],
  );
  await query(`DELETE FROM sessions WHERE expires_at < now()`);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires,
  });

  // Audit log login aktivitas pengguna
  try {
    await query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, data, ip)
       VALUES ($1, 'USER_LOGGED_IN', 'user', $1, $2, $3)`,
      [row.id, JSON.stringify({ username, userAgent: h.get("user-agent")?.slice(0, 150) ?? null }), ip]
    );
  } catch {}

  return { ok: true as const, userId: row.id };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await query(`DELETE FROM sessions WHERE id = $1`, [sha256(token)]);
  jar.delete(COOKIE);
}

/** Mengembalikan pengguna yang sedang login, atau null. Di-cache per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const row = await queryOne<{
    id: string;
    username: string;
    display_name: string;
    role: Role;
    organization_id: string | null;
    org_name: string | null;
    org_type: string | null;
    prodi_id: string | null;
    must_change_password: boolean;
  }>(
    `SELECT u.id, u.username, u.display_name, u.role, u.organization_id, u.prodi_id,
            u.must_change_password, o.name AS org_name, o.type::text AS org_type
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE s.id = $1 AND s.expires_at > now() AND u.active
        AND (o.id IS NULL OR o.active)`,
    [sha256(token)],
  );
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    organizationId: row.organization_id,
    organizationName: row.org_name,
    organizationType: row.org_type,
    prodiId: row.prodi_id,
    mustChangePassword: row.must_change_password,
  };
});

/** Wajib login; opsional membatasi peran. Dipakai di halaman & server action. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect("/dashboard?forbidden=1");
  return user;
}

/** Menghapus semua sesi pengguna (mis. saat serah terima akun organisasi). */
export async function revokeAllSessions(userId: string) {
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

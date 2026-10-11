import type { Role } from "@/lib/roles";
import { query, type Db } from "./db";

/** Identitas pelaku tindakan — diturunkan dari sesi, tidak pernah dari input klien. */
export type Actor = {
  id: string;
  role: Role;
  organizationId: string | null;
  prodiId: string | null;
  ip?: string | null;
};

/** Kesalahan yang aman ditampilkan ke pengguna. */
export class AppError extends Error {
  constructor(
    message: string,
    public code: "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION" | "STATE" = "VALIDATION",
  ) {
    super(message);
  }
}

export const forbidden = (msg = "Anda tidak memiliki akses untuk tindakan ini.") =>
  new AppError(msg, "FORBIDDEN");
export const notFound = (msg = "Data tidak ditemukan.") => new AppError(msg, "NOT_FOUND");

export async function audit(
  db: Db,
  actor: Actor | null,
  action: string,
  entityType: string,
  entityId: string | null,
  data: Record<string, unknown> = {},
) {
  await query(
    `INSERT INTO audit_logs (actor_user_id, actor_org_id, action, entity_type, entity_id, data, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [actor?.id ?? null, actor?.organizationId ?? null, action, entityType, entityId, JSON.stringify(data), actor?.ip ?? null],
    db,
  );
}

export async function notify(
  db: Db,
  userIds: string[],
  title: string,
  body: string,
  link: string | null,
) {
  const unique = [...new Set(userIds)];
  if (!unique.length) return;
  await query(
    `INSERT INTO notifications (user_id, title, body, link)
     SELECT u, $2, $3, $4 FROM unnest($1::uuid[]) AS u`,
    [unique, title, body, link],
    db,
  );
}

export async function getSetting<T>(db: Db, key: string, fallback: T): Promise<T> {
  const rows = await query<{ value: T }>(`SELECT value FROM settings WHERE key = $1`, [key], db);
  return rows.length ? rows[0].value : fallback;
}

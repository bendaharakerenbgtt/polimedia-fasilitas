import { query, queryOne, tx } from "./db";
import { AppError, audit, forbidden, notFound, type Actor } from "./core";
import { hashPassword, PASSWORD_MIN_LENGTH } from "./password";
import type { Role, OrgType } from "@/lib/roles";

export type AdminStats = {
  totalBookings: number;
  approvedBookings: number;
  pendingBookings: number;
  rejectedBookings: number;
  totalFacilities: number;
  activeFacilities: number;
  totalOrganizations: number;
  totalUsers: number;
};

export async function getAdminStats(): Promise<AdminStats> {
  const [bRows, fRows, oRows, uRows] = await Promise.all([
    query<{
      total: string;
      approved: string;
      pending: string;
      rejected: string;
    }>(`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE status = 'APPROVED') AS approved,
        count(*) FILTER (WHERE status = 'PENDING') AS pending,
        count(*) FILTER (WHERE status = 'REJECTED') AS rejected
      FROM bookings
    `),
    query<{ total: string; active: string }>(`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE active) AS active
      FROM facilities
    `),
    query<{ count: string }>(`SELECT count(*) FROM organizations`),
    query<{ count: string }>(`SELECT count(*) FROM users WHERE active`),
  ]);

  const b = bRows[0];
  const f = fRows[0];
  return {
    totalBookings: Number(b?.total ?? 0),
    approvedBookings: Number(b?.approved ?? 0),
    pendingBookings: Number(b?.pending ?? 0),
    rejectedBookings: Number(b?.rejected ?? 0),
    totalFacilities: Number(f?.total ?? 0),
    activeFacilities: Number(f?.active ?? 0),
    totalOrganizations: Number(oRows[0]?.count ?? 0),
    totalUsers: Number(uRows[0]?.count ?? 0),
  };
}

/* =========================================================================
   1. FASILITAS
   ========================================================================= */

export type FacilityItemData = {
  id: string;
  facility_id: string;
  name: string;
  quantity: number;
  condition: string;
  notes: string;
};

export type FacilityData = {
  id: string;
  code: string;
  name: string;
  category: string;
  location: string;
  description: string;
  amenities: string;
  capacity: number | null;
  rules: string;
  active: boolean;
  items?: FacilityItemData[];
};

export async function getFacilitiesAdmin(): Promise<FacilityData[]> {
  const facilities = await query<FacilityData>(`SELECT * FROM facilities ORDER BY category, name`);
  const items = await query<FacilityItemData>(`SELECT * FROM facility_items ORDER BY name ASC`);
  
  const itemMap = new Map<string, FacilityItemData[]>();
  for (const it of items) {
    if (!itemMap.has(it.facility_id)) itemMap.set(it.facility_id, []);
    itemMap.get(it.facility_id)!.push(it);
  }

  return facilities.map((f) => ({
    ...f,
    items: itemMap.get(f.id) || [],
  }));
}

export async function createFacilityAdmin(
  actor: Actor,
  data: {
    code: string;
    name: string;
    category: string;
    location: string;
    description?: string;
    amenities?: string;
    capacity?: number | null;
    rules?: string;
    active?: boolean;
    items?: { name: string; quantity: number }[];
  }
) {
  if (actor.role !== "ADMIN" && actor.role !== "SUBBAG_UMUM") throw forbidden();
  const code = data.code.trim().toUpperCase();
  const name = data.name.trim();
  const category = data.category.trim();
  const location = data.location.trim();

  if (!code || !name || !category || !location) {
    throw new AppError("Kode, nama, kategori, dan lokasi fasilitas wajib diisi.", "VALIDATION");
  }

  const existing = await queryOne(`SELECT id FROM facilities WHERE code = $1`, [code]);
  if (existing) {
    throw new AppError(`Fasilitas dengan kode "${code}" sudah terdaftar.`, "VALIDATION");
  }

  return tx(async (client) => {
    const row = await queryOne<FacilityData>(
      `INSERT INTO facilities (code, name, category, location, description, amenities, capacity, rules, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        code,
        name,
        category,
        location,
        data.description?.trim() ?? "",
        data.amenities?.trim() ?? "",
        data.capacity ?? null,
        data.rules?.trim() ?? "",
        data.active ?? true,
      ],
      client
    );

    await audit(client, actor, "FACILITY_CREATED", "facility", row!.id, { code, name, category });

    // Tambahkan default barang jika disediakan
    const itemsToInsert = data.items && data.items.length > 0 ? data.items : [
      { name: "Speaker", quantity: 2 },
      { name: "Kursi", quantity: 50 },
      { name: "Sofa", quantity: 2 },
      { name: "Meja", quantity: 10 },
      { name: "Kursi Operator", quantity: 2 },
      { name: "Meja Operator", quantity: 1 }
    ];

    for (const item of itemsToInsert) {
      if (item.name && item.name.trim()) {
        await query(
          `INSERT INTO facility_items (facility_id, name, quantity) VALUES ($1, $2, $3)`,
          [row!.id, item.name.trim(), Math.max(0, Number(item.quantity) || 0)],
          client
        );
      }
    }

    return row!;
  });
}

export async function updateFacilityAdmin(
  actor: Actor,
  id: string,
  data: {
    name: string;
    category: string;
    location: string;
    description?: string;
    amenities?: string;
    capacity?: number | null;
    rules?: string;
    active?: boolean;
    items?: { id?: string; name: string; quantity: number }[];
  }
) {
  if (actor.role !== "ADMIN" && actor.role !== "SUBBAG_UMUM") throw forbidden();
  const name = data.name.trim();
  const category = data.category.trim();
  const location = data.location.trim();

  if (!name || !category || !location) {
    throw new AppError("Nama, kategori, dan lokasi fasilitas wajib diisi.", "VALIDATION");
  }

  return tx(async (client) => {
    const row = await queryOne<FacilityData>(
      `UPDATE facilities SET
        name = $2, category = $3, location = $4, description = $5,
        amenities = $6, capacity = $7, rules = $8, active = $9, updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        name,
        category,
        location,
        data.description?.trim() ?? "",
        data.amenities?.trim() ?? "",
        data.capacity ?? null,
        data.rules?.trim() ?? "",
        data.active ?? true,
      ],
      client
    );

    if (!row) throw notFound("Fasilitas tidak ditemukan.");

    // Sinkronisasi items jika diberikan
    if (data.items) {
      await query(`DELETE FROM facility_items WHERE facility_id = $1`, [id], client);
      for (const item of data.items) {
        if (item.name && item.name.trim()) {
          await query(
            `INSERT INTO facility_items (facility_id, name, quantity) VALUES ($1, $2, $3)`,
            [id, item.name.trim(), Math.max(0, Number(item.quantity) || 0)],
            client
          );
        }
      }
    }

    await audit(client, actor, "FACILITY_UPDATED", "facility", id, { name, category });
    return row;
  });
}

export async function toggleFacilityActiveAdmin(actor: Actor, id: string) {
  if (actor.role !== "ADMIN" && actor.role !== "SUBBAG_UMUM") throw forbidden();
  return tx(async (client) => {
    const row = await queryOne<FacilityData>(
      `UPDATE facilities SET active = NOT active, updated_at = now() WHERE id = $1 RETURNING *`,
      [id],
      client
    );
    if (!row) throw notFound("Fasilitas tidak ditemukan.");
    await audit(client, actor, "FACILITY_TOGGLED", "facility", id, { active: row.active });
    return row;
  });
}

export async function deleteFacilityAdmin(actor: Actor, id: string) {
  if (actor.role !== "ADMIN" && actor.role !== "SUBBAG_UMUM") throw forbidden();

  return tx(async (client) => {
    // 1. Bersihkan slot_locks terkait fasilitas ini jika ada
    await query(`DELETE FROM slot_locks WHERE facility_id = $1`, [id], client);

    // 2. Ambil semua bookings yang memakai fasilitas ini
    const bookings = await query<{ id: string }>(
      `SELECT id FROM bookings WHERE facility_id = $1`,
      [id],
      client
    );

    for (const b of bookings) {
      // 1. Hapus attachments
      await query(`DELETE FROM attachments WHERE booking_id = $1`, [b.id], client);

      // 2. Hapus sba rundown & finance items lalu sba_reports
      await query(`DELETE FROM sba_rundown_items WHERE sba_id IN (SELECT id FROM sba_reports WHERE booking_id = $1)`, [b.id], client);
      await query(`DELETE FROM sba_finance_items WHERE sba_id IN (SELECT id FROM sba_reports WHERE booking_id = $1)`, [b.id], client);
      await query(`DELETE FROM attachments WHERE sba_id IN (SELECT id FROM sba_reports WHERE booking_id = $1)`, [b.id], client);
      await query(`DELETE FROM sba_reports WHERE booking_id = $1`, [b.id], client);

      // 3. Hapus change requests, approval steps, booking items, slot locks
      await query(`DELETE FROM change_requests WHERE booking_id = $1`, [b.id], client);
      await query(`DELETE FROM approval_steps WHERE booking_id = $1`, [b.id], client);
      await query(`DELETE FROM booking_items WHERE booking_id = $1`, [b.id], client);
      await query(`DELETE FROM slot_locks WHERE booking_id = $1`, [b.id], client);

      // 4. Hapus notifications terkait booking ini
      await query(`DELETE FROM notifications WHERE link = $1`, [`/dashboard/peminjaman/${b.id}`], client);

      // 5. Hapus bookings
      await query(`DELETE FROM bookings WHERE id = $1`, [b.id], client);
    }

    // 3. Hapus fasilitas
    const row = await queryOne<FacilityData>(
      `DELETE FROM facilities WHERE id = $1 RETURNING *`,
      [id],
      client
    );

    if (!row) throw notFound("Fasilitas tidak ditemukan.");
    await audit(client, actor, "FACILITY_DELETED", "facility", id, { code: row.code, name: row.name });
    return row;
  });
}

/* =========================================================================
   2. PENGGUNA & ORGANISASI
   ========================================================================= */

export type UserRowAdmin = {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  organization_id: string | null;
  organization_name: string | null;
  organization_type: string | null;
  prodi_id: string | null;
  prodi_name: string | null;
  active: boolean;
  must_change_password: boolean;
  created_at: Date;
};

export async function getUsersAdmin(): Promise<UserRowAdmin[]> {
  return query<UserRowAdmin>(`
    SELECT
      u.id, u.username, u.display_name, u.role,
      u.organization_id, o.name AS organization_name, o.type AS organization_type,
      u.prodi_id, p.name AS prodi_name,
      u.active, u.must_change_password, u.created_at
    FROM users u
    LEFT JOIN organizations o ON o.id = u.organization_id
    LEFT JOIN prodi p ON p.id = u.prodi_id
    ORDER BY u.role, u.username
  `);
}

export async function createUserAdmin(
  actor: Actor,
  data: {
    username: string;
    password: string;
    displayName: string;
    role: Role;
    organizationId?: string | null;
    prodiId?: string | null;
  }
) {
  if (actor.role !== "ADMIN") throw forbidden();
  const username = data.username.trim().toLowerCase();
  const displayName = data.displayName.trim();
  const password = data.password.trim();

  if (!username || !displayName) {
    throw new AppError("Username dan nama tampilan wajib diisi.", "VALIDATION");
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(`Password minimal ${PASSWORD_MIN_LENGTH} karakter.`, "VALIDATION");
  }

  if (data.role === "ORG" && !data.organizationId) {
    throw new AppError("Akun Ormawa / UKM wajib dihubungkan ke salah satu organisasi.", "VALIDATION");
  }
  if (data.role === "KAPRODI" && !data.prodiId) {
    throw new AppError("Akun Ketua Program Studi (Kaprodi) wajib dihubungkan ke salah satu program studi.", "VALIDATION");
  }

  const existing = await queryOne(`SELECT id FROM users WHERE lower(username) = lower($1)`, [username]);
  if (existing) {
    throw new AppError(`Username "${username}" sudah digunakan.`, "VALIDATION");
  }

  const hash = await hashPassword(password);

  return tx(async (client) => {
    const user = await queryOne<UserRowAdmin>(
      `INSERT INTO users (username, password_hash, display_name, role, organization_id, prodi_id, active, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, true, false)
       RETURNING id, username, display_name, role, organization_id, prodi_id, active, must_change_password, created_at`,
      [
        username,
        hash,
        displayName,
        data.role,
        data.role === "ORG" ? data.organizationId || null : null,
        data.role === "KAPRODI" ? data.prodiId || null : null,
      ],
      client
    );

    await audit(client, actor, "USER_CREATED", "user", user!.id, { username, role: data.role });
    return user!;
  });
}

export async function updateUserAdmin(
  actor: Actor,
  userId: string,
  data: {
    username: string;
    displayName: string;
    role: Role;
    organizationId?: string | null;
    prodiId?: string | null;
    active?: boolean;
  }
) {
  if (actor.role !== "ADMIN") throw forbidden();
  const username = data.username.trim().toLowerCase();
  const displayName = data.displayName.trim();

  if (!username || !displayName) {
    throw new AppError("Username dan nama tampilan wajib diisi.", "VALIDATION");
  }

  if (data.role === "ORG" && !data.organizationId) {
    throw new AppError("Akun Ormawa / UKM wajib dihubungkan ke salah satu organisasi.", "VALIDATION");
  }
  if (data.role === "KAPRODI" && !data.prodiId) {
    throw new AppError("Akun Ketua Program Studi (Kaprodi) wajib dihubungkan ke salah satu program studi.", "VALIDATION");
  }

  // Cek apakah username sudah dipakai pengguna lain
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM users WHERE lower(username) = lower($1) AND id <> $2`,
    [username, userId]
  );
  if (existing) {
    throw new AppError(`Username "${username}" sudah digunakan oleh pengguna lain.`, "VALIDATION");
  }

  return tx(async (client) => {
    const user = await queryOne<UserRowAdmin>(
      `UPDATE users
       SET username = $1,
           display_name = $2,
           role = $3,
           organization_id = $4,
           prodi_id = $5,
           active = COALESCE($6, active),
           updated_at = now()
       WHERE id = $7
       RETURNING id, username, display_name, role, organization_id, prodi_id, active, must_change_password, created_at`,
      [
        username,
        displayName,
        data.role,
        data.role === "ORG" ? data.organizationId || null : null,
        data.role === "KAPRODI" ? data.prodiId || null : null,
        data.active !== undefined ? data.active : null,
        userId,
      ],
      client
    );

    if (!user) throw notFound("Pengguna tidak ditemukan.");

    await audit(client, actor, "USER_UPDATED", "user", userId, {
      username,
      displayName,
      role: data.role,
      organizationId: data.organizationId,
      prodiId: data.prodiId,
    });

    return user;
  });
}

export async function resetUserPasswordAdmin(actor: Actor, userId: string, newPassword: string) {
  if (actor.role !== "ADMIN") throw forbidden();
  const pwd = newPassword.trim();
  if (pwd.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(`Password baru minimal ${PASSWORD_MIN_LENGTH} karakter.`, "VALIDATION");
  }

  const hash = await hashPassword(pwd);
  return tx(async (client) => {
    const res = await query(
      `UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`,
      [userId, hash],
      client
    );
    if (res.length === 0 && (res as any).rowCount === 0) throw notFound("Pengguna tidak ditemukan.");
    await audit(client, actor, "USER_PASSWORD_RESET", "user", userId, {});
    return { ok: true };
  });
}

export async function toggleUserActiveAdmin(actor: Actor, userId: string) {
  if (actor.role !== "ADMIN") throw forbidden();
  if (actor.id === userId) {
    throw new AppError("Tidak dapat menonaktifkan akun sendiri.", "VALIDATION");
  }
  return tx(async (client) => {
    const row = await queryOne<{ id: string; active: boolean }>(
      `UPDATE users SET active = NOT active, updated_at = now() WHERE id = $1 RETURNING id, active`,
      [userId],
      client
    );
    if (!row) throw notFound("Pengguna tidak ditemukan.");
    await audit(client, actor, "USER_ACTIVE_TOGGLED", "user", userId, { active: row.active });
    return row;
  });
}

export async function deleteUserAdmin(actor: Actor, userId: string) {
  if (actor.role !== "ADMIN") throw forbidden();
  if (actor.id === userId) {
    throw new AppError("Tidak dapat menghapus akun Anda sendiri.", "VALIDATION");
  }

  return tx(async (client) => {
    const user = await queryOne<UserRowAdmin>(`SELECT * FROM users WHERE id = $1`, [userId], client);
    if (!user) throw notFound("Pengguna tidak ditemukan.");

    // Cek apakah akun memiliki riwayat peminjaman yang aktif/berjalan
    const activeBookings = await queryOne<{ count: string }>(
      `SELECT count(*) as count FROM bookings WHERE (created_by = $1 OR organization_id = $2) AND status IN ('DRAFT', 'PENDING', 'APPROVED')`,
      [userId, user.organization_id || "00000000-0000-0000-0000-000000000000"],
      client
    );

    if (Number(activeBookings?.count || 0) > 0) {
      throw new AppError(
        `Akun tidak dapat dihapus karena masih memiliki ${activeBookings?.count} pengajuan peminjaman aktif. Silakan batalkan/selesaikan pengajuan terlebih dahulu, atau nonaktifkan akun.`,
        "VALIDATION"
      );
    }

    // Bersihkan sesi dan relasi pembina organisasi
    await query(`DELETE FROM sessions WHERE user_id = $1`, [userId], client);
    await query(`DELETE FROM org_advisors WHERE user_id = $1`, [userId], client);
    await query(`DELETE FROM notifications WHERE user_id = $1`, [userId], client);

    // Lepaskan referensi riwayat agar integritas historis tetap terjaga
    await query(`UPDATE bookings SET created_by = NULL WHERE created_by = $1`, [userId], client);
    await query(`UPDATE bookings SET decided_by = NULL WHERE decided_by = $1`, [userId], client);
    await query(`UPDATE approval_steps SET acted_by = NULL WHERE acted_by = $1`, [userId], client);
    await query(`UPDATE change_requests SET requested_by = NULL WHERE requested_by = $1`, [userId], client);
    await query(`UPDATE change_requests SET decided_by = NULL WHERE decided_by = $1`, [userId], client);
    await query(`UPDATE sba_reports SET created_by = NULL WHERE created_by = $1`, [userId], client);
    await query(`UPDATE attachments SET uploaded_by = NULL WHERE uploaded_by = $1`, [userId], client);
    await query(`UPDATE audit_logs SET actor_user_id = NULL WHERE actor_user_id = $1`, [userId], client);

    const deleted = await queryOne<UserRowAdmin>(
      `DELETE FROM users WHERE id = $1 RETURNING *`,
      [userId],
      client
    );

    await audit(client, actor, "USER_DELETED", "user", userId, {
      username: user.username,
      displayName: user.display_name,
      role: user.role,
    });

    return deleted;
  });
}

export type OrgRowAdmin = {
  id: string;
  code: string;
  name: string;
  type: OrgType;
  prodi_id: string | null;
  prodi_name: string | null;
  active: boolean;
  advisors: { id: string; display_name: string; username: string }[];
  kaprodi: { id: string; display_name: string; username: string } | null;
};

export async function getOrganizationsAdmin(): Promise<OrgRowAdmin[]> {
  const orgs = await query<any>(`
    SELECT o.id, o.code, o.name, o.type, o.prodi_id, o.active, p.name AS prodi_name
    FROM organizations o
    LEFT JOIN prodi p ON p.id = o.prodi_id
    ORDER BY o.type, o.name
  `);

  const advisors = await query<any>(`
    SELECT oa.organization_id, u.id, u.display_name, u.username
    FROM org_advisors oa
    JOIN users u ON u.id = oa.user_id
    WHERE u.active
  `);

  const kaprodis = await query<any>(`
    SELECT u.id, u.display_name, u.username, u.prodi_id
    FROM users u
    WHERE u.role = 'KAPRODI' AND u.active AND u.prodi_id IS NOT NULL
  `);

  const kaprodiMap = new Map<string, { id: string; display_name: string; username: string }>();
  for (const k of kaprodis) {
    kaprodiMap.set(k.prodi_id, {
      id: k.id,
      display_name: k.display_name,
      username: k.username,
    });
  }

  const advisorMap = new Map<string, any[]>();
  for (const a of advisors) {
    if (!advisorMap.has(a.organization_id)) advisorMap.set(a.organization_id, []);
    advisorMap.get(a.organization_id)!.push({
      id: a.id,
      display_name: a.display_name,
      username: a.username,
    });
  }

  return orgs.map((o) => ({
    ...o,
    advisors: advisorMap.get(o.id) || [],
    kaprodi: o.prodi_id ? kaprodiMap.get(o.prodi_id) || null : null,
  }));
}

export async function assignAdvisorAdmin(actor: Actor, orgId: string, advisorUserId: string) {
  if (actor.role !== "ADMIN") throw forbidden();
  return tx(async (client) => {
    await query(
      `INSERT INTO org_advisors (organization_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [orgId, advisorUserId],
      client
    );
    await audit(client, actor, "ORG_ADVISOR_ASSIGNED", "organization", orgId, { advisorUserId });
    return { ok: true };
  });
}

export async function removeAdvisorAdmin(actor: Actor, orgId: string, advisorUserId: string) {
  if (actor.role !== "ADMIN") throw forbidden();
  return tx(async (client) => {
    await query(
      `DELETE FROM org_advisors WHERE organization_id = $1 AND user_id = $2`,
      [orgId, advisorUserId],
      client
    );
    await audit(client, actor, "ORG_ADVISOR_REMOVED", "organization", orgId, { advisorUserId });
    return { ok: true };
  });
}

export async function assignOrgProdiAdmin(actor: Actor, orgId: string, prodiId: string | null) {
  if (actor.role !== "ADMIN") throw forbidden();
  return tx(async (client) => {
    const row = await queryOne<{ id: string; name: string }>(
      `UPDATE organizations SET prodi_id = $2, updated_at = now() WHERE id = $1 RETURNING id, name`,
      [orgId, prodiId || null],
      client
    );
    if (!row) throw notFound("Organisasi tidak ditemukan.");
    await audit(client, actor, "ORG_PRODI_UPDATED", "organization", orgId, { prodiId });
    return row;
  });
}

/* =========================================================================
   3. PENGATURAN SISTEM & KEBIJAKAN
   ========================================================================= */

export type SettingItem = {
  key: string;
  value: any;
  description: string;
  updated_at: Date;
};

export async function getSettingsAdmin(): Promise<SettingItem[]> {
  return query<SettingItem>(`SELECT key, value, description, updated_at FROM settings ORDER BY key`);
}

export async function updateSettingAdmin(actor: Actor, key: string, value: any) {
  if (actor.role !== "ADMIN") throw forbidden();
  return tx(async (client) => {
    const row = await queryOne<SettingItem>(
      `UPDATE settings SET value = $2, updated_at = now() WHERE key = $1 RETURNING *`,
      [key, JSON.stringify(value)],
      client
    );
    if (!row) throw notFound("Pengaturan tidak ditemukan.");
    await audit(client, actor, "SETTING_UPDATED", "setting", key, { value });
    return row;
  });
}

/* =========================================================================
   4. LOG AUDIT
   ========================================================================= */

export type AuditLogRow = {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_username: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_title?: string | null;
  booking_items_summary?: string | null;
  booking_committee?: any[] | null;
  booking_rundown?: any[] | null;
  data: any;
  ip: string | null;
  created_at: Date;
};

export async function getAuditLogsAdmin(limit = 150, offset = 0): Promise<AuditLogRow[]> {
  return query<AuditLogRow>(`
    SELECT
      a.id, a.actor_user_id, u.display_name AS actor_name, u.username AS actor_username,
      a.action, a.entity_type, a.entity_id, a.data, a.ip, a.created_at,
      CASE
        WHEN a.entity_type = 'booking' THEN b.title
        WHEN a.entity_type = 'facility' THEN f.name
        WHEN a.entity_type = 'user' THEN u_target.display_name
        WHEN a.entity_type = 'organization' THEN o_target.name
        ELSE NULL
      END AS entity_title,
      CASE
        WHEN a.entity_type = 'booking' THEN (
          SELECT string_agg(bi.name || ' (' || bi.quantity || ' unit)', ', ')
          FROM booking_items bi WHERE bi.booking_id = b.id
        )
        ELSE NULL
      END AS booking_items_summary,
      CASE WHEN a.entity_type = 'booking' THEN b.committee ELSE NULL END AS booking_committee,
      CASE WHEN a.entity_type = 'booking' THEN b.rundown ELSE NULL END AS booking_rundown
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_user_id
    LEFT JOIN bookings b ON a.entity_type = 'booking' AND b.id::text = a.entity_id
    LEFT JOIN facilities f ON a.entity_type = 'facility' AND f.id::text = a.entity_id
    LEFT JOIN users u_target ON a.entity_type = 'user' AND u_target.id::text = a.entity_id
    LEFT JOIN organizations o_target ON a.entity_type = 'organization' AND o_target.id::text = a.entity_id
    ORDER BY a.created_at DESC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);
}

/**
 * Mengambil histori log aktivitas khusus akun yang sedang login (keamanan: hanya data milik akun sendiri).
 */
export async function getUserActivityLogs(userId: string, orgId?: string | null, limit = 50): Promise<AuditLogRow[]> {
  return query<AuditLogRow>(`
    SELECT
      a.id, a.actor_user_id, u.display_name AS actor_name, u.username AS actor_username,
      a.action, a.entity_type, a.entity_id, a.data, a.ip, a.created_at,
      CASE
        WHEN a.entity_type = 'booking' THEN b.title
        WHEN a.entity_type = 'facility' THEN f.name
        WHEN a.entity_type = 'user' THEN u_target.display_name
        WHEN a.entity_type = 'organization' THEN o_target.name
        ELSE NULL
      END AS entity_title,
      CASE
        WHEN a.entity_type = 'booking' THEN (
          SELECT string_agg(bi.name || ' (' || bi.quantity || ' unit)', ', ')
          FROM booking_items bi WHERE bi.booking_id = b.id
        )
        ELSE NULL
      END AS booking_items_summary,
      CASE WHEN a.entity_type = 'booking' THEN b.committee ELSE NULL END AS booking_committee,
      CASE WHEN a.entity_type = 'booking' THEN b.rundown ELSE NULL END AS booking_rundown
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_user_id
    LEFT JOIN bookings b ON a.entity_type = 'booking' AND b.id::text = a.entity_id
    LEFT JOIN facilities f ON a.entity_type = 'facility' AND f.id::text = a.entity_id
    LEFT JOIN users u_target ON a.entity_type = 'user' AND u_target.id::text = a.entity_id
    LEFT JOIN organizations o_target ON a.entity_type = 'organization' AND o_target.id::text = a.entity_id
    WHERE a.actor_user_id = $1
       OR ($2::uuid IS NOT NULL AND a.actor_org_id = $2::uuid)
    ORDER BY a.created_at DESC
    LIMIT $3
  `, [userId, orgId || null, limit]);
}

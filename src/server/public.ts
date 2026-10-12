import { query, getPool, type Db } from "./db";
import { localDate, toLocalInput, fmtTime, fmtRange } from "@/lib/time";

export type CurrentUsageInfo = {
  bookingId: string;
  title: string;
  orgName: string;
  orgType: string;
  eventStart: Date;
  eventEnd: Date;
  usageEnd: Date;
};

export type UpcomingUsageInfo = {
  bookingId: string;
  title: string;
  orgName: string;
  orgType: string;
  eventStart: Date;
  eventEnd: Date;
};

export type PublicFacility = {
  id: string;
  code: string;
  name: string;
  category: string;
  location: string;
  description: string;
  amenities: string;
  capacity: number | null;
  active: boolean;
  isFree: boolean;
  currentStatus: "TERSEDIA" | "SEDANG_DIGUNAKAN" | "TERJADWAL";
  currentUsage: CurrentUsageInfo | null;
  nextUsage: UpcomingUsageInfo | null;
};

export type PublicScheduleItem = {
  id: string;
  facilityId: string;
  facilityName: string;
  facilityLocation: string;
  title: string;
  orgName: string;
  orgType: string;
  eventStart: Date;
  eventEnd: Date;
};

/**
 * Mengambil daftar fasilitas untuk portal publik beserta status real-time:
 * - Apakah sedang digunakan atau free
 * - Pihak mana yang menggunakan & nama acara
 * - Hingga jam berapa penggunaan berlangsung
 */
export async function getPublicFacilities(db: Db = getPool()): Promise<PublicFacility[]> {
  const facs = await query<any>(
    `SELECT f.*,
      (
        SELECT json_build_object(
          'bookingId', b.id,
          'title', b.title,
          'orgName', o.name,
          'orgType', o.type,
          'eventStart', b.event_start,
          'eventEnd', b.event_end,
          'usageEnd', b.usage_end
        )
        FROM bookings b
        JOIN organizations o ON o.id = b.organization_id
        WHERE b.facility_id = f.id
          AND b.status = 'APPROVED'
          AND now() >= b.usage_start AND now() <= b.usage_end
        ORDER BY b.usage_end DESC
        LIMIT 1
      ) AS active_booking,
      (
        SELECT json_build_object(
          'bookingId', b.id,
          'title', b.title,
          'orgName', o.name,
          'orgType', o.type,
          'eventStart', b.event_start,
          'eventEnd', b.event_end
        )
        FROM bookings b
        JOIN organizations o ON o.id = b.organization_id
        WHERE b.facility_id = f.id
          AND b.status = 'APPROVED'
          AND b.usage_start > now()
        ORDER BY b.usage_start ASC
        LIMIT 1
      ) AS next_booking
    FROM facilities f
    WHERE f.active = true
    ORDER BY f.name ASC`
  );

  return facs.map((f) => {
    const activeB = f.active_booking;
    const nextB = f.next_booking;

    let status: "TERSEDIA" | "SEDANG_DIGUNAKAN" | "TERJADWAL" = "TERSEDIA";
    if (activeB) {
      status = "SEDANG_DIGUNAKAN";
    } else if (nextB) {
      status = "TERJADWAL";
    }

    return {
      id: f.id,
      code: f.code,
      name: f.name,
      category: f.category,
      location: f.location,
      description: f.description,
      amenities: f.amenities,
      capacity: f.capacity,
      active: f.active,
      isFree: !activeB,
      currentStatus: status,
      currentUsage: activeB
        ? {
            bookingId: activeB.bookingId,
            title: activeB.title,
            orgName: activeB.orgName,
            orgType: activeB.orgType,
            eventStart: new Date(activeB.eventStart),
            eventEnd: new Date(activeB.eventEnd),
            usageEnd: new Date(activeB.usageEnd),
          }
        : null,
      nextUsage: nextB
        ? {
            bookingId: nextB.bookingId,
            title: nextB.title,
            orgName: nextB.orgName,
            orgType: nextB.orgType,
            eventStart: new Date(nextB.eventStart),
            eventEnd: new Date(nextB.eventEnd),
          }
        : null,
    };
  });
}

/**
 * Mengambil jadwal kegiatan terkonfirmasi (APPROVED) untuk portal publik.
 */
export async function getPublicConfirmedSchedules(
  facilityId?: string,
  db: Db = getPool()
): Promise<PublicScheduleItem[]> {
  const params: unknown[] = [];
  let filter = "";
  if (facilityId) {
    params.push(facilityId);
    filter = "AND b.facility_id = $1";
  }

  const rows = await query<any>(
    `SELECT
      b.id,
      b.facility_id,
      f.name AS facility_name,
      f.location AS facility_location,
      b.title,
      o.name AS org_name,
      o.type AS org_type,
      b.event_start,
      b.event_end
    FROM bookings b
    JOIN facilities f ON f.id = b.facility_id
    JOIN organizations o ON o.id = b.organization_id
    WHERE b.status = 'APPROVED'
      AND b.event_end >= (now() - interval '1 day')
      ${filter}
    ORDER BY b.event_start ASC
    LIMIT 200`,
    params
  );

  return rows.map((r) => ({
    id: r.id,
    facilityId: r.facility_id,
    facilityName: r.facility_name,
    facilityLocation: r.facility_location,
    title: r.title,
    orgName: r.org_name,
    orgType: r.org_type,
    eventStart: r.event_start,
    eventEnd: r.event_end,
  }));
}

export type PetugasBookingItem = {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
};

export type PetugasBooking = {
  id: string;
  code: string;
  title: string;
  purpose: string | null;
  description: string | null;
  specialNotes: string | null;
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  facilityCategory: string;
  facilityLocation: string;
  orgName: string;
  orgType: string;
  usageStart: string;
  usageEnd: string;
  eventStart: string;
  eventEnd: string;
  chairName: string | null;
  chairContact: string | null;
  leadName: string | null;
  leadContact: string | null;
  committee: Array<{ name: string; nim?: string; prodi?: string }>;
  rundown: Array<{ time?: string; agenda: string; pic?: string }>;
  items: PetugasBookingItem[];
  status: string;
};

/**
 * Mengambil data kegiatan resmi yang telah disetujui (APPROVED) untuk portal operasional Satpam & Unit Bisnis (UB).
 * Menyediakan rincian lengkap barang/sarana, kontak PIC, dan rundown untuk pengawasan lapangan & serah terima.
 */
export async function getPublicPetugasBookings(
  options?: {
    facilityId?: string;
    dateFilter?: "today" | "tomorrow" | "week" | "all";
    search?: string;
    db?: Db;
  }
): Promise<PetugasBooking[]> {
  const db = options?.db ?? getPool();
  const params: unknown[] = [];
  let conditions: string[] = ["b.status = 'APPROVED'"];

  if (options?.facilityId) {
    params.push(options.facilityId);
    conditions.push(`b.facility_id = $${params.length}`);
  }

  if (options?.dateFilter === "today") {
    conditions.push(`(b.usage_start::date <= CURRENT_DATE AND b.usage_end::date >= CURRENT_DATE)`);
  } else if (options?.dateFilter === "tomorrow") {
    conditions.push(`(b.usage_start::date <= (CURRENT_DATE + interval '1 day')::date AND b.usage_end::date >= (CURRENT_DATE + interval '1 day')::date)`);
  } else if (options?.dateFilter === "week") {
    conditions.push(`b.usage_end >= CURRENT_DATE AND b.usage_start <= (CURRENT_DATE + interval '7 days')`);
  } else {
    // Default / "all": tampilkan dari kemarin ke masa depan
    conditions.push(`b.usage_end >= (now() - interval '2 days')`);
  }

  if (options?.search && options.search.trim()) {
    params.push(`%${options.search.trim()}%`);
    const p = `$${params.length}`;
    conditions.push(`(b.title ILIKE ${p} OR b.code ILIKE ${p} OR o.name ILIKE ${p} OR f.name ILIKE ${p} OR b.lead_name ILIKE ${p})`);
  }

  const whereClause = conditions.join(" AND ");

  const rows = await query<any>(
    `SELECT
      b.id,
      b.code,
      b.title,
      b.purpose,
      b.description,
      b.special_notes,
      b.usage_start,
      b.usage_end,
      b.event_start,
      b.event_end,
      b.chair_name,
      b.chair_contact,
      b.lead_name,
      b.lead_contact,
      b.committee,
      b.rundown,
      b.status,
      f.id AS facility_id,
      f.code AS facility_code,
      f.name AS facility_name,
      f.category AS facility_category,
      f.location AS facility_location,
      o.name AS org_name,
      o.type AS org_type,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', bi.id,
              'name', bi.name,
              'quantity', bi.quantity,
              'notes', bi.notes
            ) ORDER BY bi.name ASC
          )
          FROM booking_items bi
          WHERE bi.booking_id = b.id
        ), '[]'::json
      ) AS items
    FROM bookings b
    JOIN facilities f ON f.id = b.facility_id
    JOIN organizations o ON o.id = b.organization_id
    WHERE ${whereClause}
    ORDER BY b.usage_start ASC
    LIMIT 200`,
    params,
    db
  );

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    purpose: r.purpose,
    description: r.description,
    specialNotes: r.special_notes,
    facilityId: r.facility_id,
    facilityCode: r.facility_code,
    facilityName: r.facility_name,
    facilityCategory: r.facility_category,
    facilityLocation: r.facility_location,
    orgName: r.org_name,
    orgType: r.org_type,
    usageStart: new Date(r.usage_start).toISOString(),
    usageEnd: new Date(r.usage_end).toISOString(),
    eventStart: new Date(r.event_start).toISOString(),
    eventEnd: new Date(r.event_end).toISOString(),
    chairName: r.chair_name,
    chairContact: r.chair_contact,
    leadName: r.lead_name,
    leadContact: r.lead_contact,
    committee: Array.isArray(r.committee) ? r.committee : [],
    rundown: Array.isArray(r.rundown) ? r.rundown : [],
    items: Array.isArray(r.items) ? r.items : [],
    status: r.status,
  }));
}


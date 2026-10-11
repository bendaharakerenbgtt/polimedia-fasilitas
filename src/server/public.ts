import { query, type Db } from "./db";
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
export async function getPublicFacilities(db: Db = query as any): Promise<PublicFacility[]> {
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
  db: Db = query as any,
  facilityId?: string
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

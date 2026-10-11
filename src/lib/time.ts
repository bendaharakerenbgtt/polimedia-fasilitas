/** Utilitas waktu. Kampus berada di WIB (Asia/Jakarta, UTC+7, tanpa DST). */
export const TZ = "Asia/Jakarta";
const OFFSET = "+07:00";

/** Mengubah nilai <input type="datetime-local"> (waktu WIB) menjadi Date. */
export function parseLocalDateTime(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(v)) return null;
  const d = new Date(v.length === 16 ? `${v}:00${OFFSET}` : `${v}${OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "YYYY-MM-DDTHH:mm" dalam WIB, untuk mengisi input datetime-local. */
export function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const wib = new Date(date.getTime() + 7 * 3600 * 1000);
  return wib.toISOString().slice(0, 16);
}

const dtf = new Intl.DateTimeFormat("id-ID", {
  timeZone: TZ,
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const tf = new Intl.DateTimeFormat("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const df = new Intl.DateTimeFormat("id-ID", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export const fmtDateTime = (d: Date | string) => dtf.format(new Date(d));
export const fmtTime = (d: Date | string) => tf.format(new Date(d));
export const fmtDate = (d: Date | string) => df.format(new Date(d));

/** Rentang ringkas: jika hari sama tampilkan "Sen, 12 Okt 2026 09.00–12.00". */
export function fmtRange(a: Date | string, b: Date | string) {
  const s = new Date(a);
  const e = new Date(b);
  const sameDay = toLocalInput(s).slice(0, 10) === toLocalInput(e).slice(0, 10);
  return sameDay ? `${fmtDateTime(s)}–${fmtTime(e)}` : `${fmtDateTime(s)} – ${fmtDateTime(e)}`;
}

/** Tanggal WIB "YYYY-MM-DD". */
export const localDate = (d: Date | string) => toLocalInput(d).slice(0, 10);

/** Jam operasional resmi perizinan fasilitas kampus: 06:00 - 18:30 WIB */
export const OPERATIONAL_START_TIME = "06:00";
export const OPERATIONAL_END_TIME = "18:30";

/** Mengembalikan string waktu WIB format "HH:mm" dari Date atau string datetime-local */
export function getWibTimeStr(d: Date | string): string {
  if (typeof d === "string" && d.includes("T")) {
    return d.slice(11, 16);
  }
  const date = typeof d === "string" ? new Date(d) : d;
  const wib = new Date(date.getTime() + 7 * 3600 * 1000);
  return wib.toISOString().slice(11, 16);
}

/** Mengembalikan tanggal WIB format "YYYY-MM-DD" dari Date atau string datetime-local */
export function getWibDateStr(d: Date | string): string {
  if (typeof d === "string" && d.includes("T")) {
    return d.slice(0, 10);
  }
  const date = typeof d === "string" ? new Date(d) : d;
  const wib = new Date(date.getTime() + 7 * 3600 * 1000);
  return wib.toISOString().slice(0, 10);
}

/** Validasi apakah waktu peminjaman berada dalam rentang jam operasional kampus (06:00 - 18:30 WIB) */
export function isWithinOperationalHours(
  usageStart: Date | string,
  usageEnd: Date | string
): { valid: boolean; reason?: string } {
  const startDate = getWibDateStr(usageStart);
  const endDate = getWibDateStr(usageEnd);

  if (startDate !== endDate) {
    return {
      valid: false,
      reason: "Peminjaman fasilitas harus selesai di hari yang sama dalam jam operasional kampus (06:00 – 18:30 WIB).",
    };
  }

  const startTime = getWibTimeStr(usageStart);
  const endTime = getWibTimeStr(usageEnd);

  if (startTime < OPERATIONAL_START_TIME) {
    return {
      valid: false,
      reason: `Waktu mulai penggunaan fasilitas paling awal adalah pukul ${OPERATIONAL_START_TIME} WIB.`,
    };
  }

  if (endTime > OPERATIONAL_END_TIME) {
    return {
      valid: false,
      reason: `Waktu selesai penggunaan fasilitas paling lambat adalah pukul ${OPERATIONAL_END_TIME} WIB.`,
    };
  }

  return { valid: true };
}

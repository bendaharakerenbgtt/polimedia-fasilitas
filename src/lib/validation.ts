import { z } from "zod";
import { parseLocalDateTime, isWithinOperationalHours } from "./time";

const dt = z
  .union([z.string(), z.date()])
  .transform((v, ctx) => {
    const d = v instanceof Date ? v : parseLocalDateTime(v);
    if (!d) {
      ctx.addIssue({ code: "custom", message: "Format tanggal/waktu tidak valid" });
      return z.NEVER;
    }
    return d;
  });

/** Empat titik waktu: penggunaan fasilitas membungkus waktu acara. */
export const scheduleSchema = z
  .object({
    usageStart: dt,
    eventStart: dt,
    eventEnd: dt,
    usageEnd: dt,
  })
  .superRefine((s, ctx) => {
    if (s.usageStart > s.eventStart)
      ctx.addIssue({ code: "custom", path: ["usageStart"], message: "Mulai penggunaan harus sebelum/sama dengan mulai acara" });
    if (s.eventStart >= s.eventEnd)
      ctx.addIssue({ code: "custom", path: ["eventEnd"], message: "Selesai acara harus setelah mulai acara" });
    if (s.eventEnd > s.usageEnd)
      ctx.addIssue({ code: "custom", path: ["usageEnd"], message: "Akhir penggunaan harus setelah/sama dengan selesai acara" });

    // Validasi jam operasional fasilitas kampus: 06:00 - 18:30 WIB
    const op = isWithinOperationalHours(s.usageStart, s.usageEnd);
    if (!op.valid) {
      ctx.addIssue({
        code: "custom",
        path: ["usageStart"],
        message: op.reason ?? "Peminjaman fasilitas hanya diizinkan antara pukul 06:00 s.d. 18:30 WIB.",
      });
    }
  });
export type ScheduleInput = z.input<typeof scheduleSchema>;
export type Schedule = z.output<typeof scheduleSchema>;

const str = (max: number) => z.string().trim().max(max);
const req = (max: number, label: string) => str(max).min(1, `${label} wajib diisi`);
const phone = z
  .string()
  .trim()
  .max(30)
  .regex(/^[0-9+()\-\s]*$/, "Nomor kontak hanya boleh berisi angka dan + ( ) -");

export const bookingDetailsSchema = z.object({
  title: str(200),
  purpose: str(500),
  description: str(5000),
  chairName: str(150),
  chairContact: phone,
  leadName: str(150).default(""),
  leadContact: phone.default(""),
  participants: str(5000).default(""),
  otherParties: z
    .array(z.object({ name: str(150).default(""), role: str(150).default(""), contact: phone.default("") }))
    .max(30)
    .default([]),
  committee: z
    .array(
      z.object({
        name: str(150).default(""),
        division: str(100).default(""),
        nim: str(50).default(""),
        prodi: str(100).default(""),
      })
    )
    .max(200)
    .default([]),
  rundown: z
    .array(
      z.object({
        agenda: str(300).default(""),
        time: str(100).default(""),
        startTime: str(10).default(""),
        endTime: str(10).default(""),
        pic: str(150).default(""),
      })
    )
    .max(200)
    .default([]),
  items: z
    .array(
      z.object({
        name: req(150, "Nama barang"),
        quantity: z.coerce.number().int("Jumlah harus bilangan bulat").min(1, "Jumlah minimal 1").max(100000),
        notes: str(300).default(""),
      })
    )
    .max(100)
    .default([]),
  specialNotes: str(2000).default(""),
});
export type BookingDetails = z.output<typeof bookingDetailsSchema>;

/** Kolom yang wajib lengkap sebelum pengajuan dapat dikirim. */
export const submitRequiredSchema = z.object({
  title: req(200, "Nama kegiatan"),
  purpose: req(500, "Perihal/tujuan"),
  description: req(5000, "Deskripsi kegiatan"),
  chairName: req(150, "Nama ketua organisasi"),
  chairContact: req(30, "Kontak ketua organisasi"),
  leadName: str(150).default(""),
  leadContact: str(30).default(""),
});

export function firstError(err: z.ZodError): string {
  const i = err.issues[0];
  return i ? i.message : "Input tidak valid";
}

import "server-only";
import { getPool, query, queryOne, tx, type Db } from "./db";
import { AppError, forbidden, notFound, type Actor } from "./core";
import { assertCanViewBooking } from "./access";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.cwd(), process.env.UPLOAD_DIR)
  : process.env.VERCEL
  ? "/tmp/uploads"
  : path.resolve(process.cwd(), ".data/uploads");

/**
 * Menyimpan file yang diunggah ke disk lokal di luar folder publik.
 */
export async function saveAttachment(
  actor: Actor,
  params: {
    bookingId?: string;
    sbaId?: string;
    changeReqId?: string;
    fileName: string;
    mimeType: string;
    fileBuffer: Buffer;
    category?: string;
  }
) {
  await mkdir(UPLOAD_BASE_DIR, { recursive: true });

  // Validasi izin pengunggahan
  if (params.bookingId) {
    await assertCanViewBooking(getPool(), actor, params.bookingId);
  }

  const fileExt = path.extname(params.fileName) || "";
  const randomKey = crypto.randomBytes(16).toString("hex");
  const storedFilename = `${Date.now()}-${randomKey}${fileExt}`;
  const absolutePath = path.join(UPLOAD_BASE_DIR, storedFilename);

  await writeFile(absolutePath, params.fileBuffer);

  const res = await queryOne<{ id: string }>(
    `INSERT INTO attachments (
      booking_id, sba_id, change_req_id,
      file_name, storage_path, mime_type, file_size,
      category, uploaded_by
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6, $7,
      $8, $9
    ) RETURNING id`,
    [
      params.bookingId ?? null,
      params.sbaId ?? null,
      params.changeReqId ?? null,
      params.fileName,
      storedFilename,
      params.mimeType,
      params.fileBuffer.length,
      params.category ?? "OTHER",
      actor.id,
    ]
  );

  return res!.id;
}

/**
 * Mengambil file lampiran dengan verifikasi otorisasi ketat.
 */
export async function getAttachmentForDownload(
  actor: Actor,
  attachmentId: string
): Promise<{ fileName: string; mimeType: string; buffer: Buffer }> {
  const row = await queryOne<{
    id: string;
    booking_id: string | null;
    sba_id: string | null;
    change_req_id: string | null;
    file_name: string;
    storage_path: string;
    mime_type: string;
  }>(`SELECT * FROM attachments WHERE id = $1`, [attachmentId]);

  if (!row) throw notFound("File tidak ditemukan.");

  // Cek otorisasi lewat booking terkait
  if (row.booking_id) {
    await assertCanViewBooking(getPool(), actor, row.booking_id);
  }

  const filePath = path.join(UPLOAD_BASE_DIR, row.storage_path);
  try {
    const buffer = await readFile(filePath);
    return {
      fileName: row.file_name,
      mimeType: row.mime_type,
      buffer,
    };
  } catch (err) {
    throw notFound("File fisik tidak ditemukan pada server.");
  }
}

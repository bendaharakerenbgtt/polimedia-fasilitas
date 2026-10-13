"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import {
  createBookingDraft,
  updateBookingDraft,
  submitBooking,
  withdrawPendingBooking,
} from "@/server/bookings";
import { parseLocalDateTime } from "@/lib/time";
import { AppError } from "@/server/core";
import { actOnBooking, type StepAction } from "@/server/approvals";
import { requestBookingChange, decideChangeRequest } from "@/server/changes";

export async function createBookingDraftAction(prevState: any, formData: FormData) {
  const user = await requireUser(["ORG"]);
  const facilityId = String(formData.get("facilityId") ?? "");
  const usageStartStr = String(formData.get("usageStart") ?? "");
  const eventStartStr = String(formData.get("eventStart") ?? "");
  const eventEndStr = String(formData.get("eventEnd") ?? "");
  const usageEndStr = String(formData.get("usageEnd") ?? "");

  const usageStart = parseLocalDateTime(usageStartStr);
  const eventStart = parseLocalDateTime(eventStartStr);
  const eventEnd = parseLocalDateTime(eventEndStr);
  const usageEnd = parseLocalDateTime(usageEndStr);

  if (!facilityId || !usageStart || !eventStart || !eventEnd || !usageEnd) {
    return { error: "Semua data waktu dan fasilitas wajib diisi dengan benar." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const chairName = String(formData.get("chairName") ?? "").trim();
  const chairContact = String(formData.get("chairContact") ?? "").trim();
  const leadName = String(formData.get("leadName") ?? "").trim();
  const leadContact = String(formData.get("leadContact") ?? "").trim();
  const specialNotes = String(formData.get("specialNotes") ?? "").trim();

  // Parse items, committee, rundown
  let items: any[] = [];
  try {
    const rawItems = formData.get("itemsJson");
    if (rawItems) items = JSON.parse(String(rawItems));
  } catch {}

  let committee: any[] = [];
  try {
    const rawComm = formData.get("committeeJson");
    if (rawComm) committee = JSON.parse(String(rawComm));
  } catch {}

  let rundown: any[] = [];
  try {
    const rawRun = formData.get("rundownJson");
    if (rawRun) rundown = JSON.parse(String(rawRun));
  } catch {}

  try {
    const booking = await createBookingDraft(user, {
      facilityId,
      usageStart,
      eventStart,
      eventEnd,
      usageEnd,
      details: {
        title,
        purpose,
        description,
        chairName,
        chairContact,
        leadName,
        leadContact,
        specialNotes,
        items,
        committee,
        rundown,
      },
    });

    redirect(`/dashboard/peminjaman/${booking.id}`);
  } catch (err: any) {
    if (err?.message === "NEXT_REDIRECT") throw err;
    if (err?.issues && Array.isArray(err.issues)) {
      return { error: err.issues.map((i: any) => i.message).join(", ") };
    }
    return { error: err?.message || "Terjadi kesalahan saat membuat draft." };
  }
}

export async function updateBookingDraftAction(bookingId: string, prevState: any, formData: FormData) {
  const user = await requireUser(["ORG"]);
  const facilityId = String(formData.get("facilityId") ?? "");
  const usageStartStr = String(formData.get("usageStart") ?? "");
  const eventStartStr = String(formData.get("eventStart") ?? "");
  const eventEndStr = String(formData.get("eventEnd") ?? "");
  const usageEndStr = String(formData.get("usageEnd") ?? "");

  const usageStart = parseLocalDateTime(usageStartStr);
  const eventStart = parseLocalDateTime(eventStartStr);
  const eventEnd = parseLocalDateTime(eventEndStr);
  const usageEnd = parseLocalDateTime(usageEndStr);

  if (!facilityId || !usageStart || !eventStart || !eventEnd || !usageEnd) {
    return { error: "Semua data waktu dan fasilitas wajib diisi dengan benar." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const purpose = String(formData.get("purpose") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const chairName = String(formData.get("chairName") ?? "").trim();
  const chairContact = String(formData.get("chairContact") ?? "").trim();
  const leadName = String(formData.get("leadName") ?? "").trim();
  const leadContact = String(formData.get("leadContact") ?? "").trim();
  const specialNotes = String(formData.get("specialNotes") ?? "").trim();

  // Parse items, committee, rundown
  let items: any[] = [];
  try {
    const rawItems = formData.get("itemsJson");
    if (rawItems) items = JSON.parse(String(rawItems));
  } catch {}

  let committee: any[] = [];
  try {
    const rawComm = formData.get("committeeJson");
    if (rawComm) committee = JSON.parse(String(rawComm));
  } catch {}

  let rundown: any[] = [];
  try {
    const rawRun = formData.get("rundownJson");
    if (rawRun) rundown = JSON.parse(String(rawRun));
  } catch {}

  const andSubmit = formData.get("andSubmit") === "true";

  try {
    await updateBookingDraft(user, bookingId, {
      facilityId,
      usageStart,
      eventStart,
      eventEnd,
      usageEnd,
      details: {
        title,
        purpose,
        description,
        chairName,
        chairContact,
        leadName,
        leadContact,
        specialNotes,
        items,
        committee,
        rundown,
      },
    });

    if (andSubmit) {
      await submitBooking(user, bookingId);
    }

    revalidatePath(`/dashboard/peminjaman/${bookingId}`);
    redirect(`/dashboard/peminjaman/${bookingId}`);
  } catch (err: any) {
    if (err?.message === "NEXT_REDIRECT") throw err;
    if (err?.issues && Array.isArray(err.issues)) {
      return { error: err.issues.map((i: any) => i.message).join(", ") };
    }
    return { error: err?.message || "Terjadi kesalahan saat memperbarui formulir." };
  }
}

export async function submitBookingAction(bookingId: string) {
  const user = await requireUser(["ORG"]);
  try {
    await submitBooking(user, bookingId);
    revalidatePath(`/dashboard/peminjaman/${bookingId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal mengirim formulir pengajuan." };
  }
}

export async function withdrawBookingAction(bookingId: string, reason?: string) {
  const user = await requireUser(["ORG"]);
  try {
    await withdrawPendingBooking(user, bookingId, reason);
    revalidatePath(`/dashboard/peminjaman/${bookingId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal menarik pengajuan." };
  }
}

export async function actOnBookingAction(bookingId: string, action: StepAction, note: string) {
  const user = await requireUser();
  try {
    await actOnBooking(user, bookingId, action, note);
    revalidatePath(`/dashboard/peminjaman/${bookingId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal memproses tindakan persetujuan." };
  }
}

export async function requestChangeAction(
  bookingId: string,
  params: {
    type: "CANCEL" | "RESCHEDULE";
    reason: string;
    newUsageStart?: string;
    newEventStart?: string;
    newEventEnd?: string;
    newUsageEnd?: string;
  }
) {
  const user = await requireUser(["ORG"]);
  try {
    await requestBookingChange(user, bookingId, {
      type: params.type,
      reason: params.reason,
      newUsageStart: params.newUsageStart ? parseLocalDateTime(params.newUsageStart) ?? undefined : undefined,
      newEventStart: params.newEventStart ? parseLocalDateTime(params.newEventStart) ?? undefined : undefined,
      newEventEnd: params.newEventEnd ? parseLocalDateTime(params.newEventEnd) ?? undefined : undefined,
      newUsageEnd: params.newUsageEnd ? parseLocalDateTime(params.newUsageEnd) ?? undefined : undefined,
    });
    revalidatePath(`/dashboard/peminjaman/${bookingId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal mengajukan permohonan." };
  }
}

export async function decideChangeAction(
  changeRequestId: string,
  bookingId: string,
  approved: boolean,
  decisionNote?: string
) {
  const user = await requireUser(["WADIR"]);
  try {
    await decideChangeRequest(user, changeRequestId, approved, decisionNote);
    revalidatePath(`/dashboard/peminjaman/${bookingId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal memproses permohonan." };
  }
}

export async function archiveBookingAction(bookingId: string) {
  const user = await requireUser();
  try {
    const { query } = await import("@/server/db");
    // Tandai pengajuan sebagai diarsipkan
    await query(
      `UPDATE bookings SET archived_at = now() WHERE id = $1`,
      [bookingId]
    );
    // Tandai notifikasi terkait booking ini sebagai terbaca
    await query(
      `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND link = $2`,
      [user.id, `/dashboard/peminjaman/${bookingId}`]
    );
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/aktivitas");
    revalidatePath(`/dashboard/peminjaman/${bookingId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal mengarsipkan pengajuan." };
  }
}

export async function markNotificationReadAction(notificationId: string) {
  const user = await requireUser();
  try {
    const { query } = await import("@/server/db");
    await query(
      `UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2`,
      [notificationId, user.id]
    );
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal menandai notifikasi." };
  }
}

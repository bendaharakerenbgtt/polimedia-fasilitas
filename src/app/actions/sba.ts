"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { getOrCreateSba, saveSba, type SbaFinanceItem, type SbaRundownItem } from "@/server/sba";

export async function saveSbaAction(
  sbaId: string,
  bookingId: string,
  data: {
    docNumber?: string;
    description?: string;
    outcomes?: string;
    obstacles?: string;
    evaluation?: string;
    rundown?: SbaRundownItem[];
    finances?: SbaFinanceItem[];
    submit?: boolean;
  }
) {
  const user = await requireUser(["ORG"]);
  try {
    await saveSba(user, sbaId, data);
    revalidatePath(`/dashboard/sba/${bookingId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Gagal menyimpan laporan SBA." };
  }
}

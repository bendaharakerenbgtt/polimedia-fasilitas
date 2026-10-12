import { requireUser } from "@/server/auth";
import { query, queryOne } from "@/server/db";
import { notFound, redirect } from "next/navigation";
import { getFacilityBookedSlots, getStandardInventoryItems, getFacilityItemsMap } from "@/server/bookings";
import NewBookingForm from "../../baru/NewBookingForm";

export const dynamic = "force-dynamic";

export default async function EditBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(["ORG"]);

  const [booking, items, facilities, bookedSlots, standardItems, facilityItemsMap] = await Promise.all([
    queryOne<any>(`SELECT * FROM bookings WHERE id = $1`, [id]),
    query<any>(`SELECT * FROM booking_items WHERE booking_id = $1`, [id]),
    query<any>(
      `SELECT id, name, category, location, code FROM facilities WHERE active = true ORDER BY name ASC`
    ),
    getFacilityBookedSlots(),
    getStandardInventoryItems(),
    getFacilityItemsMap(),
  ]);

  if (!booking || booking.organization_id !== user.organizationId) {
    notFound();
  }

  // Hanya boleh edit jika DRAFT atau REVISION
  if (booking.status !== "DRAFT" && booking.status !== "REVISION") {
    redirect(`/dashboard/peminjaman/${id}`);
  }

  return (
    <NewBookingForm
      facilities={facilities}
      bookedSlots={bookedSlots}
      standardItems={standardItems}
      facilityItemsMap={facilityItemsMap}
      initialBooking={booking}
      initialItems={items}
      mode="edit"
    />
  );
}

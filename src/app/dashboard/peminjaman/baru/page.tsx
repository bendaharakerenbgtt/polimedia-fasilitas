import { requireUser } from "@/server/auth";
import { query } from "@/server/db";
import { getFacilityBookedSlots, getStandardInventoryItems, getFacilityItemsMap } from "@/server/bookings";
import NewBookingForm from "./NewBookingForm";

export const dynamic = "force-dynamic";

export default async function NewBookingPage() {
  await requireUser(["ORG"]);

  const [facilities, bookedSlots, standardItems, facilityItemsMap] = await Promise.all([
    query<any>(
      `SELECT id, name, category, location, code FROM facilities WHERE active = true ORDER BY name ASC`
    ),
    getFacilityBookedSlots(),
    getStandardInventoryItems(),
    getFacilityItemsMap(),
  ]);

  return (
    <NewBookingForm
      facilities={facilities}
      bookedSlots={bookedSlots}
      standardItems={standardItems}
      facilityItemsMap={facilityItemsMap}
    />
  );
}

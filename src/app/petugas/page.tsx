import { getPublicPetugasBookings, getPublicFacilities } from "@/server/public";
import { PetugasPortalViewer } from "./PetugasPortalViewer";

export const dynamic = "force-dynamic";

export default async function PetugasPage() {
  const [bookings, facilities] = await Promise.all([
    getPublicPetugasBookings(),
    getPublicFacilities(),
  ]);

  return (
    <PetugasPortalViewer
      initialBookings={bookings}
      facilities={facilities.map((f) => ({ id: f.id, name: f.name }))}
    />
  );
}

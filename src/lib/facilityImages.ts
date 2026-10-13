/**
 * Helper untuk memetakan fasilitas kampus PoliMedia ke gambar dummy landscape.
 * Gambar tersedia di /public/images/facilities/*.svg
 */

export interface FacilityImageMeta {
  imageUrl: string;
  alt: string;
  badge: string;
}

export function getFacilityImage(facilityNameOrCategory?: string | null): FacilityImageMeta {
  const text = (facilityNameOrCategory || "").toLowerCase();

  if (text.includes("aula")) {
    return {
      imageUrl: "/images/facilities/aula.svg",
      alt: "Aula Utama PoliMedia",
      badge: "Aula Kampus",
    };
  }

  if (text.includes("masjid") || text.includes("rahman")) {
    return {
      imageUrl: "/images/facilities/masjid.svg",
      alt: "Masjid Ar-Rahman PoliMedia",
      badge: "Tempat Ibadah",
    };
  }

  if (text.includes("pusgiwa-3") || text.includes("pusgiwa lantai 3") || text.includes("pusgiwa lt 3") || text.includes("lantai 3")) {
    return {
      imageUrl: "/images/facilities/pusgiwa-3.svg",
      alt: "Pusgiwa Lantai 3 PoliMedia",
      badge: "Pusgiwa Lt 3",
    };
  }

  if (text.includes("pusgiwa-2") || text.includes("pusgiwa lantai 2") || text.includes("pusgiwa lt 2") || text.includes("pusgiwa")) {
    return {
      imageUrl: "/images/facilities/pusgiwa-2.svg",
      alt: "Pusgiwa Lantai 2 PoliMedia",
      badge: "Pusgiwa Lt 2",
    };
  }

  return {
    imageUrl: "/images/facilities/default.svg",
    alt: "Fasilitas Kampus PoliMedia",
    badge: "Fasilitas Kampus",
  };
}

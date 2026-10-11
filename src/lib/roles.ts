export const ROLES = ["ORG", "ADVISOR", "KAPRODI", "WADIR", "SUBBAG_UMUM", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  ORG: "Ormawa / UKM",
  ADVISOR: "Dosen Pembimbing",
  KAPRODI: "Ketua Program Studi",
  WADIR: "Wakil Direktur Bidang Kemahasiswaan",
  SUBBAG_UMUM: "Sub Bagian Umum",
  ADMIN: "Administrator Sistem",
};

export const ORG_TYPES = ["UKM", "HIMA", "BEM", "MPM", "BO", "BSO", "ODD"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft Formulir",
  PENDING: "Sedang Dicek",
  REVISION: "Perlu Revisi",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
  COMPLETED: "Selesai",
};

export const STEP_STATUS_LABEL: Record<string, string> = {
  WAITING: "Belum giliran",
  PENDING: "Sedang Dicek",
  FORWARDED: "Diteruskan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  SKIPPED: "Dilewati",
};

/** Peran yang boleh melihat seluruh pengajuan (pemantauan lintas organisasi). */
export const OVERSIGHT_ROLES: Role[] = ["WADIR", "SUBBAG_UMUM", "ADMIN"];

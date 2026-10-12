-- 004_update_hima_flow.sql
-- Menyesuaikan alur persetujuan HIMA: langsung ke MPM setelah Kaprodi (tanpa pengecekan BEM)

DO $$
DECLARE
  hima_flow_id uuid;
  mpm_org_id uuid;
BEGIN
  SELECT id INTO hima_flow_id FROM approval_flows WHERE kind = 'BOOKING' AND org_type = 'HIMA';
  SELECT id INTO mpm_org_id FROM organizations WHERE type = 'MPM' LIMIT 1;
  
  IF hima_flow_id IS NOT NULL AND mpm_org_id IS NOT NULL THEN
    DELETE FROM approval_flow_steps WHERE flow_id = hima_flow_id;
    
    INSERT INTO approval_flow_steps (flow_id, step_order, label, resolver_type, resolver_org_id, resolver_role, is_final)
    VALUES
      (hima_flow_id, 1, 'Kaprodi (atau dosen pembina sesuai ketentuan)', 'PRODI_KAPRODI', NULL, NULL, false),
      (hima_flow_id, 2, 'MPM', 'ORGANIZATION', mpm_org_id, NULL, false),
      (hima_flow_id, 3, 'Wakil Direktur Bidang Kemahasiswaan dan Alumni', 'ROLE', NULL, 'WADIR', false),
      (hima_flow_id, 4, 'Subbagian Umum (Verifikasi & Pengesahan Fasilitas)', 'ROLE', NULL, 'SUBBAG_UMUM', true);
  END IF;
END $$;

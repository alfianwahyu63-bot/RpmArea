-- RPM AREA V25 - Pengukur pemakaian database (perkiraan, bukan billing).
-- Jalankan SELURUH perintah sekali di Supabase -> SQL Editor -> Run.
-- Aman dijalankan ulang. Tidak mengubah tabel penjualan, QTY atau NS.
-- Only authenticated members of configured workspace can execute.
CREATE OR REPLACE FUNCTION public.rpm_database_usage(p_workspace_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_bytes bigint;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.rpm_members
    WHERE workspace_id = p_workspace_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION USING errcode='42501', message='Akses workspace diperlukan';
  END IF;
  -- pg_database_size() measures the live PostgreSQL database footprint.
  -- The official Supabase billing/quotas can differ; check Dashboard Usage.
  v_bytes := pg_catalog.pg_database_size(pg_catalog.current_database());
  RETURN pg_catalog.jsonb_build_object('bytes', v_bytes);
END;
$$;
REVOKE ALL ON FUNCTION public.rpm_database_usage(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpm_database_usage(text) TO authenticated;

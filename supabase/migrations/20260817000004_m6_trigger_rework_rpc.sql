-- Migration: 20260817000004_m6_trigger_rework_rpc.sql
-- Milestone: M6 (Quality Control) — Task M6.2
-- PRD ref: §7 rule #3 (rework HANYA lewat RPC formal "Trigger Rework", role
--          qc/admin — tidak boleh lewat update langsung ke
--          production_batch_steps.status)
-- Tanggal: 2026-08-20
--
-- 1. RPC public.trigger_rework(_qc_inspection_id uuid): satu-satunya jalur sah
--    untuk memindahkan step produksi ke status 'rework'. Hanya role qc/admin.
--    Operasi atomik: qc_inspections (reject -> rework, catat
--    rework_triggered_at) + production_batch_steps (completed -> rework).
-- 2. Trigger production_batch_steps_validate_transition() direvisi: transisi
--    APAPUN -> 'rework' sekarang wajib lewat GUC transaksi-lokal
--    app.allow_rework_transition='true', yang HANYA di-set oleh RPC ini.
--    Update langsung (mis. dari client via PostgREST table API) tidak pernah
--    men-set GUC ini, sehingga otomatis ditolak. Transisi rework -> * (keluar
--    dari rework) TETAP diizinkan tanpa GUC, sesuai M5.

-- ============================================================
-- 1) RPC trigger_rework
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_rework(_qc_inspection_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_step_id uuid;
  v_rows int;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'qc')
    OR public.has_role(auth.uid(), 'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden: role qc atau admin diperlukan' USING ERRCODE = '42501';
  END IF;

  -- GUC transaksi-lokal: satu-satunya cara trigger validasi (qc_inspections
  -- maupun production_batch_steps) mengizinkan transisi ke 'rework'.
  -- is_local=true -> otomatis reset saat transaksi (panggilan RPC ini)
  -- selesai, tidak bocor ke statement lain.
  PERFORM set_config('app.allow_rework_transition', 'true', true);

  -- Atomik: hanya baris qc_inspections berstatus 'reject' yang bisa dipindah.
  -- WHERE status='reject' mencegah race condition (dua panggilan RPC
  -- bersamaan pada baris yang sama tidak akan sama-sama lolos).
  UPDATE public.qc_inspections
  SET status = 'rework', rework_triggered_at = now(), updated_at = now()
  WHERE id = _qc_inspection_id AND status = 'reject'
  RETURNING production_batch_step_id INTO v_step_id;

  IF v_step_id IS NULL THEN
    PERFORM set_config('app.allow_rework_transition', 'false', true);
    RAISE EXCEPTION 'Inspeksi QC tidak ditemukan atau bukan berstatus Ditolak';
  END IF;

  UPDATE public.production_batch_steps
  SET status = 'rework'
  WHERE id = v_step_id AND status = 'completed';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  PERFORM set_config('app.allow_rework_transition', 'false', true);

  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Tahapan produksi tidak dalam status selesai, tidak bisa dirework';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_rework(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.trigger_rework(uuid) TO authenticated;

-- ============================================================
-- 2) Trigger gate: transisi ke 'rework' wajib lewat RPC (GUC)
-- ============================================================

CREATE OR REPLACE FUNCTION public.production_batch_steps_validate_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_prev record;
  v_eng_status public.engineering_status;
  v_mat_status public.material_status;
  v_prev_label text;
  v_allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- Transisi yang diizinkan
  IF OLD.status = 'waiting' AND NEW.status = 'running' THEN v_allowed := true;
  ELSIF OLD.status = 'waiting' AND NEW.status = 'skipped' THEN v_allowed := true;
  ELSIF OLD.status = 'running' AND NEW.status = 'paused' THEN v_allowed := true;
  ELSIF OLD.status = 'running' AND NEW.status = 'completed' THEN v_allowed := true;
  ELSIF OLD.status = 'running' AND NEW.status = 'rework' THEN v_allowed := true;
  ELSIF OLD.status = 'paused' AND NEW.status = 'running' THEN v_allowed := true;
  ELSIF OLD.status = 'paused' AND NEW.status = 'completed' THEN v_allowed := true;
  ELSIF OLD.status = 'paused' AND NEW.status = 'rework' THEN v_allowed := true;
  ELSIF OLD.status = 'completed' AND NEW.status = 'rework' THEN v_allowed := true;
  ELSIF OLD.status = 'rework' AND NEW.status = 'running' THEN v_allowed := true;
  ELSIF OLD.status = 'rework' AND NEW.status = 'completed' THEN v_allowed := true;
  ELSIF OLD.status = 'rework' AND NEW.status = 'paused' THEN v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transisi status tahapan tidak diperbolehkan: % → %', OLD.status, NEW.status;
  END IF;

  -- PRD §7 rule #3: rework HANYA lewat RPC formal "Trigger Rework" (role
  -- qc/admin). RPC public.trigger_rework men-set GUC transaksi-lokal ini
  -- sebelum UPDATE ke 'rework'; update langsung (table API/SQL manual) tidak
  -- pernah men-set GUC ini sehingga ditolak di sini.
  IF NEW.status = 'rework' AND coalesce(current_setting('app.allow_rework_transition', true), 'false') <> 'true' THEN
    RAISE EXCEPTION 'Rework harus lewat RPC Trigger Rework QC (role qc/admin), tidak bisa update langsung';
  END IF;

  -- Skip hanya bila belum pernah dimulai
  IF NEW.status = 'skipped' AND OLD.started_at IS NOT NULL THEN
    RAISE EXCEPTION 'Tahapan yang sudah dimulai tidak bisa dilewati';
  END IF;

  -- Cek prasyarat saat mulai berjalan (dari waiting maupun lanjut dari rework)
  IF NEW.status = 'running' AND OLD.status IN ('waiting', 'rework') THEN
    SELECT * INTO v_prev
      FROM public.production_batch_steps
      WHERE production_batch_id = NEW.production_batch_id
        AND sequence_order < NEW.sequence_order
        AND status <> 'skipped'
      ORDER BY sequence_order DESC
      LIMIT 1;

    IF NOT FOUND THEN
      -- Ini tahapan aktif pertama
      SELECT ej.status, ms.status
        INTO v_eng_status, v_mat_status
      FROM public.production_batches pb
      JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
      LEFT JOIN public.material_statuses ms ON ms.engineering_job_id = ej.id
      WHERE pb.id = NEW.production_batch_id;

      IF v_eng_status IS DISTINCT FROM 'approved'::public.engineering_status THEN
        RAISE EXCEPTION 'Tidak bisa mulai: menunggu approval engineering';
      END IF;
      IF v_mat_status IS DISTINCT FROM 'material_ready'::public.material_status THEN
        RAISE EXCEPTION 'Tidak bisa mulai: menunggu material ready';
      END IF;
    ELSE
      v_prev_label := CASE v_prev.process
        WHEN 'laser_cutting' THEN 'Laser Cutting'
        WHEN 'bending' THEN 'Bending'
        WHEN 'welding_grinding' THEN 'Welding & Grinding'
        WHEN 'powder_coating' THEN 'Powder Coating'
        WHEN 'assembly' THEN 'Assembly'
      END;

      IF v_prev.status <> 'completed' THEN
        IF v_prev.status = 'rework' THEN
          RAISE EXCEPTION 'Tidak bisa mulai: tahapan sebelumnya (%) masih dalam rework', v_prev_label;
        ELSE
          RAISE EXCEPTION 'Tidak bisa mulai: menunggu % selesai', v_prev_label;
        END IF;
      END IF;

      -- PRD §7 rule #2: tahapan sebelumnya harus completed DAN sudah QC pass
      -- sebelum tahapan berikutnya boleh mulai berjalan.
      IF NOT EXISTS (
        SELECT 1 FROM public.qc_inspections qi
        WHERE qi.production_batch_step_id = v_prev.id AND qi.status = 'pass'
      ) THEN
        RAISE EXCEPTION 'Tidak bisa mulai: menunggu QC pass tahapan sebelumnya (%)', v_prev_label;
      END IF;
    END IF;
  END IF;

  -- Timestamp otomatis
  IF NEW.status = 'running' AND OLD.status = 'waiting' AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;
  IF NEW.status = 'paused' AND NEW.paused_at IS NULL THEN
    NEW.paused_at := now();
  END IF;
  IF NEW.status = 'running' AND OLD.status IN ('paused', 'rework') THEN
    NEW.paused_at := NULL;
  END IF;
  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  IF OLD.status = 'completed' AND NEW.status = 'rework' THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END; $$;

-- ============================================================
-- 3) Harden qc_inspections_validate_transition(): reject -> rework juga wajib
--    lewat GUC transaksi-lokal yang sama, supaya UPDATE langsung ke
--    qc_inspections tidak bisa memindahkan baris ke 'rework' tanpa lewat RPC
--    trigger_rework (RPC men-set GUC ini sebelum meng-update qc_inspections).
-- ============================================================

CREATE OR REPLACE FUNCTION public.qc_inspections_validate_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF OLD.status = 'pass' THEN
    RAISE EXCEPTION 'Inspeksi sudah Lulus dan tidak bisa diubah';
  END IF;

  IF OLD.status = 'waiting' AND NEW.status = 'inspection' THEN v_allowed := true;
  ELSIF OLD.status = 'inspection' AND NEW.status IN ('pass','reject') THEN v_allowed := true;
  ELSIF OLD.status = 'reject' AND NEW.status = 'rework' THEN v_allowed := true;
  ELSIF OLD.status = 'rework' AND NEW.status = 'inspection' THEN v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transisi status QC tidak diperbolehkan: % → %', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'rework' AND coalesce(current_setting('app.allow_rework_transition', true), 'false') <> 'true' THEN
    RAISE EXCEPTION 'Rework harus lewat RPC Trigger Rework QC (role qc/admin), tidak bisa update langsung';
  END IF;

  IF NEW.status = 'inspection' AND NEW.inspector_id IS NULL THEN
    NEW.inspector_id := auth.uid();
  END IF;
  IF NEW.status IN ('pass','reject') AND NEW.inspected_at IS NULL THEN
    NEW.inspected_at := now();
  END IF;

  IF NEW.status IN ('pass','reject') THEN
    IF (NEW.qty_ok + NEW.qty_reject) <= 0 THEN
      RAISE EXCEPTION 'Isi jumlah OK dan/atau jumlah tolak terlebih dahulu';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.qc_inspections_validate_transition() FROM public, anon, authenticated;

-- Migration: 20260816000008_m5_validate_transition_rework.sql
-- Milestone: M5 (Production Execution) — Task M5.2
-- PRD ref: §7 rule #1 (gate tahapan aktif: engineering approved + material_ready
--          untuk tahapan pertama; tahapan sebelumnya harus completed untuk
--          tahapan berikutnya) dan §7 rule #3 (rework hanya lewat RPC formal
--          "Trigger Rework", role qc/admin — pembatasan siapa yang boleh
--          insert/update ditegakkan oleh RLS + RPC di M6; migration ini hanya
--          merevisi validasi transisi status di trigger)
-- Tanggal: 2026-08-16
--
-- Revisi production_batch_steps_validate_transition() (asal:
-- 20260816000006_production_routing_operator_fk.sql) untuk mendukung status
-- 'rework' (ditambahkan ke enum di 20260816000007_m5_add_rework_enum.sql):
--   - completed → rework, paused → rework, running → rework (izin)
--   - rework → running, rework → completed, rework → paused (izin)
--   - rework → waiting, rework → skipped, skipped → apa pun: TETAP DITOLAK
--     (tidak ditambahkan ke daftar transisi diizinkan, sehingga otomatis
--     ditolak oleh exception generik di akhir blok pengecekan)
-- Gate PRD §7 rule #1 dipertahankan dan diperluas: transisi ke 'running' baik
-- dari 'waiting' maupun dari 'rework' sama-sama melewati pengecekan
-- prasyarat (approval engineering + material ready untuk tahapan pertama,
-- atau tahapan sebelumnya completed untuk tahapan berikutnya).
--
-- Catatan untuk M6: v_dashboard_production_running
-- (20260722063745_c2895064-7d75-4906-b763-df1c984889c7.sql:142) hanya
-- menghitung status = 'running', sehingga tahapan berstatus 'rework' tidak
-- akan terhitung di dashboard tsb. Ini TIDAK diubah di migration ini (di luar
-- scope M5) — perlu ditinjau saat M6 apakah dashboard production perlu
-- menampilkan/menghitung status 'rework' secara terpisah.
--
-- Idempotent lewat CREATE OR REPLACE FUNCTION.

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
      IF v_prev.status <> 'completed' THEN
        v_prev_label := CASE v_prev.process
          WHEN 'laser_cutting' THEN 'Laser Cutting'
          WHEN 'bending' THEN 'Bending'
          WHEN 'welding_grinding' THEN 'Welding & Grinding'
          WHEN 'powder_coating' THEN 'Powder Coating'
          WHEN 'assembly' THEN 'Assembly'
        END;
        IF v_prev.status = 'rework' THEN
          RAISE EXCEPTION 'Tidak bisa mulai: tahapan sebelumnya (%) masih dalam rework', v_prev_label;
        ELSE
          RAISE EXCEPTION 'Tidak bisa mulai: menunggu % selesai', v_prev_label;
        END IF;
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

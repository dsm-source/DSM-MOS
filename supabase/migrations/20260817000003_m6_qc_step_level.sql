-- Migration: 20260817000003_m6_qc_step_level.sql
-- Milestone: M6 (Quality Control) — Task M6.1
-- PRD ref: §6.2 qc_inspections (per-tahapan, bukan per-batch, tanpa foto),
--          §7 rule #2 (gate: qc_inspections hanya untuk step completed)
-- Tanggal: 2026-08-20
--
-- Ubah qc_inspections dari model per-batch ke per-step:
--   1. Tambah production_batch_step_id (FK -> production_batch_steps), backfill
--      dari production_batch_id lama (best-effort: step sequence_order terakhir
--      milik batch tsb — model lama memang cuma insert QC setelah SEMUA step
--      selesai), lalu drop production_batch_id.
--   2. Hapus kolom foto (photo_url lama, photo_urls dari migration lanjutan) —
--      fitur upload foto QC dihapus total dari PRD v3.
--   3. Tambah rework_triggered_at (dipakai RPC trigger_rework di M6.2).
--   4. Rewrite production_batch_steps_auto_enqueue_qc(): dari "tunggu SEMUA
--      step batch completed" jadi "step INI completed -> auto-insert satu
--      qc_inspections utk step ini".
--   5. Rewrite qc_inspections_validate_insert(): dari cek semua-step-batch jadi
--      cek step-ini-completed.
--   6. Rewrite delivery_items_validate(): tambah satu hop join lewat
--      production_batch_steps.
--   7. Rewrite qc_inspections_notify(): derive batch/SO lewat step relation.
--   8. Drop RLS policy storage bucket qc-photos (fitur foto dihapus).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, DROP COLUMN IF EXISTS, guard blocks
-- pakai information_schema/pg_constraint check, CREATE OR REPLACE FUNCTION,
-- DROP POLICY IF EXISTS. Aman di-replay di local stack maupun dijalankan di
-- atas skema yang sudah pernah ditransformasi.

-- ============================================================
-- 1) production_batch_step_id: tambah, backfill, wajib, FK
-- ============================================================

ALTER TABLE public.qc_inspections
  ADD COLUMN IF NOT EXISTS production_batch_step_id uuid;

-- Backfill best-effort dari model lama (production_batch_id): pilih step
-- dengan sequence_order terbesar milik batch tsb, karena model lama cuma
-- insert QC setelah SEMUA step batch completed (jadi step terakhir yang
-- paling representatif untuk baris QC lama).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'qc_inspections'
      AND column_name = 'production_batch_id'
  ) THEN
    UPDATE public.qc_inspections q
    SET production_batch_step_id = (
      SELECT s.id FROM public.production_batch_steps s
      WHERE s.production_batch_id = q.production_batch_id
      ORDER BY s.sequence_order DESC
      LIMIT 1
    )
    WHERE q.production_batch_step_id IS NULL;
  END IF;
END $$;

-- Set NOT NULL hanya kalau backfill berhasil menutup semua baris (aman untuk
-- fresh DB tanpa data lama sekalipun, karena tidak ada baris NULL sama sekali).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.qc_inspections WHERE production_batch_step_id IS NULL) THEN
    ALTER TABLE public.qc_inspections ALTER COLUMN production_batch_step_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'qc_inspections'
      AND constraint_name = 'qc_inspections_production_batch_step_id_fkey'
  ) THEN
    ALTER TABLE public.qc_inspections
      ADD CONSTRAINT qc_inspections_production_batch_step_id_fkey
      FOREIGN KEY (production_batch_step_id)
      REFERENCES public.production_batch_steps(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Guard: kalau masih ada baris yang gagal backfill (production_batch_step_id
-- NULL) di tabel yang sudah berisi data, JANGAN drop production_batch_id
-- diam-diam (akan menghilangkan satu-satunya jalur untuk backfill manual).
DO $$
DECLARE
  v_null_count int;
BEGIN
  SELECT count(*) INTO v_null_count FROM public.qc_inspections WHERE production_batch_step_id IS NULL;
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'qc_inspections: % baris gagal backfill production_batch_step_id, batalkan drop production_batch_id', v_null_count;
  END IF;
END $$;

-- Kolom lama: drop (index idx_qc_inspections_batch ikut ter-drop otomatis).
ALTER TABLE public.qc_inspections DROP COLUMN IF EXISTS production_batch_id;

CREATE INDEX IF NOT EXISTS idx_qc_inspections_step ON public.qc_inspections(production_batch_step_id);

-- PRD §6.2: satu baris qc_inspections "aktif" per step per cycle. 'rework'
-- SENGAJA tidak termasuk (lihat komentar production_batch_steps_auto_enqueue_qc
-- di bawah) — begitu baris pindah ke rework, cycle-nya selesai/riwayat dan
-- step yang sama boleh dapat baris qc_inspections baru setelah completed lagi.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qc_inspections_active_step
  ON public.qc_inspections(production_batch_step_id)
  WHERE status IN ('waiting','inspection','reject');

-- ============================================================
-- 2) Hapus kolom foto (photo_url lama, photo_urls dari migration lanjutan)
-- ============================================================

ALTER TABLE public.qc_inspections DROP COLUMN IF EXISTS photo_url;
ALTER TABLE public.qc_inspections DROP COLUMN IF EXISTS photo_urls;

-- ============================================================
-- 3) rework_triggered_at (dipakai RPC trigger_rework, M6.2)
-- ============================================================

ALTER TABLE public.qc_inspections
  ADD COLUMN IF NOT EXISTS rework_triggered_at timestamptz;

-- qty_total sudah ada (migration 20260722065342) NOT NULL DEFAULT 0 dengan
-- check qty_ok+qty_reject<=qty_total — tidak perlu diubah, tinggal dipastikan
-- idempotent kalau migration ini dijalankan di atas skema yang belum pernah
-- kena migration tsb (defensif untuk urutan ulang):
ALTER TABLE public.qc_inspections
  ADD COLUMN IF NOT EXISTS qty_total numeric(18,4) NOT NULL DEFAULT 0;

ALTER TABLE public.qc_inspections DROP CONSTRAINT IF EXISTS qc_inspections_qty_check;
ALTER TABLE public.qc_inspections
  ADD CONSTRAINT qc_inspections_qty_check
  CHECK (qty_ok >= 0 AND qty_reject >= 0 AND qty_total >= 0 AND (qty_ok + qty_reject) <= qty_total);

-- ============================================================
-- 4) Rewrite auto-enqueue: per-step (bukan tunggu semua step batch)
-- ============================================================
-- Status "aktif" yang memblokir insert baris baru dibatasi ke
-- waiting/inspection/reject — SENGAJA TIDAK termasuk 'rework': begitu RPC
-- trigger_rework (M6.2) memindahkan baris reject -> rework, siklus baris itu
-- sudah selesai/resolved (riwayat), dan step yang sama akan completed lagi
-- setelah rework selesai — saat itu baris qc_inspections BARU harus bisa
-- masuk lagi (satu baris per cycle, PRD §6.2). Kalau 'rework' ikut dihitung
-- aktif, baris lama yang permanen berstatus 'rework' akan memblokir cycle
-- berikutnya selamanya.
CREATE OR REPLACE FUNCTION public.production_batch_steps_auto_enqueue_qc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_active int;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_existing_active
    FROM public.qc_inspections
   WHERE production_batch_step_id = NEW.id
     AND status IN ('waiting','inspection','reject');
  IF v_existing_active > 0 THEN RETURN NEW; END IF;

  INSERT INTO public.qc_inspections (production_batch_step_id, status)
  VALUES (NEW.id, 'waiting');

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.production_batch_steps_auto_enqueue_qc() FROM public, anon, authenticated;

-- ============================================================
-- 5) Rewrite BEFORE INSERT validation: step-ini-completed (bukan semua step)
-- ============================================================

CREATE OR REPLACE FUNCTION public.qc_inspections_validate_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_step_status public.production_step_status;
  v_batch_qty numeric;
BEGIN
  SELECT s.status, pb.quantity
    INTO v_step_status, v_batch_qty
  FROM public.production_batch_steps s
  JOIN public.production_batches pb ON pb.id = s.production_batch_id
  WHERE s.id = NEW.production_batch_step_id;

  IF v_step_status IS NULL THEN
    RAISE EXCEPTION 'Tahapan produksi tidak ditemukan';
  END IF;

  IF v_step_status <> 'completed' THEN
    RAISE EXCEPTION 'Tahapan belum selesai, tidak bisa diinspeksi QC';
  END IF;

  IF NEW.qty_total IS NULL OR NEW.qty_total = 0 THEN
    NEW.qty_total := COALESCE(v_batch_qty, 0);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.qc_inspections_validate_insert() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 6) Rewrite delivery_items_validate(): tambah hop lewat production_batch_steps
-- ============================================================

CREATE OR REPLACE FUNCTION public.delivery_items_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_qc_status public.qc_status;
  v_qc_so uuid;
  v_del_so uuid;
  v_del_status public.delivery_status;
  v_batch_id uuid;
  v_step_seq int;
  v_max_seq int;
BEGIN
  SELECT status INTO v_del_status FROM public.deliveries WHERE id = NEW.delivery_id;
  IF v_del_status IN ('shipped','delivered') THEN
    RAISE EXCEPTION 'Tidak bisa mengubah item pada pengiriman yang sudah dikirim.';
  END IF;

  SELECT qi.status,
         so.id,
         pb.id,
         pbs.sequence_order
    INTO v_qc_status, v_qc_so, v_batch_id, v_step_seq
  FROM public.qc_inspections qi
  JOIN public.production_batch_steps pbs ON pbs.id = qi.production_batch_step_id
  JOIN public.production_batches pb ON pb.id = pbs.production_batch_id
  JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
  JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
  JOIN public.sales_orders so ON so.id = soi.sales_order_id
  WHERE qi.id = NEW.qc_inspection_id;

  IF v_qc_status IS NULL THEN
    RAISE EXCEPTION 'Inspeksi QC tidak ditemukan.';
  END IF;

  IF v_qc_status <> 'pass' THEN
    RAISE EXCEPTION 'Hanya item yang sudah Lulus QC yang bisa masuk pengiriman.';
  END IF;

  -- PRD §7 rule #4: hanya QC pass pada tahapan TERAKHIR batch yang boleh
  -- masuk pengiriman (bukan QC pass di tahapan antara).
  SELECT max(sequence_order) INTO v_max_seq
  FROM public.production_batch_steps
  WHERE production_batch_id = v_batch_id AND status <> 'skipped';

  IF v_step_seq IS DISTINCT FROM v_max_seq THEN
    RAISE EXCEPTION 'Hanya QC pass pada tahapan terakhir batch yang bisa masuk pengiriman.';
  END IF;

  SELECT sales_order_id INTO v_del_so FROM public.deliveries WHERE id = NEW.delivery_id;
  IF v_qc_so <> v_del_so THEN
    RAISE EXCEPTION 'Item ini bukan milik Sales Order pengiriman terkait.';
  END IF;

  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.delivery_items_validate() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 7) Rewrite notifikasi: derive batch/SO lewat step relation
-- ============================================================

CREATE OR REPLACE FUNCTION public.qc_inspections_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_batch_id uuid;
  v_batch_number text;
  v_so_id uuid;
  v_so_number text;
  v_title text;
  v_body text;
  v_status_label text;
BEGIN
  SELECT pb.id, pb.batch_number, so.id, so.so_number
    INTO v_batch_id, v_batch_number, v_so_id, v_so_number
  FROM public.production_batch_steps pbs
  JOIN public.production_batches pb ON pb.id = pbs.production_batch_id
  JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
  JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
  JOIN public.sales_orders so ON so.id = soi.sales_order_id
  WHERE pbs.id = NEW.production_batch_step_id;

  v_status_label := CASE NEW.status
    WHEN 'waiting' THEN 'Menunggu Inspeksi'
    WHEN 'inspection' THEN 'Sedang Diinspeksi'
    WHEN 'pass' THEN 'Lulus QC'
    WHEN 'reject' THEN 'Ditolak QC'
    WHEN 'rework' THEN 'Perlu Rework'
  END;

  IF TG_OP = 'INSERT' THEN
    v_title := 'QC: batch ' || COALESCE(v_batch_number,'?') || ' masuk antrian';
    v_body  := 'SO ' || COALESCE(v_so_number,'?') || ' siap diinspeksi.';
  ELSE
    IF NEW.status = OLD.status THEN RETURN NEW; END IF;
    v_title := 'QC ' || COALESCE(v_batch_number,'?') || ' → ' || v_status_label;
    v_body  := 'SO ' || COALESCE(v_so_number,'?') || ' status QC diperbarui.';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, metadata)
  SELECT DISTINCT ur.user_id,
                  'so_status_changed'::public.notification_type,
                  v_title,
                  v_body,
                  '/qc',
                  jsonb_build_object(
                    'qc_inspection_id', NEW.id,
                    'production_batch_step_id', NEW.production_batch_step_id,
                    'production_batch_id', v_batch_id,
                    'batch_number', v_batch_number,
                    'sales_order_id', v_so_id,
                    'so_number', v_so_number,
                    'status', NEW.status
                  )
  FROM public.user_roles ur
  WHERE ur.role IN ('qc'::public.app_role,'admin'::public.app_role)
    AND (v_actor IS NULL OR ur.user_id <> v_actor);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.qc_inspections_notify() FROM public, anon, authenticated;

-- ============================================================
-- 8) Drop RLS policy storage bucket qc-photos (fitur foto dihapus total)
-- ============================================================

DROP POLICY IF EXISTS qc_photos_read_authenticated ON storage.objects;
DROP POLICY IF EXISTS qc_photos_write_qc_admin ON storage.objects;
DROP POLICY IF EXISTS qc_photos_update_qc_admin ON storage.objects;
DROP POLICY IF EXISTS qc_photos_delete_admin ON storage.objects;
DROP POLICY IF EXISTS qc_photos_read_scoped ON storage.objects;

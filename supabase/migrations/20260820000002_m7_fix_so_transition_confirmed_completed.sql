-- M7 fix: sales_orders_validate_transition() rejects confirmed -> completed.
-- Root cause: deliveries_after_delivered() auto-completes the sales order once
-- delivered quantity covers the order (confirmed -> completed in practice, since
-- SO status stays 'confirmed' through the whole production/QC/delivery flow —
-- those intermediate SO statuses are not driven by this flow). The transition
-- map only allowed delivery -> completed, so the trigger's UPDATE failed with
-- "Transisi status tidak diperbolehkan: confirmed -> completed".
--
-- Codex re-review: allowing confirmed -> completed unconditionally opens a
-- direct-update bypass (any caller can mark an SO completed without actually
-- delivering it). Guard the transition with the same delivered-quantity check
-- deliveries_after_delivered() already relies on before firing its UPDATE, so
-- the auto-complete path still succeeds while a manual/direct update without
-- sufficient delivered quantity is rejected.

CREATE OR REPLACE FUNCTION public.sales_orders_validate_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_item_count int;
  v_allowed boolean := false;
  v_needed numeric;
  v_shipped numeric;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Terminal states tidak bisa berubah
  IF OLD.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'Status % adalah status akhir dan tidak dapat diubah', OLD.status;
  END IF;

  -- Semua status non-terminal boleh dibatalkan
  IF NEW.status = 'cancelled' THEN
    v_allowed := true;
  ELSIF OLD.status = 'draft' AND NEW.status = 'confirmed' THEN
    v_allowed := true;
  ELSIF OLD.status = 'confirmed' AND NEW.status = 'engineering' THEN
    v_allowed := true;
  ELSIF OLD.status = 'confirmed' AND NEW.status = 'completed' THEN
    v_allowed := true;
  ELSIF OLD.status = 'engineering' AND NEW.status = 'production' THEN
    v_allowed := true;
  ELSIF OLD.status = 'production' AND NEW.status = 'quality_control' THEN
    v_allowed := true;
  ELSIF OLD.status = 'quality_control' AND NEW.status = 'delivery' THEN
    v_allowed := true;
  ELSIF OLD.status = 'delivery' AND NEW.status = 'completed' THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transisi status tidak diperbolehkan: % → %', OLD.status, NEW.status;
  END IF;

  -- confirmed -> completed hanya boleh terjadi jika delivered quantity sudah
  -- menutupi seluruh quantity sales_order_items (mencegah bypass direct update
  -- ke completed tanpa bukti pengiriman selesai).
  IF OLD.status = 'confirmed' AND NEW.status = 'completed' THEN
    SELECT COALESCE(sum(quantity), 0) INTO v_needed
    FROM public.sales_order_items WHERE sales_order_id = NEW.id;

    SELECT COALESCE(sum(di.quantity), 0) INTO v_shipped
    FROM public.delivery_items di
    JOIN public.deliveries d ON d.id = di.delivery_id
    WHERE d.sales_order_id = NEW.id AND d.status = 'delivered';

    IF v_needed = 0 OR v_shipped < v_needed THEN
      RAISE EXCEPTION 'Sales Order belum bisa completed: delivered quantity belum menutupi quantity order';
    END IF;
  END IF;

  -- Konfirmasi wajib punya item
  IF NEW.status = 'confirmed' THEN
    SELECT count(*) INTO v_item_count
      FROM public.sales_order_items WHERE sales_order_id = NEW.id;
    IF v_item_count = 0 THEN
      RAISE EXCEPTION 'Sales Order tidak bisa dikonfirmasi tanpa item';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

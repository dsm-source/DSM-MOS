-- M8: allow role `delivery` to SELECT engineering_jobs.
--
-- The delivery detail page resolves eligible QC-pass items by joining
-- qc_inspections -> production_batch_steps -> production_batches ->
-- engineering_jobs -> sales_order_items (all inner joins). The delivery role
-- already has SELECT on every table in that chain except engineering_jobs, so
-- the eligibility query returned 0 rows and draft deliveries could never gain
-- an item. Add `delivery` to the scoped SELECT policy to close that gap.

DROP POLICY IF EXISTS eng_jobs_select_scoped ON public.engineering_jobs;
CREATE POLICY eng_jobs_select_scoped ON public.engineering_jobs
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','engineering','sales','production_planning','material','production','qc','delivery','viewer']::public.app_role[]));

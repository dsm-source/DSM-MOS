import { sql } from "./db";

export type QcPassSalesOrder = {
  soNumber: string;
  soId: string;
  qcInspectionId: string;
  qtyOk: number;
};

/**
 * Take one demo SO from the `qc_active` bucket and push it to a state the
 * delivery flow needs: final QC step passed, SO status `quality_control`,
 * no delivery yet. Idempotent — safe to re-run without a DB reset.
 *
 * Uses `docker exec psql`; the transition triggers run under seeded actor uids
 * (qc for the inspection, admin for the SO status walk).
 */
export function prepareQcPassSalesOrder(
  soNumber = "SO-2026-000111",
): QcPassSalesOrder {
  sql(`
    do $$
    declare v_so uuid; v_step uuid; v_qi uuid; v_qty numeric; v_status text;
    begin
      select id, status::text into v_so, v_status
        from public.sales_orders where so_number = '${soNumber}';

      select s.id, pb.quantity into v_step, v_qty
      from public.production_batch_steps s
      join public.production_batches pb on pb.id = s.production_batch_id
      join public.engineering_jobs ej on ej.id = pb.engineering_job_id
      join public.sales_order_items soi on soi.id = ej.sales_order_item_id
      where soi.sales_order_id = v_so and s.status <> 'skipped'
      order by s.sequence_order desc limit 1;

      select id into v_qi from public.qc_inspections
        where production_batch_step_id = v_step;

      perform set_config('request.jwt.claim.sub',
        '40000000-0000-0000-0000-000000000007', true);
      update public.qc_inspections set status = 'inspection'
        where id = v_qi and status = 'waiting';
      update public.qc_inspections
        set status = 'pass', qty_total = v_qty, qty_ok = v_qty, qty_reject = 0
        where id = v_qi and status = 'inspection';

      perform set_config('request.jwt.claim.sub',
        '40000000-0000-0000-0000-000000000002', true);
      if v_status = 'confirmed' then
        update public.sales_orders set status = 'engineering' where id = v_so;
        update public.sales_orders set status = 'production' where id = v_so;
        update public.sales_orders set status = 'quality_control' where id = v_so;
      end if;
      perform set_config('request.jwt.claim.sub', '', true);
    end $$;
  `);

  const row = sql(`
    select so.id, qi.id, qi.qty_ok
    from public.sales_orders so
    join public.sales_order_items soi on soi.sales_order_id = so.id
    join public.engineering_jobs ej on ej.sales_order_item_id = soi.id
    join public.production_batches pb on pb.engineering_job_id = ej.id
    join public.production_batch_steps s on s.production_batch_id = pb.id
    join public.qc_inspections qi on qi.production_batch_step_id = s.id
    where so.so_number = '${soNumber}' and qi.status = 'pass'
    order by s.sequence_order desc limit 1;
  `).split("\t");

  return {
    soNumber,
    soId: row[0],
    qcInspectionId: row[1],
    qtyOk: Number(row[2]),
  };
}

export type RunningBatch = {
  soNumber: string;
  batchNumber: string;
  runningProcess: string;
  nextProcess: string;
};

/**
 * Push one demo `production_active` batch to a state the Kanban drag needs:
 * step 1 completed + QC-passed, step 2 `running` and unblocked (so its card
 * renders a drag handle). Idempotent.
 */
export function prepareRunningProductionStep(
  soNumber = "SO-2026-000061",
): RunningBatch {
  sql(`
    do $$
    declare v_s1 uuid; v_s2 uuid; v_qi uuid; v_qty numeric;
    begin
      select s1.id, s2.id, pb.quantity into v_s1, v_s2, v_qty
      from public.sales_orders so
      join public.sales_order_items soi on soi.sales_order_id = so.id
      join public.engineering_jobs ej on ej.sales_order_item_id = soi.id
      join public.production_batches pb on pb.engineering_job_id = ej.id
      join public.production_batch_steps s1
        on s1.production_batch_id = pb.id and s1.sequence_order = 1
      join public.production_batch_steps s2
        on s2.production_batch_id = pb.id and s2.sequence_order = 2
      where so.so_number = '${soNumber}';

      select id into v_qi from public.qc_inspections
        where production_batch_step_id = v_s1;

      perform set_config('request.jwt.claim.sub',
        '40000000-0000-0000-0000-000000000007', true);
      update public.qc_inspections set status = 'inspection'
        where id = v_qi and status = 'waiting';
      update public.qc_inspections
        set status = 'pass', qty_total = v_qty, qty_ok = v_qty, qty_reject = 0
        where id = v_qi and status = 'inspection';

      perform set_config('request.jwt.claim.sub',
        '40000000-0000-0000-0000-000000000006', true);
      update public.production_batch_steps
        set status = 'running',
            operator_id = '40000000-0000-0000-0000-000000000101'
        where id = v_s2 and status <> 'running';
      perform set_config('request.jwt.claim.sub', '', true);
    end $$;
  `);

  const row = sql(`
    select pb.batch_number, s2.process, s3.process
    from public.sales_orders so
    join public.sales_order_items soi on soi.sales_order_id = so.id
    join public.engineering_jobs ej on ej.sales_order_item_id = soi.id
    join public.production_batches pb on pb.engineering_job_id = ej.id
    join public.production_batch_steps s2
      on s2.production_batch_id = pb.id and s2.sequence_order = 2
    join public.production_batch_steps s3
      on s3.production_batch_id = pb.id and s3.sequence_order = 3
    where so.so_number = '${soNumber}';
  `).split("\t");

  return {
    soNumber,
    batchNumber: row[0],
    runningProcess: row[1],
    nextProcess: row[2],
  };
}

/** Remove any deliveries (and their items) for an SO — teardown for the spec. */
export function deleteDeliveriesForSo(soId: string): void {
  sql(`
    delete from public.delivery_items di using public.deliveries d
      where di.delivery_id = d.id and d.sales_order_id = '${soId}';
    delete from public.deliveries where sales_order_id = '${soId}';
  `);
}

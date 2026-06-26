-- ============================================================
--  QC / QUARANTINE WORKFLOW for received raw materials.
--  Received stock starts in 'pending' (quarantine); only
--  'approved' batches may be issued to production. 'rejected'
--  batches are held out of stock.
--  Run this whole file in the Supabase SQL editor. Safe to re-run.
-- ============================================================

alter table grn_line_items add column if not exists qc_status text not null default 'pending';
alter table grn_line_items add column if not exists coa_url   text;          -- Certificate of Analysis (file URL)
alter table grn_line_items add column if not exists qc_by     text;          -- approver email
alter table grn_line_items add column if not exists qc_at     timestamptz;   -- decision time
alter table grn_line_items add column if not exists qc_notes  text;          -- approve/reject remarks

-- Restrict to known states.
alter table grn_line_items drop constraint if exists grn_line_items_qc_status_chk;
alter table grn_line_items add constraint grn_line_items_qc_status_chk
  check (qc_status in ('pending', 'approved', 'rejected'));

-- OPTIONAL — treat all stock received BEFORE QC existed as already approved,
-- so your current on-hand inventory doesn't suddenly move into quarantine.
-- Run this ONCE, right after the migration, if you want that behaviour:
--
--   update grn_line_items set qc_status = 'approved' where qc_status = 'pending';

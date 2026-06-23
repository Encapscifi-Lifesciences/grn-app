-- ============================================================
--  IMPROVEMENTS MIGRATION
--  Run this whole file in the Supabase SQL editor.
-- ============================================================

-- ===== 1. GRN void + audit log =====
alter table grns add column if not exists voided      boolean default false;
alter table grns add column if not exists void_reason text;

create table if not exists grn_audit_log (
  id          uuid primary key default gen_random_uuid(),
  grn_id      uuid references grns(id) on delete cascade,
  action      text not null,                 -- 'status_change' | 'void' | 'unvoid'
  detail      text,                          -- e.g. 'pending_review -> reconciled'
  actor_email text,
  created_at  timestamptz default now()
);
create index if not exists grn_audit_log_grn_id_idx on grn_audit_log(grn_id);

-- RLS: any authenticated user may read/write the audit log (app enforces roles)
alter table grn_audit_log enable row level security;
drop policy if exists "authenticated_all" on grn_audit_log;
create policy "authenticated_all" on grn_audit_log
  for all to authenticated using (true) with check (true);

-- Done.

-- ============================================================
-- INVENTORY OBJECTS — required by /warehouse/inventory and the
-- Admin Inventory Valuation. These were in the app code but were
-- never created on the live database. Run in Supabase SQL Editor.
-- Safe to run multiple times.
-- ============================================================

-- 1) Reorder / minimum level per item
alter table items add column if not exists min_level numeric(14,3) not null default 0;

-- 2) Stock issues (consumption out of a received batch)
create table if not exists stock_issues (
  id                uuid primary key default gen_random_uuid(),
  grn_line_item_id  uuid references grn_line_items(id) on delete cascade,
  item_id           uuid references items(id),
  qty               numeric(14,3) not null,
  note              text,
  created_at        timestamptz default now()
);

-- 3) Lock it down the same way as every other table:
--    authenticated users full access, anon nothing.
alter table stock_issues enable row level security;
drop policy if exists "authenticated_all" on stock_issues;
create policy "authenticated_all" on stock_issues for all to authenticated using (true) with check (true);
revoke all on table stock_issues from anon;

-- ============================================================
-- SECURITY HARDENING — Row Level Security
-- Locks every table so ONLY logged-in (authenticated) users can
-- read/write. The public anon key (shipped to browsers, and now
-- visible in the public repo) can do NOTHING on its own.
-- Role separation (purchase/warehouse/finance/admin) is enforced
-- in the app layer; admin user-management writes use the service
-- role on the server (which bypasses RLS).
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- Safe to run multiple times (idempotent).
-- ============================================================

-- 1) Enable RLS on every table
alter table vendors          enable row level security;
alter table uoms             enable row level security;
alter table items            enable row level security;
alter table purchase_orders  enable row level security;
alter table po_line_items    enable row level security;
alter table grns             enable row level security;
alter table grn_line_items   enable row level security;
alter table grn_sequences    enable row level security;
alter table grn_audit_log    enable row level security;
alter table profiles         enable row level security;

-- 2) Drop ALL existing policies on these tables (clears any
--    permissive / anon / public policies that may exist)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('vendors','uoms','items','purchase_orders','po_line_items',
                        'grns','grn_line_items','grn_sequences','grn_audit_log','profiles')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 3) Business tables: authenticated = full access; anon = denied (no policy)
do $$
declare t text;
begin
  foreach t in array array[
    'vendors','uoms','items','purchase_orders','po_line_items',
    'grns','grn_line_items','grn_sequences','grn_audit_log'
  ]
  loop
    execute format(
      'create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- 4) Profiles: authenticated may READ (needed for role checks / Finance views).
--    No client-side writes — roles are managed via the server (service role).
create policy "profiles_read" on profiles for select to authenticated using (true);

-- 5) Belt-and-suspenders: remove any base privileges granted directly to anon.
do $$
declare t text;
begin
  foreach t in array array[
    'vendors','uoms','items','purchase_orders','po_line_items',
    'grns','grn_line_items','grn_sequences','grn_audit_log','profiles'
  ]
  loop
    execute format('revoke all on table %I from anon', t);
  end loop;
end $$;

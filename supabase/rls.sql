-- Row Level Security: lock the tables so only logged-in users can read/write,
-- and the public anon key cannot touch business data.

alter table vendors          enable row level security;
alter table uoms             enable row level security;
alter table items            enable row level security;
alter table purchase_orders  enable row level security;
alter table po_line_items    enable row level security;
alter table grns             enable row level security;
alter table grn_line_items   enable row level security;
alter table grn_sequences    enable row level security;
alter table profiles         enable row level security;

-- Business tables: any authenticated user may read & write.
-- (Role separation is enforced in the app layer.)
do $$
declare t text;
begin
  foreach t in array array[
    'vendors','uoms','items','purchase_orders','po_line_items',
    'grns','grn_line_items','grn_sequences'
  ]
  loop
    execute format('drop policy if exists "authenticated_all" on %I', t);
    execute format(
      'create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- Profiles: authenticated users may read (needed for role checks and Finance
-- views). No client-side writes — roles are managed via the SQL editor.
drop policy if exists "profiles_read" on profiles;
create policy "profiles_read" on profiles for select to authenticated using (true);

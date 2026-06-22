-- ===== GRN line item: expiry tracking =====
alter table grn_line_items add column if not exists expired boolean default false;
alter table grn_line_items add column if not exists expiry_proof_url text;

-- ===== Storage bucket for photos (challan / damage / expiry proof) =====
insert into storage.buckets (id, name, public)
values ('grn-attachments', 'grn-attachments', true)
on conflict (id) do update set public = true;

-- Allow upload + read of files in that bucket
drop policy if exists "grn_obj_all" on storage.objects;
create policy "grn_obj_all" on storage.objects
  for all
  using (bucket_id = 'grn-attachments')
  with check (bucket_id = 'grn-attachments');

-- ===== Let the app call the GRN reference generator =====
grant execute on function next_grn_ref(text) to anon, authenticated;

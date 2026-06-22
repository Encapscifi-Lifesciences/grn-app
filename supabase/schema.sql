-- ============ MASTER DATA ============
create table vendors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz default now()
);

create table uoms (
  id    uuid primary key default gen_random_uuid(),
  code  text not null unique,        -- kg, g, L, units
  name  text not null
);

create table items (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  description  text,
  default_uom_id uuid references uoms(id),
  created_at   timestamptz default now()
);

-- ============ PURCHASE ORDERS (multi-item) ============
create table purchase_orders (
  id          uuid primary key default gen_random_uuid(),
  po_number   text not null unique,
  vendor_id   uuid references vendors(id),
  po_date     date not null,
  source      text default 'manual',     -- 'manual' | 'pdf'
  created_at  timestamptz default now()
);

create table po_line_items (
  id            uuid primary key default gen_random_uuid(),
  po_id         uuid references purchase_orders(id) on delete cascade,
  item_id       uuid references items(id),
  expected_qty  numeric(14,3) not null,
  uom_id        uuid references uoms(id)
);

-- ============ GRN ============
create type grn_status as enum ('pending_review','discrepancy','reconciled');

create table grns (
  id            uuid primary key default gen_random_uuid(),
  grn_ref       text not null unique,    -- WH1-260622-001
  warehouse_code text not null,          -- WH1 | WH2
  grn_date      date not null default current_date,
  po_id         uuid references purchase_orders(id),
  invoice_no    text,
  challan_no    text,
  attachment_url text,                   -- challan / damage photo
  status        grn_status not null default 'pending_review',
  created_at    timestamptz default now()
);

create table grn_line_items (
  id              uuid primary key default gen_random_uuid(),
  grn_id          uuid references grns(id) on delete cascade,
  po_line_item_id uuid references po_line_items(id),
  item_id         uuid references items(id),
  expected_qty    numeric(14,3),
  actual_qty      numeric(14,3),
  uom_id          uuid references uoms(id),
  batch_no        text,
  mfg_date        date,
  expiry_date     date,
  damaged_qty     numeric(14,3) default 0,
  damage_reason   text
);

-- ============ GRN SEQUENCE GENERATOR ============
create table grn_sequences (
  warehouse_code text not null,
  seq_date       date not null,
  last_seq       int  not null default 0,
  primary key (warehouse_code, seq_date)
);

create or replace function next_grn_ref(p_wh text)
returns text
language plpgsql
as $$
declare
  v_seq int;
  v_date date := current_date;
begin
  insert into grn_sequences (warehouse_code, seq_date, last_seq)
    values (p_wh, v_date, 1)
  on conflict (warehouse_code, seq_date)
    do update set last_seq = grn_sequences.last_seq + 1
  returning last_seq into v_seq;

  return p_wh || '-' || to_char(v_date,'YYMMDD') || '-' || lpad(v_seq::text, 3, '0');
end;
$$;

-- ============ SEED UOMs ============
insert into uoms (code, name) values
  ('kg','Kilogram'),('g','Gram'),('L','Liter'),('units','Units')
on conflict do nothing;

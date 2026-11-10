-- Modulo de orcamentos VM Andaimes
-- Seguro para executar mais de uma vez; nao altera tabelas existentes.
create extension if not exists pgcrypto;

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null default (
    'ORC-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  ),
  client_name text not null,
  requester text,
  project_name text,
  work_site text,
  quote_date date not null default current_date,
  valid_until date,
  discount numeric(14,2) not null default 0 check (discount >= 0),
  extra_cost numeric(14,2) not null default 0 check (extra_cost >= 0),
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  total numeric(14,2) not null default 0 check (total >= 0),
  notes text,
  items jsonb not null default '[]'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotations_items_array check (jsonb_typeof(items) = 'array')
);

create index if not exists idx_quotations_created_at
  on public.quotations(created_at desc);
create index if not exists idx_quotations_client_name
  on public.quotations(client_name);

alter table public.quotations enable row level security;

drop policy if exists "vm_quotations_select" on public.quotations;
create policy "vm_quotations_select" on public.quotations
  for select to authenticated using (true);

drop policy if exists "vm_quotations_insert" on public.quotations;
create policy "vm_quotations_insert" on public.quotations
  for insert to authenticated
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

drop policy if exists "vm_quotations_update" on public.quotations;
create policy "vm_quotations_update" on public.quotations
  for update to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

drop policy if exists "vm_quotations_delete" on public.quotations;
create policy "vm_quotations_delete" on public.quotations
  for delete to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'admin'
    )
  );

grant select, insert, update, delete on public.quotations to authenticated;

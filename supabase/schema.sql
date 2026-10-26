-- Controle de Andaimes VM — execute no SQL Editor do Supabase.
-- Recomendação: projeto Supabase separado para manter isolamento do RH.

create extension if not exists pgcrypto;

create table if not exists public.scaffolds (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  client text not null,
  work_site text not null,
  requester text not null,
  description text not null,
  mounted_at date not null default current_date,
  responsible text not null,
  status text not null default 'montado'
    check (status in ('montado','aguardando_retirada','retirado')),
  notes text,
  removed_at date,
  removal_responsible text,
  removal_notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint removal_data_consistency check (
    (status <> 'retirado') or (removed_at is not null and removal_responsible is not null)
  )
);

create sequence if not exists public.scaffold_code_seq start 1;

create or replace function public.set_scaffold_code()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.code is null or new.code = '' then
    new.code := 'AND-' || lpad(nextval('public.scaffold_code_seq')::text, 5, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_scaffold_code on public.scaffolds;
create trigger trg_set_scaffold_code
before insert or update on public.scaffolds
for each row execute function public.set_scaffold_code();

create table if not exists public.scaffold_inspections (
  id uuid primary key default gen_random_uuid(),
  scaffold_id uuid not null references public.scaffolds(id) on delete cascade,
  inspected_at date not null default current_date,
  inspector text not null,
  condition text not null check (condition in ('adequado','pendencia','interditado')),
  notes text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_scaffolds_status on public.scaffolds(status);
create index if not exists idx_scaffolds_mounted_at on public.scaffolds(mounted_at);
create index if not exists idx_inspections_scaffold_id on public.scaffold_inspections(scaffold_id);
create index if not exists idx_inspections_date on public.scaffold_inspections(inspected_at);

alter table public.scaffolds enable row level security;
alter table public.scaffold_inspections enable row level security;

drop policy if exists "authenticated users can read scaffolds" on public.scaffolds;
create policy "authenticated users can read scaffolds"
on public.scaffolds for select to authenticated using (true);

drop policy if exists "authenticated users can insert scaffolds" on public.scaffolds;
create policy "authenticated users can insert scaffolds"
on public.scaffolds for insert to authenticated with check (true);

drop policy if exists "authenticated users can update scaffolds" on public.scaffolds;
create policy "authenticated users can update scaffolds"
on public.scaffolds for update to authenticated using (true) with check (true);

drop policy if exists "authenticated users can delete scaffolds" on public.scaffolds;
create policy "authenticated users can delete scaffolds"
on public.scaffolds for delete to authenticated using (true);

drop policy if exists "authenticated users can read inspections" on public.scaffold_inspections;
create policy "authenticated users can read inspections"
on public.scaffold_inspections for select to authenticated using (true);

drop policy if exists "authenticated users can insert inspections" on public.scaffold_inspections;
create policy "authenticated users can insert inspections"
on public.scaffold_inspections for insert to authenticated with check (true);

drop policy if exists "authenticated users can update inspections" on public.scaffold_inspections;
create policy "authenticated users can update inspections"
on public.scaffold_inspections for update to authenticated using (true) with check (true);

drop policy if exists "authenticated users can delete inspections" on public.scaffold_inspections;
create policy "authenticated users can delete inspections"
on public.scaffold_inspections for delete to authenticated using (true);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.scaffolds to authenticated;
grant select, insert, update, delete on public.scaffold_inspections to authenticated;
grant usage, select on sequence public.scaffold_code_seq to authenticated;

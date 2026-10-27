
-- VM Andaimes: ampliacao segura dos modulos
-- Nao recria nem apaga as tabelas existentes.

create extension if not exists pgcrypto;

-- 1. Clientes
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text,
  phone text,
  email text,
  document_number text,
  address text,
  notes text,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Obras
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_id uuid references public.clients(id) on delete restrict,
  address text,
  responsible text,
  start_date date,
  end_date date,
  status text not null default 'ativa'
    check (status in ('planejada','ativa','pausada','concluida')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Campos opcionais de relacionamento com as tabelas existentes.
-- Permanecem nulos para nao alterar registros antigos.
alter table public.scaffolds
  add column if not exists client_id uuid
    references public.clients(id) on delete restrict;

alter table public.scaffolds
  add column if not exists work_id uuid
    references public.works(id) on delete restrict;

-- 4. Materiais
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  description text,
  unit text not null default 'unidade',
  current_quantity numeric(14,3) not null default 0
    check (current_quantity >= 0),
  minimum_quantity numeric(14,3) not null default 0
    check (minimum_quantity >= 0),
  active boolean not null default true,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_materials_code_unique
  on public.materials(code)
  where code is not null and code <> '';

-- 5. Movimentacoes de materiais
create table if not exists public.material_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null
    references public.materials(id) on delete restrict,
  movement_type text not null
    check (movement_type in ('entrada','saida','ajuste')),
  quantity numeric(14,3) not null check (quantity > 0),
  movement_date date not null default current_date,
  work_id uuid references public.works(id) on delete restrict,
  scaffold_id uuid references public.scaffolds(id) on delete restrict,
  responsible text not null,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- 6. Historico de retiradas.
-- Os campos antigos de retirada em scaffolds sao preservados.
create table if not exists public.scaffold_removals (
  id uuid primary key default gen_random_uuid(),
  scaffold_id uuid not null
    references public.scaffolds(id) on delete restrict,
  removed_at date not null,
  responsible text not null,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- 7. Migrar as retiradas antigas para o historico novo sem duplicar
-- registros que ja tenham sido migrados.
insert into public.scaffold_removals
  (scaffold_id, removed_at, responsible, notes, created_by)
select
  s.id,
  s.removed_at,
  s.removal_responsible,
  s.removal_notes,
  s.created_by
from public.scaffolds s
where s.status = 'retirado'
  and s.removed_at is not null
  and s.removal_responsible is not null
  and not exists (
    select 1
    from public.scaffold_removals r
    where r.scaffold_id = s.id
      and r.removed_at = s.removed_at
      and r.responsible = s.removal_responsible
  );

-- 8. Indices
create index if not exists idx_works_client_id
  on public.works(client_id);

create index if not exists idx_scaffolds_client_id
  on public.scaffolds(client_id);

create index if not exists idx_scaffolds_work_id
  on public.scaffolds(work_id);

create index if not exists idx_material_movements_material_date
  on public.material_movements(material_id, movement_date desc);

create index if not exists idx_material_movements_work_id
  on public.material_movements(work_id);

create index if not exists idx_material_movements_scaffold_id
  on public.material_movements(scaffold_id);

create index if not exists idx_removals_scaffold_date
  on public.scaffold_removals(scaffold_id, removed_at desc);

-- 9. RLS: somente usuarios autenticados podem acessar os novos modulos.
alter table public.clients enable row level security;
alter table public.works enable row level security;
alter table public.materials enable row level security;
alter table public.material_movements enable row level security;
alter table public.scaffold_removals enable row level security;

-- Clientes
drop policy if exists "vm_clients_select" on public.clients;
create policy "vm_clients_select" on public.clients
  for select to authenticated using (true);

drop policy if exists "vm_clients_insert" on public.clients;
create policy "vm_clients_insert" on public.clients
  for insert to authenticated with check (true);

drop policy if exists "vm_clients_update" on public.clients;
create policy "vm_clients_update" on public.clients
  for update to authenticated using (true) with check (true);

drop policy if exists "vm_clients_delete" on public.clients;
create policy "vm_clients_delete" on public.clients
  for delete to authenticated using (true);

-- Obras
drop policy if exists "vm_works_select" on public.works;
create policy "vm_works_select" on public.works
  for select to authenticated using (true);

drop policy if exists "vm_works_insert" on public.works;
create policy "vm_works_insert" on public.works
  for insert to authenticated with check (true);

drop policy if exists "vm_works_update" on public.works;
create policy "vm_works_update" on public.works
  for update to authenticated using (true) with check (true);

drop policy if exists "vm_works_delete" on public.works;
create policy "vm_works_delete" on public.works
  for delete to authenticated using (true);

-- Materiais
drop policy if exists "vm_materials_select" on public.materials;
create policy "vm_materials_select" on public.materials
  for select to authenticated using (true);

drop policy if exists "vm_materials_insert" on public.materials;
create policy "vm_materials_insert" on public.materials
  for insert to authenticated with check (true);

drop policy if exists "vm_materials_update" on public.materials;
create policy "vm_materials_update" on public.materials
  for update to authenticated using (true) with check (true);

drop policy if exists "vm_materials_delete" on public.materials;
create policy "vm_materials_delete" on public.materials
  for delete to authenticated using (true);

-- Movimentacoes
drop policy if exists "vm_movements_select" on public.material_movements;
create policy "vm_movements_select" on public.material_movements
  for select to authenticated using (true);

drop policy if exists "vm_movements_insert" on public.material_movements;
create policy "vm_movements_insert" on public.material_movements
  for insert to authenticated with check (true);

drop policy if exists "vm_movements_update" on public.material_movements;
create policy "vm_movements_update" on public.material_movements
  for update to authenticated using (true) with check (true);

drop policy if exists "vm_movements_delete" on public.material_movements;
create policy "vm_movements_delete" on public.material_movements
  for delete to authenticated using (true);

-- Retiradas
drop policy if exists "vm_removals_select" on public.scaffold_removals;
create policy "vm_removals_select" on public.scaffold_removals
  for select to authenticated using (true);

drop policy if exists "vm_removals_insert" on public.scaffold_removals;
create policy "vm_removals_insert" on public.scaffold_removals
  for insert to authenticated with check (true);

drop policy if exists "vm_removals_update" on public.scaffold_removals;
create policy "vm_removals_update" on public.scaffold_removals
  for update to authenticated using (true) with check (true);

drop policy if exists "vm_removals_delete" on public.scaffold_removals;
create policy "vm_removals_delete" on public.scaffold_removals
  for delete to authenticated using (true);

-- Permissoes para o cliente Supabase autenticado
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.works to authenticated;
grant select, insert, update, delete on public.materials to authenticated;
grant select, insert, update, delete on public.material_movements to authenticated;
grant select, insert, update, delete on public.scaffold_removals to authenticated;

grant select, insert, update, delete on public.scaffolds to authenticated;
grant select, insert, update, delete on public.scaffold_inspections to authenticated;

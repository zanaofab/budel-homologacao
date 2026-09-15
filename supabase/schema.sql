-- BUDEL - Portal de Homologação de Fornecedores
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'supplier' check (role in ('supplier','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  legal_name text not null,
  cnpj text not null,
  modality text not null,
  submission_status text not null default 'draft' check (submission_status in ('draft','submitted','approved','rejected')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(cnpj)
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type text not null,
  file_path text,
  original_name text,
  issue_date date,
  expiry_date date,
  not_available boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, type)
);

create index if not exists companies_owner_idx on public.companies(owner_id);
create index if not exists documents_company_idx on public.documents(company_id);
create index if not exists documents_expiry_idx on public.documents(expiry_date);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists documents_touch_updated_at on public.documents;
create trigger documents_touch_updated_at before update on public.documents
for each row execute procedure public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.documents enable row level security;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles
for select to authenticated using (id = auth.uid() or exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
));

drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "companies supplier read" on public.companies;
create policy "companies supplier read" on public.companies
for select to authenticated using (
  owner_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin')
);

drop policy if exists "companies supplier insert" on public.companies;
create policy "companies supplier insert" on public.companies
for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "companies supplier update" on public.companies;
create policy "companies supplier update" on public.companies
for update to authenticated using (
  owner_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin')
) with check (
  owner_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin')
);

drop policy if exists "documents supplier read" on public.documents;
create policy "documents supplier read" on public.documents
for select to authenticated using (
  exists (select 1 from public.companies c where c.id=company_id and (c.owner_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')))
);

drop policy if exists "documents supplier insert" on public.documents;
create policy "documents supplier insert" on public.documents
for insert to authenticated with check (
  exists (select 1 from public.companies c where c.id=company_id and (c.owner_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')))
);

drop policy if exists "documents supplier update" on public.documents;
create policy "documents supplier update" on public.documents
for update to authenticated using (
  exists (select 1 from public.companies c where c.id=company_id and (c.owner_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')))
) with check (
  exists (select 1 from public.companies c where c.id=company_id and (c.owner_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')))
);

drop policy if exists "documents supplier delete" on public.documents;
create policy "documents supplier delete" on public.documents
for delete to authenticated using (
  exists (select 1 from public.companies c where c.id=company_id and (c.owner_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')))
);

-- Storage: crie um bucket chamado supplier-documents, privado.
insert into storage.buckets (id, name, public)
values ('supplier-documents','supplier-documents',false)
on conflict (id) do update set public=false;

drop policy if exists "storage supplier upload" on storage.objects;
create policy "storage supplier upload" on storage.objects
for insert to authenticated
with check (bucket_id='supplier-documents' and split_part(name,'/',1)=auth.uid()::text);

drop policy if exists "storage supplier read" on storage.objects;
create policy "storage supplier read" on storage.objects
for select to authenticated
using (
  bucket_id='supplier-documents' and (
    split_part(name,'/',1)=auth.uid()::text
    or exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')
  )
);

drop policy if exists "storage supplier update" on storage.objects;
create policy "storage supplier update" on storage.objects
for update to authenticated
using (bucket_id='supplier-documents' and split_part(name,'/',1)=auth.uid()::text)
with check (bucket_id='supplier-documents' and split_part(name,'/',1)=auth.uid()::text);

drop policy if exists "storage supplier delete" on storage.objects;
create policy "storage supplier delete" on storage.objects
for delete to authenticated
using (bucket_id='supplier-documents' and split_part(name,'/',1)=auth.uid()::text);

-- Depois de criar a primeira conta da Budel, transforme-a em admin:
-- update public.profiles set role='admin' where email='SEU_EMAIL_Budel';

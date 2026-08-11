-- ============================================================
-- OrçaAI — Schema do banco de dados (Supabase / PostgreSQL)
-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- Inclui: tabelas, índices, RLS (Row Level Security) e storage.
--
-- O script é IDEMPOTENTE: pode ser executado mais de uma vez
-- sem erros (tabelas "if not exists" e políticas "drop if exists").
-- ============================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- TABELAS
-- ----------------------------------------------------------------

-- COMPANIES
create table if not exists public.companies (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  business_type text not null default 'Profissional autônomo',
  phone         text,
  whatsapp      text,
  email         text,
  address       text,
  cnpj          text,
  logo_url      text,
  settings      jsonb not null default '{}'::jsonb,
  plan          text not null default 'free' check (plan in ('free', 'pro', 'business')),
  quote_counter integer not null default 0,
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists companies_owner_idx on public.companies(owner_id);

-- SERVICES
create table if not exists public.services (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  name             text not null,
  description      text not null default '',
  price            numeric(12,2) not null check (price >= 0),
  unit             text not null default 'serviço',
  category         text not null default 'Outros',
  duration_minutes integer,
  observations     text,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists services_company_idx on public.services(company_id);

-- CUSTOMERS
create table if not exists public.customers (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  name            text not null,
  phone           text,
  email           text,
  notes           text,
  created_at      timestamptz not null default now(),
  last_contact_at timestamptz
);

create index if not exists customers_company_idx on public.customers(company_id);

-- QUOTES
create table if not exists public.quotes (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  number         integer not null,
  customer_id    uuid references public.customers(id) on delete set null,
  customer_name  text not null,
  customer_phone text,
  customer_email text,
  status         text not null default 'rascunho'
                 check (status in ('rascunho','enviado','visualizado','negociacao','aprovado','recusado','expirado')),
  subtotal       numeric(12,2) not null default 0,
  discount       numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  validity_days  integer not null default 7,
  valid_until    timestamptz not null,
  notes          text,
  terms          text,
  source_message text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  viewed_at      timestamptz,
  approved_at    timestamptz,
  unique (company_id, number)
);

create index if not exists quotes_company_idx on public.quotes(company_id, created_at desc);
create index if not exists quotes_customer_idx on public.quotes(customer_id);

-- QUOTE_ITEMS
create table if not exists public.quote_items (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.quotes(id) on delete cascade,
  service_id   uuid references public.services(id) on delete set null,
  name         text not null,
  description  text,
  quantity     numeric(12,2) not null default 1 check (quantity > 0),
  unit         text not null default 'serviço',
  price        numeric(12,2) not null default 0 check (price >= 0),
  observations text
);

create index if not exists quote_items_quote_idx on public.quote_items(quote_id);

-- FOLLOW_UPS
create table if not exists public.follow_ups (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  quote_id      uuid not null references public.quotes(id) on delete cascade,
  scheduled_for timestamptz not null,
  notes         text,
  status        text not null default 'pendente' check (status in ('pendente','concluido')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists follow_ups_company_idx on public.follow_ups(company_id, status);

-- NOTIFICATIONS
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  type       text not null default 'system' check (type in ('followup','status','plan','system')),
  title      text not null,
  body       text not null default '',
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_company_idx on public.notifications(company_id, created_at desc);

-- MESSAGES
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  quote_id   uuid not null references public.quotes(id) on delete cascade,
  body       text not null,
  channel    text not null default 'whatsapp' check (channel in ('whatsapp','email','copiado')),
  created_at timestamptz not null default now()
);

create index if not exists messages_quote_idx on public.messages(quote_id);

-- SUBSCRIPTIONS
create table if not exists public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  plan        text not null default 'free',
  status      text not null default 'ativo' check (status in ('ativo','cancelado','atrasado','pendente')),
  started_at  timestamptz not null default now(),
  renews_at   timestamptz,
  provider    text,
  provider_id text,
  unique (company_id)
);

-- ----------------------------------------------------------------
-- FUNÇÃO DE ACESSO (criada APÓS as tabelas — o PostgreSQL resolve
-- referências no momento da criação da função)
-- ----------------------------------------------------------------
create or replace function public.is_company_owner(company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companies c
    where c.id = company_id and c.owner_id = auth.uid()
  );
$$;

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
alter table public.companies     enable row level security;
alter table public.services      enable row level security;
alter table public.customers     enable row level security;
alter table public.quotes        enable row level security;
alter table public.quote_items   enable row level security;
alter table public.follow_ups    enable row level security;
alter table public.notifications enable row level security;
alter table public.messages      enable row level security;
alter table public.subscriptions enable row level security;

-- Companies: dono gerencia a própria empresa
drop policy if exists "companies_select_own" on public.companies;
create policy "companies_select_own" on public.companies for select using (owner_id = auth.uid());

drop policy if exists "companies_insert_own" on public.companies;
create policy "companies_insert_own" on public.companies for insert with check (owner_id = auth.uid());

drop policy if exists "companies_update_own" on public.companies;
create policy "companies_update_own" on public.companies for update using (owner_id = auth.uid());

drop policy if exists "companies_delete_own" on public.companies;
create policy "companies_delete_own" on public.companies for delete using (owner_id = auth.uid());

-- Demais tabelas: acesso somente via empresa (is_company_owner)
drop policy if exists "services_all_own" on public.services;
create policy "services_all_own" on public.services
  for all using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));

drop policy if exists "customers_all_own" on public.customers;
create policy "customers_all_own" on public.customers
  for all using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));

drop policy if exists "quotes_all_own" on public.quotes;
create policy "quotes_all_own" on public.quotes
  for all using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));

drop policy if exists "quote_items_all_own" on public.quote_items;
create policy "quote_items_all_own" on public.quote_items
  for all using (public.is_company_owner((select company_id from public.quotes q where q.id = quote_id)))
  with check (public.is_company_owner((select company_id from public.quotes q where q.id = quote_id)));

drop policy if exists "follow_ups_all_own" on public.follow_ups;
create policy "follow_ups_all_own" on public.follow_ups
  for all using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));

drop policy if exists "notifications_all_own" on public.notifications;
create policy "notifications_all_own" on public.notifications
  for all using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));

drop policy if exists "messages_all_own" on public.messages;
create policy "messages_all_own" on public.messages
  for all using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));

drop policy if exists "subscriptions_all_own" on public.subscriptions;
create policy "subscriptions_all_own" on public.subscriptions
  for all using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));

-- ================================================================
-- STORAGE (logos)
-- ================================================================
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "logos_public_read" on storage.objects;
create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');

drop policy if exists "logos_auth_insert" on storage.objects;
create policy "logos_auth_insert" on storage.objects
  for insert with check (bucket_id = 'logos' and auth.role() = 'authenticated');

drop policy if exists "logos_auth_update" on storage.objects;
create policy "logos_auth_update" on storage.objects
  for update using (bucket_id = 'logos' and auth.role() = 'authenticated');

drop policy if exists "logos_auth_delete" on storage.objects;
create policy "logos_auth_delete" on storage.objects
  for delete using (bucket_id = 'logos' and auth.role() = 'authenticated');

-- ============================================================
-- OrçaAI — Migração 0004: tabela de pagamentos (histórico)
-- Execute no SQL Editor do Supabase. Idempotente.
-- ============================================================

create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  plan        text not null check (plan in ('free', 'pro', 'business')),
  amount      numeric(12,2) not null default 0,
  status      text not null default 'pendente'
              check (status in ('pendente','aprovado','recusado','cancelado','reembolsado')),
  provider    text,
  provider_id text,
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);

create index if not exists payments_company_idx on public.payments(company_id, created_at desc);

alter table public.payments enable row level security;

drop policy if exists "payments_all_own" on public.payments;
create policy "payments_all_own" on public.payments
  for all using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));

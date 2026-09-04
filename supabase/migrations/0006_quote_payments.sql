-- ============================================================
-- OrçaAI — Migração 0006: pagamentos de orçamento pelo link
-- (Mercado Pago Split / Marketplace com comissão por plano)
--
-- payment_accounts: conta Mercado Pago do VENDEDOR conectada via
--   OAuth (marketplace). A access_token fica NO BANCO (servidor) e
--   nunca é exposta ao navegador.
-- quote_payments: cada pagamento feito pelo CLIENTE ao abrir o link
--   público de um orçamento ("Aprovar e pagar").
-- Idempotente.
-- ============================================================

-- Contas de pagamento dos vendedores
create table if not exists public.payment_accounts (
  company_id    uuid primary key references public.companies(id) on delete cascade,
  provider      text not null default 'mercado_pago',
  mp_user_id    text,
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  status        text not null default 'ativo' check (status in ('ativo','pendente','desconectado')),
  connected_at  timestamptz not null default now()
);

alter table public.payment_accounts enable row level security;

drop policy if exists "payment_accounts_all_own" on public.payment_accounts;
create policy "payment_accounts_all_own" on public.payment_accounts
  for all using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));

-- Pagamentos de orçamentos (feitos pelo cliente pelo link público)
create table if not exists public.quote_payments (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid not null references public.quotes(id) on delete cascade,
  company_id     uuid not null references public.companies(id) on delete cascade,
  amount         numeric(12,2) not null default 0,
  platform_fee   numeric(12,2) not null default 0,
  seller_receives numeric(12,2) not null default 0,
  status         text not null default 'pendente'
                 check (status in ('pendente','aprovado','recusado','cancelado','reembolsado')),
  provider       text,
  provider_id    text,
  payer_name     text,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz
);

create index if not exists quote_payments_company_idx on public.quote_payments(company_id, created_at desc);
create index if not exists quote_payments_quote_idx on public.quote_payments(quote_id);

alter table public.quote_payments enable row level security;

drop policy if exists "quote_payments_all_own" on public.quote_payments;
create policy "quote_payments_all_own" on public.quote_payments
  for all using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));

-- Função (security definer): devolve a conta de pagamento do vendedor a
-- partir do token público do orçamento — usada pela API de checkout para
-- cobrar COMO o vendedor (split) sem expor nada além disso.
create or replace function public.get_quote_payment_account(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'mp_user_id', pa.mp_user_id,
    'access_token', pa.access_token,
    'status', pa.status,
    'plan', c.plan,
    'company_id', q.company_id,
    'quote_id', q.id,
    'total', q.total,
    'customer_name', q.customer_name
  )
  from public.quotes q
  left join public.payment_accounts pa on pa.company_id = q.company_id
  left join public.companies c on c.id = q.company_id
  where q.share_token = p_token
  limit 1;
$$;

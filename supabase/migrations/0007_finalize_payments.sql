-- ============================================================
-- OrçaAI — Migração 0007: finalização automática de pagamentos
-- Funções "security definer" que aprovam o orçamento/plano quando o
-- cliente retorna do checkout (além do webhook). Idempotente.
-- ============================================================

-- Finaliza o pagamento de UM ORÇAMENTO (link público).
create or replace function public.finalize_quote_payment(
  p_company_id uuid,
  p_quote_id   uuid,
  p_provider_id text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_fee numeric;
  v_seller numeric;
begin
  select * into v_quote from public.quotes q
    where q.id = p_quote_id and q.company_id = p_company_id limit 1;
  if not found then
    return;
  end if;

  -- Marca como aprovado qualquer pagamento pendente deste orçamento
  update public.quote_payments qp
    set status = 'aprovado', paid_at = coalesce(qp.paid_at, now())
    where qp.company_id = p_company_id
      and qp.quote_id = p_quote_id
      and qp.status = 'pendente';

  -- Se não havia registro pendente (ex.: webhook só), cria um aprovado
  if not exists (
    select 1 from public.quote_payments qp
    where qp.company_id = p_company_id and qp.quote_id = p_quote_id and qp.status = 'aprovado'
  ) then
    select case when c.plan = 'free' then round((v_quote.total * 2)::numeric / 100, 2) else 0 end
      into v_fee from public.companies c where c.id = p_company_id;
    v_fee := coalesce(v_fee, 0);
    v_seller := round((v_quote.total - v_fee)::numeric, 2);
    insert into public.quote_payments
      (quote_id, company_id, amount, platform_fee, seller_receives, status, provider, provider_id, paid_at)
    values
      (p_quote_id, p_company_id, v_quote.total, v_fee, v_seller, 'aprovado', 'mercado_pago',
       coalesce(p_provider_id, ''), now());
  end if;

  -- Aprova o orçamento se ainda não estiver fechado
  update public.quotes q
    set status = 'aprovado',
        approved_at = coalesce(q.approved_at, now()),
        updated_at = now()
    where q.id = p_quote_id
      and q.company_id = p_company_id
      and q.status in ('enviado', 'visualizado', 'negociacao');

  -- Notifica o dono (evita duplicar se já existir igual)
  if not exists (
    select 1 from public.notifications n
    where n.company_id = p_company_id
      and n.type = 'status'
      and n.link = '/app/orcamentos/' || p_quote_id::text
      and n.title like 'Pagamento recebido%'
  ) then
    insert into public.notifications (company_id, type, title, body, link, read)
    values (
      p_company_id,
      'status',
      'Pagamento recebido! 💰',
      'O cliente pagou o orçamento #' || lpad(v_quote.number::text, 4, '0') ||
      ' pelo link. Valor: R$ ' || replace(v_quote.total::text, '.', ',') || '.',
      '/app/orcamentos/' || p_quote_id::text,
      false
    );
  end if;
end;
$$;

-- Finaliza a ativação de um PLANO (assinatura) após o pagamento.
create or replace function public.finalize_plan_payment(
  p_company_id uuid,
  p_plan       text,
  p_provider_id text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price numeric;
  v_renews timestamptz;
begin
  if p_plan not in ('free','pro','business') or p_plan = 'free' then
    return;
  end if;

  v_price := case p_plan when 'pro' then 59 when 'business' then 99 else 0 end;
  v_renews := now() + interval '30 days';

  -- Assinatura ativa (upsert)
  insert into public.subscriptions (company_id, plan, status, started_at, renews_at, provider, provider_id)
  values (p_company_id, p_plan, 'ativo', now(), v_renews, 'mercado_pago', coalesce(p_provider_id, ''))
  on conflict (company_id) do update
    set plan = excluded.plan,
        status = 'ativo',
        started_at = now(),
        renews_at = excluded.renews_at,
        provider = 'mercado_pago',
        provider_id = coalesce(excluded.provider_id, public.subscriptions.provider_id);

  -- Plano da empresa
  update public.companies set plan = p_plan where id = p_company_id;

  -- Registro no histórico de pagamentos (se ainda não tiver aprovado)
  if not exists (
    select 1 from public.payments p
    where p.company_id = p_company_id and p.plan = p_plan and p.status = 'aprovado'
  ) then
    insert into public.payments (company_id, plan, amount, status, provider, provider_id, paid_at)
    values (p_company_id, p_plan, v_price, 'aprovado', 'mercado_pago', coalesce(p_provider_id, ''), now());
  end if;

  if not exists (
    select 1 from public.notifications n
    where n.company_id = p_company_id and n.type = 'plan' and n.title like 'Pagamento aprovado%'
  ) then
    insert into public.notifications (company_id, type, title, body, link, read)
    values (
      p_company_id, 'plan', 'Pagamento aprovado 🎉',
      'Seu plano ' || p_plan || ' foi ativado. Recursos liberados!',
      '/app/planos', false
    );
  end if;
end;
$$;

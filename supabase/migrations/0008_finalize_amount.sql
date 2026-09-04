-- ============================================================
-- OrçaAI — Migração 0008: finalização com valor dinâmico do plano
-- Substitui finalize_plan_payment para receber o amount real
-- (preços podem mudar — ex.: Business R$1 para testes). Idempotente.
-- ============================================================

drop function if exists public.finalize_plan_payment(uuid, text, text);

create or replace function public.finalize_plan_payment(
  p_company_id  uuid,
  p_plan        text,
  p_provider_id text default null,
  p_amount      numeric default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price numeric;
  v_renews timestamptz;
begin
  if p_plan not in ('pro','business') then
    return;
  end if;

  v_price := coalesce(p_amount, case p_plan when 'pro' then 59 when 'business' then 1 else 0 end);
  v_renews := now() + interval '30 days';

  insert into public.subscriptions (company_id, plan, status, started_at, renews_at, provider, provider_id)
  values (p_company_id, p_plan, 'ativo', now(), v_renews, 'mercado_pago', coalesce(p_provider_id, ''))
  on conflict (company_id) do update
    set plan = excluded.plan,
        status = 'ativo',
        started_at = now(),
        renews_at = excluded.renews_at,
        provider = 'mercado_pago',
        provider_id = coalesce(excluded.provider_id, public.subscriptions.provider_id);

  update public.companies set plan = p_plan where id = p_company_id;

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

-- Finaliza o pagamento de um orçamento usando o TOKEN PÚBLICO do link
-- (usado na página de retorno /o/pago — não depende de external_reference).
create or replace function public.finalize_quote_payment_by_token(
  p_token       uuid,
  p_provider_id text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
begin
  select * into v_quote from public.quotes q where q.share_token = p_token limit 1;
  if not found then
    return;
  end if;
  perform public.finalize_quote_payment(v_quote.company_id, v_quote.id, p_provider_id);
end;
$$;

-- Melhora finalize_quote_payment: também persiste o provider_id do pagamento
drop function if exists public.finalize_quote_payment(uuid, uuid, text);

create or replace function public.finalize_quote_payment(
  p_company_id  uuid,
  p_quote_id    uuid,
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

  update public.quote_payments qp
    set status = 'aprovado',
        paid_at = coalesce(qp.paid_at, now()),
        provider_id = coalesce(p_provider_id, qp.provider_id)
    where qp.company_id = p_company_id
      and qp.quote_id = p_quote_id
      and qp.status = 'pendente';

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

  update public.quotes q
    set status = 'aprovado',
        approved_at = coalesce(q.approved_at, now()),
        updated_at = now()
    where q.id = p_quote_id
      and q.company_id = p_company_id
      and q.status in ('enviado', 'visualizado', 'negociacao');

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

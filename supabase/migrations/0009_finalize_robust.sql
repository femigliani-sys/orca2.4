-- ============================================================
-- OrçaAI — Migração 0009: finalização robusta do plano
-- Corrige o fluxo "pagamento confirmado no MP mas continua Pendente":
--
-- 1) finalize_plan_payment agora MARCA os registros pendentes da
--    tabela `payments` (company+plan) como aprovados — antes ela só
--    INSERIA uma nova linha aprovada, deixando a pendente do checkout
--    eternamente "pendente" no histórico/UI.
-- 2) Garante privilégio EXECUTE para anon/authenticated/service_role
--    (funções security definer criadas por usuários com "revoke public"
--    falhavam em silêncio no webhook, que roda sem sessão).
-- 3) Aceita amount dinâmico e provider_id do Mercado Pago.
-- Idempotente.
-- ============================================================

drop function if exists public.finalize_plan_payment(uuid, text, text);
drop function if exists public.finalize_plan_payment(uuid, text, text, numeric);

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
  v_price  numeric;
  v_renews timestamptz;
begin
  if p_plan not in ('pro', 'business') then
    return;
  end if;

  v_price  := coalesce(p_amount, case p_plan when 'pro' then 59 when 'business' then 1 else 0 end);
  v_renews := now() + interval '30 days';

  -- 1) Assinatura ativa (upsert por company)
  insert into public.subscriptions (company_id, plan, status, started_at, renews_at, provider, provider_id)
  values (p_company_id, p_plan, 'ativo', now(), v_renews, 'mercado_pago', coalesce(p_provider_id, ''))
  on conflict (company_id) do update
    set plan      = excluded.plan,
        status    = 'ativo',
        started_at = now(),
        renews_at = excluded.renews_at,
        provider  = 'mercado_pago',
        provider_id = coalesce(excluded.provider_id, public.subscriptions.provider_id);

  -- 2) Plano da empresa
  update public.companies set plan = p_plan where id = p_company_id;

  -- 3) CRÍTICO: marca como aprovados TODOS os registros pendentes
  --    deste plano na tabela `payments` (criados no checkout). Antes a
  --    função só inseria linha nova e a pendente original ficava para
  --    sempre como "pendente" — era isso que a tela mostrava.
  update public.payments
     set status      = 'aprovado',
         paid_at     = coalesce(paid_at, now()),
         provider    = coalesce(provider, 'mercado_pago'),
         provider_id = coalesce(p_provider_id, provider_id)
   where company_id = p_company_id
     and plan       = p_plan
     and status     = 'pendente';

  -- 4) Se não havia nenhum registro (ex.: pagamento sem checkout), garante 1
  if not exists (
    select 1 from public.payments
    where company_id = p_company_id and plan = p_plan
  ) then
    insert into public.payments (company_id, plan, amount, status, provider, provider_id, paid_at)
    values (p_company_id, p_plan, v_price, 'aprovado', 'mercado_pago', coalesce(p_provider_id, ''), now());
  end if;

  -- 5) Notificação (sem duplicar)
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

-- Garante que anon/authenticated possam executar (o webhook roda SEM sessão)
grant execute on function public.finalize_plan_payment(uuid, text, text, numeric) to anon, authenticated, service_role;
grant execute on function public.finalize_plan_payment(uuid, text, text, numeric) to public;

-- Mesma garantia para as demais funções de finalização já existentes
grant execute on function public.finalize_quote_payment(uuid, uuid, text) to anon, authenticated, service_role, public;
grant execute on function public.finalize_quote_payment_by_token(uuid, text) to anon, authenticated, service_role, public;
grant execute on function public.get_public_quote(uuid) to anon, authenticated, service_role, public;
grant execute on function public.mark_quote_viewed(uuid) to anon, authenticated, service_role, public;
grant execute on function public.approve_quote_by_token(uuid) to anon, authenticated, service_role, public;
grant execute on function public.get_quote_payment_account(uuid) to anon, authenticated, service_role, public;
grant execute on function public.is_company_owner(uuid) to anon, authenticated, service_role, public;

-- Finaliza pelo ID da PREFERÊNCIA do Mercado Pago (correlação exata):
-- usado quando o auto_return/back_url traz preference_id.
create or replace function public.finalize_plan_payment_by_preference(
  p_preference_id text,
  p_amount        numeric default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_plan text;
begin
  select company_id, plan into v_company_id, v_plan
    from public.payments
   where provider_id = p_preference_id and status = 'pendente'
   order by created_at desc
   limit 1;

  if v_company_id is null or v_plan is null then
    return;
  end if;

  perform public.finalize_plan_payment(v_company_id, v_plan, p_preference_id, p_amount);
end;
$$;

grant execute on function public.finalize_plan_payment_by_preference(text, numeric) to anon, authenticated, service_role, public;

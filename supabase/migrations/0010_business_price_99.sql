-- ============================================================
-- OrçaAI — Migração 0010: Business de volta a R$99
-- Atualiza o fallback de preço dentro de finalize_plan_payment
-- (usado quando o valor não é informado na chamada). Idempotente.
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

  v_price  := coalesce(p_amount, case p_plan when 'pro' then 59 when 'business' then 99 else 0 end);
  v_renews := now() + interval '30 days';

  insert into public.subscriptions (company_id, plan, status, started_at, renews_at, provider, provider_id)
  values (p_company_id, p_plan, 'ativo', now(), v_renews, 'mercado_pago', coalesce(p_provider_id, ''))
  on conflict (company_id) do update
    set plan      = excluded.plan,
        status    = 'ativo',
        started_at = now(),
        renews_at = excluded.renews_at,
        provider  = 'mercado_pago',
        provider_id = coalesce(excluded.provider_id, public.subscriptions.provider_id);

  update public.companies set plan = p_plan where id = p_company_id;

  update public.payments
     set status      = 'aprovado',
         paid_at     = coalesce(paid_at, now()),
         provider    = coalesce(provider, 'mercado_pago'),
         provider_id = coalesce(p_provider_id, provider_id)
   where company_id = p_company_id
     and plan       = p_plan
     and status     = 'pendente';

  if not exists (
    select 1 from public.payments
    where company_id = p_company_id and plan = p_plan
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

grant execute on function public.finalize_plan_payment(uuid, text, text, numeric) to anon, authenticated, service_role, public;

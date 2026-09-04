-- ============================================================
-- OrçaAI — Migração 0005: link público de orçamento (plano Pro+)
-- Adiciona um token de compartilhamento aos orçamentos e funções
-- "security definer" que permitem que o LINK PÚBLICO leia/aprove
-- um orçamento específico SEM autenticação, mas SEM expor o resto.
-- Idempotente.
-- ============================================================

-- 1) Token de compartilhamento (uuid aleatório por orçamento)
alter table public.quotes add column if not exists share_token uuid default gen_random_uuid();
create unique index if not exists quotes_share_token_idx on public.quotes(share_token);

-- 2) Função segura: retorna os dados do orçamento + empresa (somente o necessário)
create or replace function public.get_public_quote(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_quote public.quotes%rowtype;
  v_items jsonb;
  v_company jsonb;
begin
  select * into v_quote from public.quotes q where q.share_token = p_token limit 1;
  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'name', i.name,
    'description', i.description,
    'quantity', i.quantity,
    'unit', i.unit,
    'price', i.price,
    'observations', i.observations
  )), '[]'::jsonb)
  into v_items
  from public.quote_items i where i.quote_id = v_quote.id;

  select jsonb_build_object(
    'name', c.name,
    'plan', c.plan,
    'phone', c.phone,
    'whatsapp', c.whatsapp,
    'email', c.email,
    'address', c.address,
    'logo_url', c.logo_url,
    'settings', c.settings
  ) into v_company
  from public.companies c where c.id = v_quote.company_id;

  return jsonb_build_object(
    'id', v_quote.id,
    'number', v_quote.number,
    'customer_name', v_quote.customer_name,
    'status', v_quote.status,
    'items', v_items,
    'subtotal', v_quote.subtotal,
    'discount', v_quote.discount,
    'total', v_quote.total,
    'validity_days', v_quote.validity_days,
    'valid_until', v_quote.valid_until,
    'notes', v_quote.notes,
    'terms', v_quote.terms,
    'created_at', v_quote.created_at,
    'viewed_at', v_quote.viewed_at,
    'company', v_company
  );
end;
$$;

-- 3) Marca o orçamento como visualizado (quando o cliente abre o link)
create or replace function public.mark_quote_viewed(p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.quotes q
  set viewed_at = coalesce(q.viewed_at, now()),
      status = case when q.status = 'enviado' then 'visualizado' else q.status end,
      updated_at = now()
  where q.share_token = p_token;
$$;

-- 4) Aprova o orçamento pelo link público + notifica a empresa
create or replace function public.approve_quote_by_token(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
begin
  select * into v_quote from public.quotes q where q.share_token = p_token;
  if not found then
    return;
  end if;

  update public.quotes q
  set status = 'aprovado',
      approved_at = coalesce(q.approved_at, now()),
      updated_at = now()
  where q.share_token = p_token;

  insert into public.notifications (company_id, type, title, body, link, read)
  values (
    v_quote.company_id,
    'status',
    'Orçamento aprovado pelo cliente 🎉',
    '#' || lpad(v_quote.number::text, 4, '0') || ' (' || v_quote.customer_name || ') foi aprovado pelo link público.',
    '/app/orcamentos/' || v_quote.id::text,
    false
  );
end;
$$;

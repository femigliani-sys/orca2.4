-- ============================================================
-- OrçaAI — Migração 0003: única empresa por dono
-- Corrige o loop "volta para o onboarding" causado por linhas
-- duplicadas de companies (criadas por requisições paralelas).
-- Idempotente.
-- ============================================================

-- 1) Remove duplicatas: mantém a empresa mais antiga de cada dono
--    (as linhas mais novas são apagadas; dados ligados a elas são
--    removidos em cascata, mas duplicatas recém-criadas são vazias).
delete from public.companies a
using public.companies b
where a.owner_id = b.owner_id
  and a.created_at > b.created_at;

-- 2) Impede que duplicatas voltem a acontecer
alter table public.companies
  drop constraint if exists companies_owner_unique;

alter table public.companies
  add constraint companies_owner_unique unique (owner_id);

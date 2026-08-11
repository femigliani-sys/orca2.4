-- ============================================================
-- OrçaAI — Migração 0002: assinaturas com status "pendente"
-- (checkout Mercado Pago)
-- Execute este arquivo no SQL Editor do Supabase.
-- Idempotente: pode ser executado mais de uma vez.
-- ============================================================

-- Amplia o status aceito de subscriptions para incluir "pendente"
alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('ativo', 'cancelado', 'atrasado', 'pendente'));

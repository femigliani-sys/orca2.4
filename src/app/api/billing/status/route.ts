import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase';
import { searchPaymentsByExternalReference, isMercadoPagoConfigured } from '@/lib/mercado-pago';
import { PLANS } from '@/lib/plans';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/status
 * Consulta o ESTADO REAL da assinatura/pagamento e, se houver um pagamento
 * pendente que já foi APROVADO no Mercado Pago, finaliza (ativa) na hora.
 *
 * Por que existe:
 * - Se o usuário volta do checkout ANTES do webhook chegar, esta rota procura
 *   o pagamento no MP (por external_reference), confirma o status REAL
 *   (não confia no redirect) e ativa.
 * - Se o webhook já chegou e ativou, retorna o estado já atualizado.
 * - O frontend faz polling nesta rota enquanto o status for "pendente".
 *
 * Segurança: nunca ativa sem confirmar no Mercado Pago.
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ demo: true });
  }

  const server = await createServerSupabase().catch(() => null);
  if (!server) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });

  const {
    data: { user },
    error: authError,
  } = await server.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  // Usa admin (service role) quando disponível para chamar as RPCs (garante
  // privilégio mesmo que as funções não tenham EXECUTE público).
  const admin = createAdminSupabase();
  const db = admin ?? server;

  const { data: company } = await db
    .from('companies')
    .select('id, plan')
    .eq('owner_id', user.id)
    .single();
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

  const { data: sub } = await db
    .from('subscriptions')
    .select('*')
    .eq('company_id', company.id)
    .maybeSingle();

  const { data: pendentes } = await db
    .from('payments')
    .select('*')
    .eq('company_id', company.id)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false });

  // Se há pagamento pendente para um plano pago e o MP está configurado,
  // procura no MP o pagamento aprovado por external_reference (company:plan).
  if (isMercadoPagoConfigured() && Array.isArray(pendentes) && pendentes.length > 0) {
    for (const pendente of pendentes as { plan: string; id: string }[]) {
      const planId = pendente.plan;
      if (planId !== 'pro' && planId !== 'business') continue;
      const extRef = `${company.id}:${planId}`;
      // token do APP (dono) — pagamentos de plano são criados com ele
      const results = await searchPaymentsByExternalReference(
        process.env.MERCADO_PAGO_ACCESS_TOKEN as string,
        extRef,
      );
      const approved = (results ?? []).find((r) => r.status === 'approved');
      if (approved) {
        const plan = PLANS.find((p) => p.id === planId);
        const amount = approved.transaction_amount ?? plan?.price ?? undefined;
        const { error } = await db.rpc('finalize_plan_payment', {
          p_company_id: company.id,
          p_plan: planId,
          p_provider_id: String(approved.id),
          p_amount: amount ?? null,
        });
        if (error) {
          console.error('[billing/status] finalize_plan_payment:', error.message);
        }
      }
    }
  }

  // Auto-reparação: empresa já com plano pago, mas subscription ainda
  // "pendente" (dado legado de antes da migração 0009) → alinha para ativo.
  if ((company.plan === 'pro' || company.plan === 'business') && sub?.status === 'pendente') {
    const planDef = PLANS.find((p) => p.id === company.plan);
    const { error: fixErr } = await db.rpc('finalize_plan_payment', {
      p_company_id: company.id,
      p_plan: company.plan,
      p_provider_id: sub.provider_id ?? null,
      p_amount: planDef?.price ?? null,
    });
    if (fixErr) {
      console.error('[billing/status] auto-reparação falhou:', fixErr.message);
    }
  }

  // Re-lê o estado após eventuais finalizações
  const { data: companyAfter } = await db
    .from('companies')
    .select('plan')
    .eq('id', company.id)
    .single();
  const { data: subAfter } = await db
    .from('subscriptions')
    .select('*')
    .eq('company_id', company.id)
    .maybeSingle();
  const { data: pendAfter } = await db
    .from('payments')
    .select('*')
    .eq('company_id', company.id)
    .eq('status', 'pendente');

  return NextResponse.json({
    companyPlan: companyAfter?.plan ?? company.plan,
    subscription: subAfter
      ? {
          plan: subAfter.plan,
          status: subAfter.status,
          renewsAt: subAfter.renews_at,
        }
      : null,
    pendingCount: Array.isArray(pendAfter) ? pendAfter.length : 0,
  });
}

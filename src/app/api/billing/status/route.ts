import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  searchPaymentsByPreferenceId,
  isMercadoPagoConfigured,
} from '@/lib/mercado-pago';
import { PLANS } from '@/lib/plans';
import { createAdminSupabase } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/status
 * Consulta o ESTADO REAL da assinatura/pagamento. Para cada pagamento
 * pendente, confere no Mercado Pago (pela PREFERÊNCIA correspondente) se já
 * foi aprovado; só então finaliza/ativa. Nunca ativa sem comprovação.
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

  // ------------------------------------------------------------- Pendentes
  const { data: pendentes } = await db
    .from('payments')
    .select('*')
    .eq('company_id', company.id)
    .eq('status', 'pendente')
    .order('created_at', { ascending: false });

  if (isMercadoPagoConfigured() && Array.isArray(pendentes) && pendentes.length > 0) {
    for (const pendente of pendentes as { plan: string; provider_id: string | null }[]) {
      const planId = pendente.plan;
      if (planId !== 'pro' && planId !== 'business') continue;
      const prefId = pendente.provider_id ?? '';
      if (!prefId) continue;

      // Confere APENAS pela preferência deste checkout (não por external_reference
      // genérica — evita ativar com um pagamento aprovado antigo da empresa).
      let approved = false;
      try {
        const results = await searchPaymentsByPreferenceId(
          process.env.MERCADO_PAGO_ACCESS_TOKEN as string,
          prefId,
        );
        approved = (results ?? []).some((r) => r.status === 'approved');
      } catch {
        approved = false;
      }
      if (approved) {
        const plan = PLANS.find((p) => p.id === planId);
        const approvedPayment = (await searchPaymentsByPreferenceId(
          process.env.MERCADO_PAGO_ACCESS_TOKEN as string,
          prefId,
        )) ?? [];
        const first = approvedPayment.find((r) => r.status === 'approved');
        const { error } = await db.rpc('finalize_plan_payment', {
          p_company_id: company.id,
          p_plan: planId,
          p_provider_id: String(first?.id ?? prefId),
          p_amount: plan?.price ?? null,
        });
        if (error) {
          console.error('[billing/status] finalize_plan_payment:', error.message);
        }
      }
    }
  }

  // ---- Auto-reparação de estado inconsistente legado ----
  // company.plan pago + subscription pendente, MAS só ativa se existir prova
  // de pagamento (registro aprovado no banco para a empresa+plano).
  if ((company.plan === 'pro' || company.plan === 'business') && sub?.status === 'pendente') {
    const { data: prova } = await db
      .from('payments')
      .select('id')
      .eq('company_id', company.id)
      .eq('plan', company.plan)
      .eq('status', 'aprovado')
      .maybeSingle();
    if (prova) {
      const planDef = PLANS.find((p) => p.id === company.plan);
      await db.rpc('finalize_plan_payment', {
        p_company_id: company.id,
        p_plan: company.plan,
        p_provider_id: sub.provider_id ?? null,
        p_amount: planDef?.price ?? null,
      }).then(
        () => {},
        () => {},
      );
    }
  }

  // Re-lê o estado final
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
      ? { plan: subAfter.plan, status: subAfter.status, renewsAt: subAfter.renews_at }
      : null,
    pendingCount: Array.isArray(pendAfter) ? pendAfter.length : 0,
  });
}

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { getPayment, isMercadoPagoConfigured } from '@/lib/mercado-pago';
import { PLANS } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/webhook
 * Webhook do Mercado Pago (notificações de pagamento).
 *
 * Fluxo de segurança:
 * 1. Não confia no corpo da requisição — ao receber o ID do pagamento,
 *    CONSULTA a API do Mercado Pago para confirmar o status real.
 * 2. Só ativa o plano se o pagamento estiver com status "approved".
 * 3. Usa `external_reference` ("companyId:plan") definido na preferência.
 *
 * IMPORTANTE: responda 200 sempre (o Mercado Pago reenvia em caso de erro).
 */
export async function POST(req: Request) {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json({ received: true });
  }

  const raw = await req.text().catch(() => '');
  if (!raw) return NextResponse.json({ received: true });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ received: true });
  }

  // Formato MP: { action, type: "payment", data: { id } }
  const data = body.data as { id?: string | number } | undefined;
  const paymentId = data?.id ?? body.id ?? null;
  if (!paymentId) {
    return NextResponse.json({ received: true });
  }

  try {
    const payment = await getPayment(String(paymentId));
    if (!payment) {
      return NextResponse.json({ received: true });
    }

    // Só prossegue com pagamentos aprovados
    if (payment.status !== 'approved') {
      return NextResponse.json({ received: true });
    }

    const extRef = payment.external_reference ?? '';
    const [companyId, planRaw] = extRef.split(':');
    if (!companyId || !planRaw) {
      return NextResponse.json({ received: true });
    }
    const plan = PLANS.find((p) => p.id === planRaw);
    if (!plan) {
      return NextResponse.json({ received: true });
    }

    const supabase = await createServerSupabase();
    const now = new Date().toISOString();
    const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Upsert da assinatura como ativa
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('subscriptions')
        .update({
          plan: plan.id,
          status: 'ativo',
          provider: 'mercado_pago',
          provider_id: String(paymentId),
          started_at: now,
          renews_at: renewsAt,
        })
        .eq('company_id', companyId);
    } else {
      await supabase.from('subscriptions').insert({
        company_id: companyId,
        plan: plan.id,
        status: 'ativo',
        provider: 'mercado_pago',
        provider_id: String(paymentId),
        started_at: now,
        renews_at: renewsAt,
      });
    }

    // Atualiza o plano da empresa (o gating da UI lê companies.plan)
    await supabase.from('companies').update({ plan: plan.id }).eq('id', companyId);

    // Notificação in-app
    await supabase.from('notifications').insert({
      company_id: companyId,
      type: 'plan',
      title: 'Pagamento aprovado 🎉',
      body: `Seu plano ${plan.name} foi ativado. Recursos liberados!`,
      link: '/app/planos',
      read: false,
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhook] erro ao processar pagamento:', err);
    // Retorna 200 para evitar reenvios infinitos; o erro fica no log da Vercel
    return NextResponse.json({ received: true });
  }
}

/** GET de verificação (útil para checar que o webhook está no ar). */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'orcaai-billing-webhook' });
}

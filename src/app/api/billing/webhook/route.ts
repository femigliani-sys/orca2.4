import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { getPayment, getPreapproval, isMercadoPagoConfigured } from '@/lib/mercado-pago';
import { PLANS } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/webhook
 * Webhook do Mercado Pago (notificações de pagamento e assinatura).
 *
 * Segurança:
 * 1. Não confia no corpo — CONSULTA a API do MP para confirmar o status real.
 * 2. Só ativa o plano se o pagamento estiver "approved".
 * 3. Usa external_reference ("companyId:plan") definido no checkout.
 * 4. Registra o pagamento na tabela `payments` (histórico).
 *
 * IMPORTANTE: sempre responde 200 (o MP reenvia em caso de erro).
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

  const data = body.data as { id?: string | number } | undefined;
  const id = data?.id ?? body.id ?? null;
  if (!id) return NextResponse.json({ received: true });

  try {
    const supabase = await createServerSupabase();

    // ------------------------------------------------------------- Pagamento
    const payment = await getPayment(String(id));
    if (payment) {
      const extRef = payment.external_reference ?? '';

      // ---------- Pagamento de ORÇAMENTO (link público) ----------
      if (extRef.startsWith('quote:')) {
        const [, companyId, quoteId] = extRef.split(':');
        if (companyId && quoteId) {
          const now = new Date().toISOString();
          const amount = Number(payment.transaction_amount ?? 0);
          if (payment.status === 'approved') {
            // Confirma os pagamentos pendentes deste orçamento
            await supabase
              .from('quote_payments')
              .update({ status: 'aprovado', paid_at: now, payer_name: payment.payer?.first_name ?? null })
              .eq('company_id', companyId)
              .eq('quote_id', quoteId)
              .eq('status', 'pendente');

            // Aprova o orçamento se ainda não estiver
            await supabase
              .from('quotes')
              .update({ status: 'aprovado', approved_at: now, updated_at: now })
              .eq('id', quoteId)
              .eq('company_id', companyId)
              .in('status', ['enviado', 'visualizado', 'negociacao']);

            await supabase.from('notifications').insert({
              company_id: companyId,
              type: 'status',
              title: 'Pagamento recebido! 💰',
              body:
                'O cliente pagou o orçamento pelo link público. Valor: R$ ' +
                amount.toFixed(2).replace('.', ',') +
                '.',
              link: `/app/orcamentos/${quoteId}`,
              read: false,
            });
          } else if (['rejected', 'cancelled'].includes(payment.status)) {
            await supabase
              .from('quote_payments')
              .update({ status: payment.status === 'cancelled' ? 'cancelado' : 'recusado' })
              .eq('company_id', companyId)
              .eq('quote_id', quoteId)
              .eq('status', 'pendente');
          }
        }
        return NextResponse.json({ received: true });
      }

      const [companyId, planRaw] = extRef.split(':');
      const plan = PLANS.find((p) => p.id === planRaw);

      if (companyId && plan) {
        const now = new Date().toISOString();

        if (payment.status === 'approved') {
          const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          const { data: existing } = await supabase
            .from('subscriptions')
            .select('id')
            .eq('company_id', companyId)
            .maybeSingle();
          if (existing) {
            await supabase
              .from('subscriptions')
              .update({ plan: plan.id, status: 'ativo', provider: 'mercado_pago', provider_id: String(id), started_at: now, renews_at: renewsAt })
              .eq('company_id', companyId);
          } else {
            await supabase.from('subscriptions').insert({
              company_id: companyId,
              plan: plan.id,
              status: 'ativo',
              provider: 'mercado_pago',
              provider_id: String(id),
              started_at: now,
              renews_at: renewsAt,
            });
          }
          await supabase.from('companies').update({ plan: plan.id }).eq('id', companyId);

          // Registra no histórico de pagamentos
          const { data: dup } = await supabase
            .from('payments')
            .select('id')
            .eq('provider_id', String(id))
            .maybeSingle();
          if (!dup) {
            await supabase.from('payments').insert({
              company_id: companyId,
              plan: plan.id,
              amount: plan.price,
              status: 'aprovado',
              provider: 'mercado_pago',
              provider_id: String(id),
              created_at: now,
              paid_at: now,
            });
          }

          await supabase.from('notifications').insert({
            company_id: companyId,
            type: 'plan',
            title: 'Pagamento aprovado 🎉',
            body: `Seu plano ${plan.name} foi ativado. Recursos liberados!`,
            link: '/app/planos',
            read: false,
          });
        } else if (['rejected', 'cancelled', 'refunded'].includes(payment.status)) {
          await supabase
            .from('payments')
            .update({ status: payment.status === 'refunded' ? 'reembolsado' : payment.status === 'cancelled' ? 'cancelado' : 'recusado' })
            .eq('provider_id', String(id));
        }
      }
      return NextResponse.json({ received: true });
    }

    // ------------------------------------------------------- Assinatura
    const preapproval = await getPreapproval(String(id));
    if (preapproval) {
      const extRef = preapproval.external_reference ?? '';
      const [companyId, planRaw] = extRef.split(':');
      const plan = PLANS.find((p) => p.id === planRaw);
      if (companyId && plan) {
        if (preapproval.status === 'authorized' || preapproval.status === 'approved') {
          await supabase
            .from('subscriptions')
            .update({ plan: plan.id, status: 'ativo', provider: 'mercado_pago', provider_id: String(id), renews_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
            .eq('company_id', companyId)
            .eq('provider', 'mercado_pago');
          await supabase.from('companies').update({ plan: plan.id }).eq('id', companyId);
        } else if (preapproval.status === 'cancelled' || preapproval.status === 'paused') {
          await supabase
            .from('subscriptions')
            .update({ status: 'cancelado' })
            .eq('company_id', companyId)
            .eq('provider', 'mercado_pago');
        }
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhook] erro ao processar:', err);
    return NextResponse.json({ received: true });
  }
}

/** GET de verificação (útil para checar que o webhook está no ar). */
export async function GET() {
  return NextResponse.json({ ok: true, service: 'orcaai-billing-webhook' });
}

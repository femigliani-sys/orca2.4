import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@/lib/supabase-admin';
import {
  getPayment,
  getPaymentWithToken,
  getPreapproval,
  isMercadoPagoConfigured,
} from '@/lib/mercado-pago';
import { PLANS } from '@/lib/plans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/webhook — notificações de pagamento do Mercado Pago.
 *
 * Confirmação de status:
 * - Pagamentos de PLANOS (criados com o token do app): lê com o token do app.
 * - Pagamentos de ORÇAMENTO (split, criados com o token do VENDEDOR): tenta ler
 *   com o token do app e, se não conseguir, tenta com o token de cada vendedor
 *   conectado (via service role). Só ativa com status "approved".
 *
 * Sempre responde 200 (o MP reenvia em erro).
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
    const server = await createServerSupabase();
    const idStr = String(id);

    // 1) Tenta ler com o token do app (planos + marketplaces que permitem)
    let payment = await getPayment(idStr);

    // 2) Se não leu (split do vendedor) e há service role, tenta cada vendedor
    if (!payment) {
      const admin = createAdminSupabase();
      if (admin) {
        const { data: accounts } = await admin
          .from('payment_accounts')
          .select('access_token, company_id')
          .not('access_token', 'is', null);
        for (const acc of accounts ?? []) {
          const found = await getPaymentWithToken(idStr, acc.access_token as string);
          if (found) {
            payment = found;
            break;
          }
        }
      }
    }

    if (payment) {
      const extRef = payment.external_reference ?? '';

      // -------------------- ORÇAMENTO (link público) --------------------
      if (extRef.startsWith('quote:')) {
        const [, companyId, quoteId] = extRef.split(':');
        if (companyId && quoteId && payment.status === 'approved') {
          const { error } = await server.rpc('finalize_quote_payment', {
            p_company_id: companyId,
            p_quote_id: quoteId,
            p_provider_id: idStr,
          });
          if (error) {
            console.error('[webhook] finalize_quote_payment:', error.message);
          }
        }
        return NextResponse.json({ received: true });
      }

      // -------------------- PLANO (assinatura única) --------------------
      const [companyId, planRaw] = extRef.split(':');
      const plan = PLANS.find((p) => p.id === planRaw);
      if (companyId && plan) {
        if (payment.status === 'approved') {
          const { error } = await server.rpc('finalize_plan_payment', {
            p_company_id: companyId,
            p_plan: planRaw,
            p_provider_id: idStr,
            p_amount: plan.price,
          });
          if (error) {
            console.error('[webhook] finalize_plan_payment:', error.message);
          }
        }
        return NextResponse.json({ received: true });
      }
    }

    // -------------------- Assinatura recorrente (preapproval) --------------------
    const preapproval = await getPreapproval(idStr);
    if (preapproval) {
      const extRef = preapproval.external_reference ?? '';
      const [companyId, planRaw] = extRef.split(':');
      const plan = PLANS.find((p) => p.id === planRaw);
      if (companyId && plan && (preapproval.status === 'authorized' || preapproval.status === 'approved')) {
        await server.rpc('finalize_plan_payment', {
          p_company_id: companyId,
          p_plan: planRaw,
          p_provider_id: idStr,
          p_amount: plan.price,
        });
      } else if (companyId && (preapproval.status === 'cancelled' || preapproval.status === 'paused')) {
        await server
          .from('subscriptions')
          .update({ status: 'cancelado' })
          .eq('company_id', companyId)
          .eq('provider', 'mercado_pago');
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

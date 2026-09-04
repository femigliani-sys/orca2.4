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
 * As RPCs são executadas com ADMIN (service role) quando disponível — nunca
 * falham por permissão pública — e os erros são LOGADOS (visíveis na Vercel).
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

  const idStr = String(id);
  console.log('[webhook] recebida notificação, id=', idStr, 'type=', body.type ?? body.action ?? '?');

  try {
    const server = await createServerSupabase();
    const admin = createAdminSupabase();
    const db = admin ?? server; // RPC com privilégio garantido

    // 1) Tenta ler com o token do app (planos; marketplaces que permitem)
    let payment = await getPayment(idStr);

    // 2) Se não leu (split do vendedor), tenta cada vendedor conectado (admin)
    if (!payment && admin) {
      const { data: accounts } = await admin
        .from('payment_accounts')
        .select('access_token')
        .not('access_token', 'is', null);
      for (const acc of accounts ?? []) {
        const found = await getPaymentWithToken(idStr, (acc as { access_token: string }).access_token);
        if (found) {
          payment = found;
          break;
        }
      }
    }

    if (payment) {
      console.log('[webhook] status no MP =', payment.status, 'extRef =', payment.external_reference ?? '(vazio)');
      const extRef = payment.external_reference ?? '';

      // -------------------- ORÇAMENTO (link público) --------------------
      if (extRef.startsWith('quote:')) {
        const [, companyId, quoteId] = extRef.split(':');
        if (companyId && quoteId && payment.status === 'approved') {
          const { error } = await db.rpc('finalize_quote_payment', {
            p_company_id: companyId,
            p_quote_id: quoteId,
            p_provider_id: idStr,
          });
          if (error) {
            console.error('[webhook] finalize_quote_payment ERROR:', error.message);
          } else {
            console.log('[webhook] orçamento finalizado:', quoteId);
          }
        }
        return NextResponse.json({ received: true });
      }

      // -------------------- PLANO (Checkout Pro único) --------------------
      const [companyId, planRaw] = extRef.split(':');
      const plan = PLANS.find((p) => p.id === planRaw);
      if (companyId && plan) {
        if (payment.status === 'approved') {
          const { error } = await db.rpc('finalize_plan_payment', {
            p_company_id: companyId,
            p_plan: planRaw,
            p_provider_id: idStr,
            p_amount: plan.price,
          });
          if (error) {
            console.error('[webhook] finalize_plan_payment ERROR:', error.message);
          } else {
            console.log('[webhook] plano finalizado:', planRaw, 'para company', companyId);
          }
        }
        return NextResponse.json({ received: true });
      }

      // Pagamento reconhecido, mas sem external_reference nossa → não processa
      return NextResponse.json({ received: true });
    }

    // -------------------- Assinatura recorrente (preapproval) --------------------
    // (não é mais usado no checkout, mas mantido p/ compatibilidade)
    const preapproval = await getPreapproval(idStr);
    if (preapproval) {
      const extRef = preapproval.external_reference ?? '';
      const [companyId, planRaw] = extRef.split(':');
      const plan = PLANS.find((p) => p.id === planRaw);
      if (companyId && plan && (preapproval.status === 'authorized' || preapproval.status === 'approved')) {
        const { error } = await db.rpc('finalize_plan_payment', {
          p_company_id: companyId,
          p_plan: planRaw,
          p_provider_id: idStr,
          p_amount: plan.price,
        });
        if (error) {
          console.error('[webhook] preapproval finalize ERROR:', error.message);
        }
      } else if (companyId && (preapproval.status === 'cancelled' || preapproval.status === 'paused')) {
        await db
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

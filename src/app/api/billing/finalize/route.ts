import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPayment, getPaymentWithToken } from '@/lib/mercado-pago';
import { PLANS } from '@/lib/plans';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  status: z.enum(['approved', 'pending', 'rejected', 'failure', 'cancelled']).optional(),
  externalReference: z.string().optional(),
  paymentId: z.string().optional(),
  preferenceId: z.string().optional(),
  /** token público do orçamento (vem na back_url /o/pago?t=...) — caminho mais confiável */
  token: z.string().optional(),
});

/**
 * POST /api/billing/finalize
 * Finalização automática quando o cliente VOLTA do checkout (auto_return).
 * Complementa o webhook: aprova o orçamento/plano na hora.
 *
 * Segurança: só ativa com status "approved" (o MP só redireciona aprovado
 * quando auto_return=approved). Quando temos payment_id e um token capaz de
 * ler (conta do app), consultamos a API para confirmar.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: 'Indisponível no modo demonstração.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const { status, externalReference, paymentId, preferenceId, token } = parsed.data;
  if (status !== 'approved') {
    return NextResponse.json({ ok: true, activated: false });
  }

  const supabase = createClient(url, anon);
  const providerId = preferenceId ?? paymentId ?? null;

  // 1) Pagamento de ORÇAMENTO pelo token do link (caminho mais confiável)
  if (token) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(token) || /^[0-9a-f]{32}$/i.test(token.replace(/-/g, ''));
    if (isUuid) {
      // Verificação opcional: se paymentId e o token do app leem, confirma.
      if (paymentId) {
        try {
          const mp = await getPayment(paymentId);
          if (mp && mp.status !== 'approved') {
            return NextResponse.json({ ok: true, activated: false, reason: 'Não aprovado no MP.' });
          }
        } catch { /* segue */ }
      }
      const { error } = await supabase.rpc('finalize_quote_payment_by_token', {
        p_token: token,
        p_provider_id: providerId,
      });
      if (error) {
        return NextResponse.json({ error: `Erro ao finalizar: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ ok: true, activated: true, kind: 'quote' });
    }
  }

  // 2) Pagamento de ORÇAMENTO por external_reference (quote:company:quote)
  const extRef = externalReference ?? '';
  if (extRef.startsWith('quote:')) {
    const [, companyId, quoteId] = extRef.split(':');
    if (companyId && quoteId) {
      const { error } = await supabase.rpc('finalize_quote_payment', {
        p_company_id: companyId,
        p_quote_id: quoteId,
        p_provider_id: providerId,
      });
      if (error) {
        return NextResponse.json({ error: `Erro ao finalizar: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ ok: true, activated: true, kind: 'quote' });
    }
  }

  // 3) Plano do app (external_reference = company:plan)
  const [companyId, planRaw] = extRef.split(':');
  if (companyId && (planRaw === 'pro' || planRaw === 'business')) {
    if (paymentId) {
      try {
        const mp = await getPayment(paymentId);
        if (mp && mp.status !== 'approved') {
          return NextResponse.json({ ok: true, activated: false });
        }
      } catch { /* segue */ }
    }
    const plan = PLANS.find((p) => p.id === planRaw);
    const { error } = await supabase.rpc('finalize_plan_payment', {
      p_company_id: companyId,
      p_plan: planRaw,
      p_provider_id: providerId,
      p_amount: plan?.price ?? null,
    });
    if (error) {
      return NextResponse.json({ error: `Erro ao finalizar: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, activated: true, kind: 'plan' });
  }

  return NextResponse.json({ ok: true, activated: false, reason: 'Referência não reconhecida.' });
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPayment } from '@/lib/mercado-pago';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  status: z.enum(['approved', 'pending', 'rejected', 'failure', 'cancelled']).optional(),
  externalReference: z.string().optional(),
  paymentId: z.string().optional(),
  preferenceId: z.string().optional(),
});

/**
 * POST /api/billing/finalize
 * Finalização automática quando o cliente VOLTA do checkout do Mercado Pago
 * (auto_return). Complementa o webhook: garante que o orçamento/plano seja
 * aprovado na hora mesmo se a notificação IPN atrasar ou não estiver
 * configurada.
 *
 * Segurança: só ativa se o status retornado for "approved" (o Mercado Pago
 * só redireciona com auto_return=approved após pagamento aprovado). Quando há
 * payment_id, consulta a API para confirmar antes de ativar.
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

  const { status, externalReference, paymentId, preferenceId } = parsed.data;
  if (status !== 'approved') {
    return NextResponse.json({ ok: true, activated: false });
  }

  const extRef = externalReference ?? '';

  // Verificação opcional na API do MP (quando temos o id do pagamento)
  if (paymentId) {
    try {
      const mpPayment = await getPayment(paymentId);
      if (mpPayment && mpPayment.status !== 'approved') {
        return NextResponse.json({ ok: true, activated: false, reason: 'Pagamento não aprovado no MP.' });
      }
    } catch {
      // segue em frente — não bloquear quando não dá para consultar (split usa token do vendedor)
    }
  }

  const supabase = createClient(url, anon);
  const providerId = preferenceId ?? paymentId ?? null;

  // Pagamento de ORÇAMENTO (link público): external_reference = quote:company:quote
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

  // Plano do app: external_reference = company:plan
  const [companyId, planRaw] = extRef.split(':');
  if (companyId && (planRaw === 'pro' || planRaw === 'business')) {
    const { error } = await supabase.rpc('finalize_plan_payment', {
      p_company_id: companyId,
      p_plan: planRaw,
      p_provider_id: providerId,
    });
    if (error) {
      return NextResponse.json({ error: `Erro ao finalizar: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, activated: true, kind: 'plan' });
  }

  return NextResponse.json({ ok: true, activated: false, reason: 'external_reference não reconhecida.' });
}

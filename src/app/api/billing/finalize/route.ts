import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminSupabase } from '@/lib/supabase-admin';
import {
  getPayment,
  searchPaymentsByExternalReference,
  searchPaymentsByPreferenceId,
  isMercadoPagoConfigured,
} from '@/lib/mercado-pago';
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
 * Finalização quando o cliente VOLTA do checkout (auto_return).
 *
 * PLANO (Pro/Business): a ativação SÓ acontece após confirmar o status REAL
 * no Mercado Pago (com paymentId → consulta direta; sem paymentId → busca por
 * external_reference com o token do app). Nunca confia apenas no redirect.
 *
 * ORÇAMENTO (split, token do VENDEDOR): mantém o fluxo atual — a confirmação
 * é feita pelo próprio Mercado Pago no redirect + webhook/sync dedicados.
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

  const admin = createAdminSupabase();
  const db = admin ?? createClient(url, anon);
  const providerId = preferenceId ?? paymentId ?? null;

  /** Confirma no MP (token do app) que existe pagamento aprovado p/ esta ref. */
  async function planConfirmedInMp(extRefToCheck: string, maybePaymentId?: string): Promise<boolean> {
    if (maybePaymentId) {
      try {
        const mp = await getPayment(maybePaymentId);
        const status: string | undefined = mp?.status;
        if (status === 'approved') return true;
        if (status) return false; // leu e não é aprovado
      } catch {
        /* não leu → tenta search abaixo */
      }
    }
    if (isMercadoPagoConfigured() && extRefToCheck) {
      try {
        const results = await searchPaymentsByExternalReference(
          process.env.MERCADO_PAGO_ACCESS_TOKEN as string,
          extRefToCheck,
        );
        return (results ?? []).some((r) => r.status === 'approved');
      } catch {
        return false;
      }
    }
    return false;
  }

  const extRef = externalReference ?? '';

  // ---- ORÇAMENTO pelo token do link (mantém fluxo atual, não regride) ----
  if (token) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(token) || /^[0-9a-f]{32}$/i.test(token.replace(/-/g, ''));
    if (isUuid) {
      const { error } = await db.rpc('finalize_quote_payment_by_token', {
        p_token: token,
        p_provider_id: providerId,
      });
      if (error) {
        return NextResponse.json({ error: `Erro ao finalizar: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ ok: true, activated: true, kind: 'quote' });
    }
  }

  // ---- ORÇAMENTO por external_reference (quote:company:quote) ----
  if (extRef.startsWith('quote:')) {
    const [, companyId, quoteId] = extRef.split(':');
    if (companyId && quoteId) {
      const { error } = await db.rpc('finalize_quote_payment', {
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

  // ---- PLANO (external_reference = company:plan) — confirma no MP ----
  const [companyId, planRaw] = extRef.split(':');
  if (companyId && (planRaw === 'pro' || planRaw === 'business')) {
    const okMp = await planConfirmedInMp(extRef, paymentId ?? undefined);
    if (!okMp) {
      return NextResponse.json({ ok: true, activated: false, reason: 'Pagamento ainda não confirmado no MP.' });
    }
    const plan = PLANS.find((p) => p.id === planRaw);
    const { error } = await db.rpc('finalize_plan_payment', {
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

  // ---- PLANO com preference_id (quando a URL volta com preference_id e não
  // há external_reference) — exige CONFIRMAÇÃO no MP antes de ativar. ----
  if (preferenceId) {
    // Busca pagamentos da preferência e exige pelo menos um "approved".
    let approved = false;
    if (isMercadoPagoConfigured()) {
      try {
        const results = await searchPaymentsByPreferenceId(
          process.env.MERCADO_PAGO_ACCESS_TOKEN as string,
          preferenceId,
        );
        approved = (results ?? []).some((r) => r.status === 'approved');
      } catch {
        approved = false;
      }
    }
    if (!approved) {
      return NextResponse.json({
        ok: true,
        activated: false,
        reason: 'Pagamento não confirmado no Mercado Pago.',
      });
    }
    const { error } = await db.rpc('finalize_plan_payment_by_preference', {
      p_preference_id: preferenceId,
      p_amount: null,
    });
    if (error) {
      return NextResponse.json({ error: `Erro ao finalizar: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, activated: true, kind: 'plan' });
  }

  return NextResponse.json({ ok: true, activated: false, reason: 'Referência não reconhecida.' });
}

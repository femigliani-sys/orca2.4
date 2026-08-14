import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import {
  createCheckoutPreference,
  createPreapproval,
  isMercadoPagoConfigured,
} from '@/lib/mercado-pago';
import { PLANS } from '@/lib/plans';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  plan: z.enum(['free', 'pro', 'business']),
});

/**
 * POST /api/billing/checkout
 * Inicia a compra de um plano pago (Pro ou Business).
 *
 * Com Mercado Pago configurado:
 *   - cria uma ASSINATURA recorrente (preapproval) com fallback para
 *     pagamento único (Checkout Pro) se a assinatura falhar;
 *   - retorna { initPoint } → o navegador redireciona para o pagamento.
 *
 * Sem Mercado Pago configurado (modo simulado):
 *   - registra a assinatura como "pendente" e retorna { simulated, checkoutId };
 *   - o usuário finaliza em /api/billing/checkout/complete (apenas para teste).
 *
 * Em ambos os casos, o pagamento é registrado na tabela `payments`.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabase().catch(() => null);
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado. Faça login.' }, { status: 401 });
  }

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name, email, plan')
    .eq('owner_id', user.id)
    .single();
  if (companyError || !company) {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });

  const plan = parsed.data.plan;
  const planDef = PLANS.find((p) => p.id === plan);
  if (!planDef || planDef.price === 0) {
    return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const paymentId = crypto.randomUUID();

  // Registra o pagamento como pendente (usado para o histórico)
  await supabase.from('payments').insert({
    id: paymentId,
    company_id: company.id,
    plan,
    amount: planDef.price,
    status: 'pendente',
    provider: isMercadoPagoConfigured() ? 'mercado_pago' : 'simulado',
    provider_id: isMercadoPagoConfigured() ? paymentId : paymentId,
    created_at: now,
  });

  // ============================================================ Modo real
  if (isMercadoPagoConfigured()) {
    try {
      // 1) Tenta assinatura recorrente (preapproval)
      let initPoint: string | null = null;
      try {
        const preapproval = await createPreapproval({
          plan,
          companyId: company.id,
          email: user.email ?? undefined,
        });
        if (preapproval.init_point) initPoint = preapproval.init_point;
      } catch (err) {
        console.warn('[checkout] preapproval falhou, usando checkout único:', err instanceof Error ? err.message : err);
      }

      // 2) Fallback: checkout único
      if (!initPoint) {
        const preference = await createCheckoutPreference({ plan, companyId: company.id, email: user.email ?? undefined });
        initPoint = preference.initPoint;
      }

      if (!initPoint) throw new Error('Não foi possível gerar o link de pagamento.');

      await upsertSubscription(supabase, company.id, plan, 'pendente', 'mercado_pago', paymentId);

      return NextResponse.json({ initPoint, simulated: false });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Não foi possível iniciar o pagamento.' },
        { status: 500 },
      );
    }
  }

  // ============================================================ Modo simulado
  await upsertSubscription(supabase, company.id, plan, 'pendente', 'simulado', paymentId);

  return NextResponse.json({
    simulated: true,
    checkoutId: paymentId,
    message: 'Pagamento simulado (chave do Mercado Pago não configurada).',
  });
}

async function upsertSubscription(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  companyId: string,
  plan: string,
  status: string,
  provider: string,
  providerId: string,
) {
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('company_id', companyId)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing) {
    await supabase
      .from('subscriptions')
      .update({ plan, status, provider, provider_id: providerId, started_at: now, renews_at: null })
      .eq('company_id', companyId);
  } else {
    await supabase.from('subscriptions').insert({
      company_id: companyId,
      plan,
      status,
      provider,
      provider_id: providerId,
      started_at: now,
      renews_at: null,
    });
  }
}

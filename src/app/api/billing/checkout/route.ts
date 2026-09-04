import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createCheckoutPreference, isMercadoPagoConfigured } from '@/lib/mercado-pago';
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
  const paymentId = crypto.randomUUID(); // id interno do registro no Supabase

  // ============================================================ Modo real
  if (isMercadoPagoConfigured()) {
    try {
      // Usamos o Checkout Pro de PAGAMENTO ÚNICO (não preapproval/recorrência):
      // o preapproval do Mercado Pago só aceita CARTÃO (a recorrência exige
      // cartão salvo), o que impedia Pix/boleto. Com o Checkout Pro único,
      // o cliente escolhe Pix, cartão ou boleto na própria tela do MP.
      const preference = await createCheckoutPreference({
        plan,
        companyId: company.id,
        email: user.email ?? undefined,
      });

      // Registra o pagamento pendente usando o id REAL da preferência do MP
      // como provider_id → correlação exata com o retorno/back_url/webhook.
      await supabase.from('payments').insert({
        id: paymentId,
        company_id: company.id,
        plan,
        amount: planDef.price,
        status: 'pendente',
        provider: 'mercado_pago',
        provider_id: preference.id,
        created_at: now,
      });

      await upsertSubscription(supabase, company.id, plan, 'pendente', 'mercado_pago', preference.id);

      return NextResponse.json({ initPoint: preference.initPoint, simulated: false });
    } catch (err) {
      // limpa o registro interno caso a preferência falhe
      await supabase.from('payments').delete().eq('id', paymentId).then(
        () => {},
        () => {},
      );
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Não foi possível iniciar o pagamento.' },
        { status: 500 },
      );
    }
  }

  // ============================================================ Modo simulado
  await supabase.from('payments').insert({
    id: paymentId,
    company_id: company.id,
    plan,
    amount: planDef.price,
    status: 'pendente',
    provider: 'simulado',
    provider_id: paymentId,
    created_at: now,
  });
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

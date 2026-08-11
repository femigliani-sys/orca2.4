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
 * Cria a preferência de pagamento no Mercado Pago para o plano escolhido
 * e registra a assinatura como "pendente".
 * Retorna a URL do Checkout Pro (init_point) para redirecionar o usuário.
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
  if (!planDef) return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });

  if (!isMercadoPagoConfigured()) {
    return NextResponse.json(
      { error: 'Pagamentos ainda não configurados. Entre em contato com o suporte.' },
      { status: 503 },
    );
  }

  try {
    const preference = await createCheckoutPreference({
      plan,
      companyId: company.id,
      email: user.email ?? undefined,
    });

    // Registra a assinatura como pendente (upsert)
    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('company_id', company.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('subscriptions')
        .update({
          plan,
          status: 'pendente',
          provider: 'mercado_pago',
          provider_id: preference.id,
          started_at: now,
          renews_at: null,
        })
        .eq('company_id', company.id);
    } else {
      await supabase.from('subscriptions').insert({
        company_id: company.id,
        plan,
        status: 'pendente',
        provider: 'mercado_pago',
        provider_id: preference.id,
        started_at: now,
      });
    }

    return NextResponse.json({
      initPoint: preference.initPoint,
      preferenceId: preference.id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Não foi possível iniciar o pagamento.' },
      { status: 500 },
    );
  }
}

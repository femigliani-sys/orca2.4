import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { PLANS } from '@/lib/plans';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  checkoutId: z.string().min(1),
});

/**
 * POST /api/billing/checkout/complete
 * Finaliza um checkout SIMULADO (quando o Mercado Pago não está configurado).
 * ATENÇÃO: em produção real este fluxo não é usado — a ativação acontece pelo
 * webhook quando o pagamento é aprovado.
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabase().catch(() => null);
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Checkout inválido.' }, { status: 400 });

  const checkoutId = parsed.data.checkoutId;

  // Acha o pagamento pendente deste checkout
  const { data: payment, error: pError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', checkoutId)
    .eq('company_id', company.id)
    .eq('status', 'pendente')
    .maybeSingle();

  if (pError || !payment) {
    return NextResponse.json({ error: 'Checkout não encontrado.' }, { status: 404 });
  }

  const plan = PLANS.find((p) => p.id === payment.plan);
  if (!plan || plan.price === 0) {
    return NextResponse.json({ error: 'Plano inválido.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Assinatura ativa
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('company_id', company.id)
    .maybeSingle();
  if (existing) {
    await supabase
      .from('subscriptions')
      .update({ plan: plan.id, status: 'ativo', provider: 'simulado', provider_id: checkoutId, started_at: now, renews_at: renewsAt })
      .eq('company_id', company.id);
  } else {
    await supabase.from('subscriptions').insert({
      company_id: company.id,
      plan: plan.id,
      status: 'ativo',
      provider: 'simulado',
      provider_id: checkoutId,
      started_at: now,
      renews_at: renewsAt,
    });
  }

  // Plano da empresa + pagamento aprovado + notificação
  await supabase.from('companies').update({ plan: plan.id }).eq('id', company.id);
  await supabase.from('payments').update({ status: 'aprovado', paid_at: now }).eq('id', checkoutId);
  await supabase.from('notifications').insert({
    company_id: company.id,
    type: 'plan',
    title: 'Pagamento aprovado 🎉',
    body: `Seu plano ${plan.name} foi ativado (modo simulado). Recursos liberados!`,
    link: '/app/planos',
    read: false,
  });

  return NextResponse.json({ ok: true, plan: plan.id });
}

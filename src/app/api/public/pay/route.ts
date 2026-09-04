import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSplitCheckoutPreference } from '@/lib/mercado-pago';
import { platformFeePercent, computePlatformFee } from '@/lib/plans';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ token: z.string().min(1) });

/**
 * POST /api/public/pay
 * Inicia o pagamento de UM ORÇAMENTO pelo link público (Mercado Pago Split).
 * - O cliente clica em "Aprovar e pagar" na página /o/[token].
 * - Cobramos COMO o vendedor (access_token da conta conectada) e aplicamos a
 *   comissão do OrçaAI: 2% no plano Grátis, 0% no Pro/Business.
 * - Retorna { initPoint } → o navegador redireciona para o Checkout Pro.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: 'Modo demonstração: pagamento simulado no app.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });

  const supabase = createClient(url, anon);
  const token = parsed.data.token.trim();
  if (!/^[0-9a-f-]{36}$/i.test(token) && !/^[0-9a-f]{32}$/i.test(token.replace(/-/g, ''))) {
    return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('get_quote_payment_account', { p_token: token });
  if (error) {
    return NextResponse.json({ error: 'Configuração pendente (migração 0006).' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Orçamento não encontrado.' }, { status: 404 });

  const account = data as {
    access_token?: string | null;
    mp_user_id?: string | null;
    status?: string | null;
    plan?: string | null;
    quote_id?: string | null;
    total?: number | null;
    customer_name?: string | null;
    company_id?: string | null;
  };

  if (!account.access_token || account.status !== 'ativo') {
    return NextResponse.json(
      { error: 'O prestador ainda não conectou a conta para receber pagamentos pelo link. Peça para ele conectar o Mercado Pago (ou pagar por outro meio).' },
      { status: 402 },
    );
  }

  const planId = account.plan === 'business' || account.plan === 'pro' ? account.plan : 'free';
  const amount = Number(account.total ?? 0);
  if (amount <= 0) {
    return NextResponse.json({ error: 'Orçamento sem valor para pagamento.' }, { status: 400 });
  }
  const feePct = platformFeePercent(planId);
  const { fee, seller } = computePlatformFee(planId, amount);

  try {
    const pref = await createSplitCheckoutPreference({
      sellerAccessToken: account.access_token,
      sellerMpUserId: account.mp_user_id ?? '',
      companyId: account.company_id ?? '',
      quoteId: account.quote_id ?? '',
      quoteNumber: 0, // preenchido depois pelo webhook via quote_id
      customerName: account.customer_name ?? 'Cliente',
      amount,
      platformFee: fee,
    });

    // Guarda um pagamento "pendente" para o histórico e o webhook confirmar
    await supabase.from('quote_payments').insert({
      quote_id: account.quote_id,
      company_id: account.company_id,
      amount,
      platform_fee: fee,
      seller_receives: seller,
      status: 'pendente',
      provider: 'mercado_pago',
      provider_id: pref.id,
      payer_name: null,
    }).then(() => {}, () => {});

    return NextResponse.json({ initPoint: pref.initPoint });
  } catch (err) {
    return NextResponse.json(
      { error: `Não foi possível gerar o pagamento: ${err instanceof Error ? err.message : 'erro desconhecido'}` },
      { status: 500 },
    );
  }
}

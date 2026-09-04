import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase';
import { searchPaymentsByExternalReference } from '@/lib/mercado-pago';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/mp/sync
 * Reconcilia pagamentos de orçamento ainda PENDENTES: consulta o Mercado Pago
 * (com o token do VENDEDOR conectado) e aprova os que já foram pagos.
 * Usado como rede de segurança quando o auto_return/webhook atrasam.
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, approved: 0, demo: true });
  }
  const supabase = await createServerSupabase().catch(() => null);
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

  const { data: acc } = await supabase
    .from('payment_accounts')
    .select('access_token')
    .eq('company_id', company.id)
    .maybeSingle();
  if (!acc?.access_token) {
    return NextResponse.json({ ok: true, approved: 0, reason: 'Sem conta conectada.' });
  }

  const { data: pending } = await supabase
    .from('quote_payments')
    .select('id, quote_id, company_id, amount')
    .eq('company_id', company.id)
    .eq('status', 'pendente');

  let approved = 0;
  for (const qp of pending ?? []) {
    // Busca na API do MP pelo external_reference (quote:company:quote)
    const extRef = `quote:${qp.company_id}:${qp.quote_id}`;
    const results = await searchPaymentsByExternalReference(acc.access_token, extRef);
    const okPayment = (results ?? []).find((r) => r.status === 'approved');
    if (okPayment) {
      const { error } = await supabase.rpc('finalize_quote_payment', {
        p_company_id: qp.company_id,
        p_quote_id: qp.quote_id,
        p_provider_id: String(okPayment.id),
      });
      if (!error) approved += 1;
    }
  }

  return NextResponse.json({ ok: true, approved });
}

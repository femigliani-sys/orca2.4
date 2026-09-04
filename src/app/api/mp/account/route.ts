import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase';
import { PLANS } from '@/lib/plans';
import {
  getMarketplaceCredentials,
  buildSellerOAuthUrl,
  getOAuthRedirectUri,
} from '@/lib/mercado-pago';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/mp/account — estado da conta de pagamento do vendedor.
 * POST /api/mp/account { action:'connect'|'disconnect' } — conecta (gera URL OAuth)
 *   ou desconecta a conta Mercado Pago usada para receber pelo link.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ demo: true });
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
    .select('id, plan')
    .eq('owner_id', user.id)
    .single();
  if (!company) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });

  const { data: acc } = await supabase
    .from('payment_accounts')
    .select('*')
    .eq('company_id', company.id)
    .maybeSingle();

  const plan = PLANS.find((pl) => pl.id === company.plan);
  const { clientId, clientSecret } = getMarketplaceCredentials();

  let connectUrl: string | null = null;
  let warning: string | null = null;
  if (acc?.status === 'ativo') {
    connectUrl = null;
  } else if (!clientId || !clientSecret) {
    warning = 'Configure MERCADO_PAGO_MARKETPLACE_CLIENT_ID e MERCADO_PAGO_MARKETPLACE_CLIENT_SECRET para gerar o link de conexão do vendedor.';
  } else {
    // Gera a URL pela função central (redirect_uri sem barras duplicadas)
    connectUrl = buildSellerOAuthUrl(clientId, company.id);
  }

  return NextResponse.json({
    configured: Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN), // pagamentos de planos
    oauthClientConfigured: Boolean(clientId) && Boolean(clientSecret),
    accountConnected: Boolean(acc) && acc?.status === 'ativo',
    mpUserId: acc?.mp_user_id ?? null,
    feePercent: plan?.feePercent ?? 2,
    plan: company.plan,
    redirectUri: getOAuthRedirectUri(),
    connectUrl,
    warning,
  });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Indisponível no modo demonstração.' }, { status: 503 });
  }
  const supabase = await createServerSupabase().catch(() => null);
  if (!supabase) return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

  let body: { action?: string } = {};
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    /* ignore */
  }

  if (body.action === 'disconnect') {
    const { data: company } = await supabase.from('companies').select('id').eq('owner_id', user.id).single();
    if (company) {
      await supabase.from('payment_accounts').delete().eq('company_id', company.id);
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}

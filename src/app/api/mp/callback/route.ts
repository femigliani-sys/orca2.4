import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/mp/callback?code=...&state=companyId
 * Callback do OAuth do Mercado Pago (vendedor conectando a conta).
 * Troca o code por access_token do vendedor e salva no banco.
 * (Endpoints de OAuth usam client_secret da env MERCADO_PAGO_ACCESS_TOKEN
 *  + client id MERCADO_PAGO_MARKETPLACE_CLIENT_ID.)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // companyId
  const errorParam = url.searchParams.get('error');

  if (errorParam || !code || !state) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;display:grid;place-items:center;min-height:100vh">
        <div style="text-align:center"><h2>Não foi possível conectar o Mercado Pago</h2>
        <p>${errorParam ? 'Você cancelou a autorização.' : 'Parâmetros inválidos.'}</p>
        <a href="/app/configuracoes?tab=pagamentos">Voltar às configurações</a></div>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  const clientId = process.env.MERCADO_PAGO_MARKETPLACE_CLIENT_ID;
  const clientSecret = process.env.MERCADO_PAGO_ACCESS_TOKEN; // app secret do marketplace
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/mp/callback`;

  if (!clientId || !clientSecret) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;display:grid;place-items:center;min-height:100vh">
        <div style="text-align:center"><h2>Falta configuração</h2>
        <p>Defina MERCADO_PAGO_MARKETPLACE_CLIENT_ID e o secret da aplicação no ambiente.</p></div>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  let tokenData: { access_token?: string; refresh_token?: string; user_id?: number; expires_in?: number };
  try {
    const res = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    tokenData = (await res.json()) as typeof tokenData;
    if (!tokenData.access_token) throw new Error('Sem access_token na resposta do MP.');
  } catch (err) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;display:grid;place-items:center;min-height:100vh">
        <div style="text-align:center"><h2>Falha no OAuth</h2><p>${err instanceof Error ? err.message : 'Erro desconhecido'}</p>
        <a href="/app/configuracoes?tab=pagamentos">Voltar às configurações</a></div>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  }

  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  await supabase.from('payment_accounts').upsert(
    {
      company_id: state,
      provider: 'mercado_pago',
      mp_user_id: String(tokenData.user_id ?? ''),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      expires_at: new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString(),
      status: 'ativo',
      connected_at: now,
    },
    { onConflict: 'company_id' },
  );

  return new NextResponse(
    `<html><body style="font-family:sans-serif;display:grid;place-items:center;min-height:100vh;background:#f8fafc">
      <div style="text-align:center;background:#fff;padding:40px;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <div style="font-size:44px">✅</div>
        <h2 style="margin:12px 0 4px">Mercado Pago conectado!</h2>
        <p style="color:#475569">Sua conta agora pode receber pagamentos pelos links de orçamento.</p>
        <a href="/app/configuracoes?tab=pagamentos" style="display:inline-block;margin-top:16px;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600">Ir para as configurações</a>
      </div>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } },
  );
}

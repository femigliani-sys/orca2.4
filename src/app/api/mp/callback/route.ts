import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import {
  getMarketplaceCredentials,
  getOAuthRedirectUri,
  exchangeOAuthCodeForToken,
} from '@/lib/mercado-pago';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function html(title: string, msg: string, ok: boolean, detail?: string) {
  const esc = (v: string) =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return new NextResponse(
    `<html><body style="font-family:sans-serif;display:grid;place-items:center;min-height:100vh;background:#f8fafc;margin:0">
      <div style="text-align:center;background:#fff;padding:40px;border-radius:16px;box-shadow:0 1px 3px rgba(0,0,0,.1);max-width:520px;margin:16px">
        <div style="font-size:44px">${ok ? '✅' : '❌'}</div>
        <h2 style="margin:12px 0 4px;color:#0f172a">${esc(title)}</h2>
        <p style="color:#475569;font-size:14px">${esc(msg)}</p>
        ${detail ? `<pre style="text-align:left;background:#f1f5f9;padding:12px;border-radius:8px;font-size:11px;overflow:auto;color:#475569">${esc(detail)}</pre>` : ''}
        <a href="/app/configuracoes?tab=pagamentos" style="display:inline-block;margin-top:16px;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600">Voltar às configurações</a>
      </div>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } },
  );
}

/**
 * GET /api/mp/callback?code=...&state=companyId
 * Callback do OAuth do Mercado Pago (vendedor conectando a conta).
 *
 * Correções aplicadas:
 * - redirect_uri única vinda de getOAuthRedirectUri() (sem "//").
 * - usa MERCADO_PAGO_MARKETPLACE_CLIENT_SECRET (nunca o ACCESS_TOKEN do app).
 * - logs o status HTTP e o BODY reais do MP em qualquer falha.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // companyId
  const errorParam = url.searchParams.get('error');

  // O MP manda error apenas em alguns fluxos; trata junto com a ausência de code
  if (errorParam) {
    console.warn('[mp-callback] erro retornado pelo MP:', errorParam);
    return html('Autorização não concluída', 'O Mercado Pago retornou um erro ou a autorização foi cancelada.', false, errorParam);
  }
  if (!code || !state) {
    return html('Link inválido', 'Parâmetros ausentes no retorno do Mercado Pago.', false, `code=${code ? 'ok' : 'ausente'} state=${state ? 'ok' : 'ausente'}`);
  }

  const { clientId, clientSecret } = getMarketplaceCredentials();
  if (!clientId || !clientSecret) {
    console.error('[mp-callback] credenciais do marketplace ausentes.');
    return html(
      'Falta configuração',
      'Defina MERCADO_PAGO_MARKETPLACE_CLIENT_ID e MERCADO_PAGO_MARKETPLACE_CLIENT_SECRET no ambiente e faça redeploy.',
      false,
    );
  }

  // Garante que a redirect_uri bate com a usada na autorização e no cadastro do MP
  const redirectUri = getOAuthRedirectUri();
  console.log('[mp-callback] recebido code, state=', state, 'redirect_uri=', redirectUri);

  const result = await exchangeOAuthCodeForToken(code);

  if (!result.ok) {
    // log completo (já feito dentro do helper) e mostra na tela o erro real
    console.error('[mp-callback] falha na troca do code:', result.message);
    return html(
      'Falha na conexão',
      result.message ?? 'Não foi possível obter o token de acesso.',
      false,
      `status: ${result.status ?? '—'}\nbody: ${result.body ?? ''}\nredirect_uri: ${redirectUri}`,
    );
  }

  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  const expiresAt = result.expiresIn
    ? new Date(Date.now() + result.expiresIn * 1000).toISOString()
    : new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

  const { error: upsertError } = await supabase.from('payment_accounts').upsert(
    {
      company_id: state,
      provider: 'mercado_pago',
      mp_user_id: result.userId ?? '',
      access_token: result.accessToken ?? '',
      refresh_token: result.refreshToken ?? null,
      expires_at: expiresAt,
      status: 'ativo',
      connected_at: now,
    },
    { onConflict: 'company_id' },
  );

  if (upsertError) {
    console.error('[mp-callback] falha ao salvar conta:', upsertError.message);
    return html(
      'Erro ao salvar a conta',
      'O token foi obtido, mas não foi possível salvar a conta. Entre em contato com o suporte.',
      false,
      upsertError.message,
    );
  }

  console.log('[mp-callback] conta conectada com sucesso para company:', state, 'mp_user_id:', result.userId);
  return html(
    'Mercado Pago conectado!',
    'Sua conta agora pode receber pagamentos pelos links de orçamento.',
    true,
  );
}

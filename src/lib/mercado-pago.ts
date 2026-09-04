/**
 * Integração Mercado Pago (Checkout Pro / Preferências).
 * Executada APENAS no servidor — o access token nunca chega ao navegador.
 * No modo demonstração (sem chave) o checkout é simulado na interface.
 */
import type { PlanId } from './types';
import { getPlan, planPriceCents } from './plans';
import { getSiteUrl } from './site-url';

const API = 'https://api.mercadopago.com';

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN);
}

export interface CheckoutPreference {
  id: string;
  initPoint: string;
  sandboxInitPoint: string;
}

/**
 * Cria uma preferência de pagamento (Checkout Pro).
 * `external_reference` carrega "companyId:plan" para identificarmos no webhook.
 */
export async function createCheckoutPreference(input: {
  plan: PlanId;
  companyId: string;
  email?: string;
}): Promise<CheckoutPreference> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error('Mercado Pago não configurado no servidor.');

  const plan = getPlan(input.plan);
  const res = await fetch(`${API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [
        {
          title: `OrçaAI — Plano ${plan.name} (assinatura mensal)`,
          quantity: 1,
          unit_price: planPriceCents(plan),
          currency_id: 'BRL',
        },
      ],
      payer: input.email ? { email: input.email } : undefined,
      back_urls: {
        success: `${getSiteUrl()}/app/planos?status=success`,
        pending: `${getSiteUrl()}/app/planos?status=pending`,
        failure: `${getSiteUrl()}/app/planos?status=failure`,
      },
      auto_return: 'approved',
      notification_url: `${getSiteUrl()}/api/billing/webhook`,
      external_reference: `${input.companyId}:${input.plan}`,
      metadata: { company_id: input.companyId, plan: input.plan, app: 'orcaai' },
      statement_descriptor: 'ORCAAI',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Falha ao criar o pagamento (${res.status}). ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    id: string;
    init_point: string;
    sandbox_init_point: string;
  };
  return {
    id: data.id,
    initPoint: data.init_point,
    sandboxInitPoint: data.sandbox_init_point,
  };
}

export interface MpPayment {
  id: string;
  status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'refunded';
  status_detail: string;
  external_reference: string | null;
  transaction_amount?: number | null;
  payer?: { email?: string | null; first_name?: string | null } | null;
}

/** Busca um pagamento pela API (usado no webhook para validar e conferir status). */
export async function getPayment(paymentId: string): Promise<MpPayment | null> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(`${API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as MpPayment;
  return data;
}

// ---------------------------------------------------------------- Assinatura

export interface Preapproval {
  id: string;
  status: string;
  init_point: string | null;
  external_reference: string | null;
}

/**
 * Cria uma ASSINATURA recorrente (preapproval) no Mercado Pago.
 * Cobra automaticamente a cada mês — é o fluxo certo para SaaS.
 */
export async function createPreapproval(input: {
  plan: PlanId;
  companyId: string;
  email?: string;
}): Promise<Preapproval> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) throw new Error('Mercado Pago não configurado no servidor.');

  const plan = getPlan(input.plan);
  const res = await fetch(`${API}/preapproval`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reason: `OrçaAI — Plano ${plan.name} (assinatura mensal)`,
      external_reference: `${input.companyId}:${input.plan}`,
      payer_email: input.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: planPriceCents(plan),
        currency_id: 'BRL',
      },
      back_url: `${getSiteUrl()}/app/planos?status=success`,
      notification_url: `${getSiteUrl()}/api/billing/webhook`,
      metadata: { company_id: input.companyId, plan: input.plan, app: 'orcaai' },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Falha ao criar a assinatura (${res.status}). ${text.slice(0, 200)}`);
  }

  return (await res.json()) as Preapproval;
}

/** Cancela uma assinatura (preapproval) — para quando o usuário cancela o plano. */
export async function cancelPreapproval(preapprovalId: string): Promise<void> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) return;
  await fetch(`${API}/preapproval/${preapprovalId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'cancelled' }),
  });
}

/** Busca uma assinatura (preapproval) — usado no webhook. */
export async function getPreapproval(preapprovalId: string): Promise<Preapproval | null> {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(`${API}/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as Preapproval;
}

// ---------------------------------------------------------------- Split / Marketplace
// Pagamento de orçamento COMO o vendedor (conta conectada via OAuth), com
// comissão do OrçaAI (platform_fee). Requer aplicação marketplace habilitada
// pelo Mercado Pago (Settings → "Cobrar por outros vendedores" / Marketplace).

export interface SplitPreference {
  id: string;
  initPoint: string;
}

/**
 * Cria a preferência de pagamento de um ORÇAMENTO usando o token do VENDEDOR.
 * - Authorization: token do vendedor (conectado via OAuth).
 * - platform_fee: comissão do OrçaAI em centavos (2% free; 0 pago).
 * - marketplace: user_id do vendedor (divisão/split do pagamento).
 */
export async function createSplitCheckoutPreference(input: {
  sellerAccessToken: string;
  sellerMpUserId: string;
  companyId: string;
  quoteId: string;
  quoteNumber: number;
  customerName: string;
  amount: number; // R$
  platformFee: number; // R$
}): Promise<SplitPreference> {
  const res = await fetch(`${API}/checkout/preferences`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.sellerAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [
        {
          title: `Orçamento ${'#' + String(input.quoteNumber).padStart(4, '0')} — ${input.customerName}`,
          quantity: 1,
          unit_price: Math.round(input.amount * 100),
          currency_id: 'BRL',
        },
      ],
      marketplace: input.sellerMpUserId, // divide o pagamento para o vendedor
      platform_fee: Math.round(input.platformFee * 100), // comissão do OrçaAI
      external_reference: `quote:${input.companyId}:${input.quoteId}`,
      notification_url: `${getSiteUrl()}/api/billing/webhook`,
      back_urls: {
        success: `${getSiteUrl()}/o/pago?ok=1`,
        pending: `${getSiteUrl()}/o/pago?ok=0`,
        failure: `${getSiteUrl()}/o/pago?ok=0`,
      },
      auto_return: 'approved',
      statement_descriptor: 'ORCAAI',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Falha ao gerar o pagamento (${res.status}). ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id: string; init_point: string };
  return { id: data.id, initPoint: data.init_point };
}

// ================================================================
// OAuth do VENDEDOR (Marketplace) — helpers centralizados
// ================================================================

/** credenciais da aplicação MARKETPLACE (nunca a conta dona do app). */
export function getMarketplaceCredentials(): {
  clientId: string | null;
  clientSecret: string | null;
} {
  return {
    clientId: process.env.MERCADO_PAGO_MARKETPLACE_CLIENT_ID?.trim() || null,
    clientSecret: process.env.MERCADO_PAGO_MARKETPLACE_CLIENT_SECRET?.trim() || null,
  };
}

/** ÚNICA fonte da redirect_uri do OAuth (sem barras duplicadas). */
export function getOAuthRedirectUri(): string {
  return `${getSiteUrl()}/api/mp/callback`; // getSiteUrl já remove '/' do final
}

/**
 * Monta a URL de autorização (tela do Mercado Pago onde o vendedor aprova).
 */
export function buildSellerOAuthUrl(clientId: string, state: string): string {
  const redirect = encodeURIComponent(getOAuthRedirectUri());
  return (
    `https://auth.mercadopago.com.br/authorization` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code` +
    `&platform_id=mp` +
    `&redirect_uri=${redirect}` +
    `&state=${encodeURIComponent(state)}`
  );
}

export interface OAuthTokenResult {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
  expiresIn?: number;
  status?: number;
  body?: string;
  message?: string;
}

/**
 * Troca o `code` do OAuth pelo access_token do vendedor.
 * Usa MERCADO_PAGO_MARKETPLACE_CLIENT_ID + _SECRET (nunca o token do dono).
 * Em caso de erro, retorna status HTTP e o corpo REAL da API do Mercado Pago.
 */
export async function exchangeOAuthCodeForToken(code: string): Promise<OAuthTokenResult> {
  const { clientId, clientSecret } = getMarketplaceCredentials();
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      message:
        'Faltam as variáveis MERCADO_PAGO_MARKETPLACE_CLIENT_ID e MERCADO_PAGO_MARKETPLACE_CLIENT_SECRET.',
    };
  }

  const redirectUri = getOAuthRedirectUri();
  const body = {
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  };

  let res: Response;
  try {
    res = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, message: `Erro de rede ao chamar o MP: ${err instanceof Error ? err.message : String(err)}` };
  }

  const raw = await res.text(); // captura o corpo REAL
  let json: Record<string, unknown> | null = null;
  try {
    json = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }

  console.log('[mp-oauth] POST /oauth/token status=', res.status, 'body=', raw.slice(0, 600));

  if (!res.ok) {
    const apiMessage = (json as { message?: string } | null)?.message
      ?? (json as { error_description?: string } | null)?.error_description
      ?? (json as { error?: string } | null)?.error
      ?? raw.slice(0, 300);
    return { ok: false, status: res.status, body: raw, message: `Mercado Pago respondeu ${res.status}: ${apiMessage}` };
  }
  if (!json || typeof json.access_token !== 'string') {
    return {
      ok: false,
      status: res.status,
      body: raw,
      message: `Resposta inesperada do MP (sem access_token). Status ${res.status}: ${raw.slice(0, 300)}`,
    };
  }

  return {
    ok: true,
    accessToken: json.access_token as string,
    refreshToken: typeof json.refresh_token === 'string' ? (json.refresh_token as string) : undefined,
    userId: json.user_id != null ? String(json.user_id) : undefined,
    expiresIn: typeof json.expires_in === 'number' ? (json.expires_in as number) : undefined,
  };
}

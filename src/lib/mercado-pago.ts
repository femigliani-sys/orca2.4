/**
 * Integração Mercado Pago (Checkout Pro / Preferências).
 * Executada APENAS no servidor — o access token nunca chega ao navegador.
 * No modo demonstração (sem chave) o checkout é simulado na interface.
 */
import type { PlanId } from './types';
import { getPlan, planPriceCents } from './plans';

const API = 'https://api.mercadopago.com';

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN);
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
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
        success: `${siteUrl()}/app/planos?status=success`,
        pending: `${siteUrl()}/app/planos?status=pending`,
        failure: `${siteUrl()}/app/planos?status=failure`,
      },
      auto_return: 'approved',
      notification_url: `${siteUrl()}/api/billing/webhook`,
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

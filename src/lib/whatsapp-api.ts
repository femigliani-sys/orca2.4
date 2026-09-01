/**
 * WhatsApp Business API — Meta Cloud API (server-side).
 * O token de acesso NUNCA chega ao navegador: o frontend chama a API route
 * /api/whatsapp/send, que faz a chamada para o Graph API da Meta.
 *
 * Env vars necessárias (painel da Vercel / .env.local):
 *   WHATSAPP_ACCESS_TOKEN        → token do WhatsApp Business (Meta)
 *   WHATSAPP_PHONE_NUMBER_ID     → ID do número de telefone (Meta)
 *   WHATSAPP_WEBHOOK_VERIFY_TOKEN → token de verificação do webhook (qualquer string sua)
 */
import { getSiteUrl } from './site-url';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
}

export function getWhatsAppVerifyToken(): string {
  return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? '';
}

export function isWhatsAppWebhookConfigured(): boolean {
  return getWhatsAppVerifyToken().length > 0;
}

/** URL do webhook para configurar no painel da Meta. */
export function getWhatsAppWebhookUrl(): string {
  const base = getSiteUrl();
  return `${base}/api/whatsapp/webhook`;
}

export function normalizeWaNumber(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.startsWith('55')) return digits;
  return `55${digits}`;
}

export interface WaSendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

/** Envia uma mensagem de texto via WhatsApp Cloud API. */
export async function sendWhatsAppText(to: string, body: string): Promise<WaSendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { ok: false, error: 'WhatsApp Business API não configurada no servidor.' };
  }

  const wa = normalizeWaNumber(to);
  if (!wa) return { ok: false, error: 'Número de telefone inválido.' };

  try {
    const res = await fetch(`${GRAPH_BASE}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: wa,
        type: 'text',
        text: { body },
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      messages?: { id?: string }[];
      error?: { message?: string; type?: string; code?: number };
    };

    if (!res.ok) {
      const msg = json.error?.message || `Erro ${res.status} ao enviar no WhatsApp.`;
      return { ok: false, error: msg };
    }

    return { ok: true, messageId: json.messages?.[0]?.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha de rede ao enviar.' };
  }
}

export interface WaConfigStatus {
  configured: boolean;
  webhookConfigured: boolean;
  phoneNumberId: string | null;
  webhookUrl: string;
  demo: boolean;
  guide: string;
}

/** Status da configuração (SEM expor o token). */
export function getWhatsAppConfigStatus(): WaConfigStatus {
  return {
    configured: isWhatsAppConfigured(),
    webhookConfigured: isWhatsAppWebhookConfigured(),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? null,
    webhookUrl: getWhatsAppWebhookUrl(),
    demo: false,
    guide:
      '1) Crie um app no Meta for Developers e conecte um WhatsApp Business.\n' +
      '2) Copie o Token de Acesso e o ID do Número de Telefone.\n' +
      '3) Adicione as variáveis WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID no ambiente.\n' +
      '4) No painel da Meta, configure o webhook para a URL abaixo com o verify token escolhido.',
  };
}

import { phoneToWa } from './utils';

/** Monta link de compartilhamento do WhatsApp (wa.me). */
export function buildWaLink(phone: string, text: string): string {
  const wa = phoneToWa(phone);
  if (!wa) return '';
  return `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
}

export function buildWaShare(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export interface WaSendOutcome {
  method: 'api' | 'link' | 'error';
  ok: boolean;
  error?: string;
  messageId?: string;
}

/**
 * Tenta enviar pela WhatsApp Business API (se configurada no servidor).
 * Se a API não estiver disponível, devolve { method: 'link' } para o chamador
 * abrir o wa.me (comportamento de fallback atual).
 */
export async function sendViaWhatsAppApi(phone: string, body: string): Promise<WaSendOutcome> {
  try {
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, body }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      messageId?: string;
    };

    if (res.status === 503) {
      // API não configurada → usar link wa.me
      return { method: 'link', ok: true };
    }
    if (!res.ok || !json.ok) {
      // Erro da API (ex.: número fora do WhatsApp, janela de 24h) → link como fallback
      return { method: 'link', ok: true, error: json.error };
    }
    return { method: 'api', ok: true, messageId: json.messageId };
  } catch {
    // Falha de rede → link
    return { method: 'link', ok: true };
  }
}

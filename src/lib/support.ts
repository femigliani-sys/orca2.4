/**
 * Configuração da aba Suporte (centralizada).
 * Para apontar para o seu e-mail/WhatsApp/URL de suporte, defina no ambiente:
 *   NEXT_PUBLIC_SUPPORT_EMAIL   → e-mail de contato (padrão: suporte@orcaai.com.br)
 *   NEXT_PUBLIC_SUPPORT_WHATSAPP→ número com DDD para WhatsApp (opcional)
 *   NEXT_PUBLIC_SUPPORT_URL     → URL externa da central de suporte (opcional;
 *                                 se definida, aparece um botão "Abrir central")
 */
export interface SupportConfig {
  email: string;
  whatsapp: string;
  url: string;
}

export function getSupportConfig(): SupportConfig {
  const email =
    (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'suporte@orcaai.com.br').trim() || 'suporte@orcaai.com.br';
  const whatsapp = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '').trim();
  const url = (process.env.NEXT_PUBLIC_SUPPORT_URL ?? '').trim();
  return { email, whatsapp, url };
}

/** Abre o cliente de e-mail com assunto e mensagem prontos. */
export function buildSupportMailto(subject: string, body: string, email = getSupportConfig().email): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Monta link de WhatsApp com mensagem pronta. */
export function buildSupportWhatsApp(body: string, whatsapp = getSupportConfig().whatsapp): string {
  const digits = whatsapp.replace(/\D/g, '');
  if (!digits) return '';
  const wa = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${wa}?text=${encodeURIComponent(body)}`;
}

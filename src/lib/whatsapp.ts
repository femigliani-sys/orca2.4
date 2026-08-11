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

import type { Company, Quote } from '../types';
import { DEFAULT_QUOTE_MESSAGE } from '../defaults';
import { formatCurrency } from '../utils';

/** Bloco de itens formatado para WhatsApp ("• Nome — R$ X"). */
export function itemsBlock(quote: Pick<Quote, 'items'>): string {
  return (quote.items ?? [])
    .map((it) => {
      const lineTotal = (it.quantity || 1) * (it.price || 0);
      const qty = (it.quantity || 1) !== 1 ? ` (${it.quantity} × ${formatCurrency(it.price)})` : '';
      return `• ${it.name}${qty} — ${formatCurrency(lineTotal)}`;
    })
    .join('\n');
}

/**
 * Monta a mensagem pronta para envio.
 * O template vem das configurações da empresa (campo "mensagem padrão"),
 * com suporte a placeholders: {{customer}} {{items}} {{total}} {{validity}} {{company}}.
 */
export function buildQuoteMessage(quote: Pick<Quote, 'items' | 'total' | 'validityDays' | 'customerName'>, company: Pick<Company, 'name' | 'settings'>, customerName?: string): string {
  const customer = customerName || quote.customerName || 'cliente';
  const template = company.settings.defaultMessage?.trim() || DEFAULT_QUOTE_MESSAGE;
  return template
    .replaceAll('{{customer}}', customer)
    .replaceAll('{{items}}', itemsBlock(quote))
    .replaceAll('{{total}}', formatCurrency(quote.total))
    .replaceAll('{{validity}}', String(quote.validityDays))
    .replaceAll('{{company}}', company.name)
    .trim();
}

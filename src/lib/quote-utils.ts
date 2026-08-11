import type { Company, Quote, QuoteInput, QuoteItem, QuoteStatus } from './types';
import { FOLLOW_UP_DAYS } from './constants';
import { addDaysIso, generateId, nowIso, round2 } from './utils';
import { DEFAULT_TERMS } from './defaults';

export function computeTotals(items: QuoteItem[], discount: number) {
  const subtotal = round2(items.reduce((acc, it) => acc + it.quantity * it.price, 0));
  const total = round2(Math.max(0, subtotal - (discount || 0)));
  return { subtotal, total };
}

/** Monta uma Quote a partir do input, com numeração, totais e validade calculados. */
export function buildQuote(input: QuoteInput, company: Company, number?: number): Quote {
  const { subtotal, total } = computeTotals(input.items, input.discount);
  const validityDays = input.validityDays > 0 ? input.validityDays : company.settings.quoteValidityDays || 7;
  const now = nowIso();
  const qty = number ?? company.quoteCounter + 1;

  return {
    id: generateId(),
    companyId: company.id,
    number: qty,
    customerId: input.customerId ?? null,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail,
    status: input.status,
    items: input.items,
    subtotal,
    discount: round2(input.discount || 0),
    total,
    validityDays,
    validUntil: addDaysIso(validityDays),
    notes: input.notes,
    terms: input.terms || company.settings.terms || DEFAULT_TERMS,
    sourceMessage: input.sourceMessage,
    createdAt: now,
    updatedAt: now,
    viewedAt: null,
    approvedAt: null,
  };
}

/** Data sugerida para o follow-up após envio. */
export function suggestedFollowUpDate(): string {
  return addDaysIso(FOLLOW_UP_DAYS);
}

export function isQuoteExpired(quote: Quote): boolean {
  if (!quote.validUntil) return false;
  return new Date(quote.validUntil).getTime() < Date.now();
}

const PENDING_STATUSES: QuoteStatus[] = ['rascunho', 'enviado', 'visualizado', 'negociacao'];

export function isPendingQuote(quote: Quote): boolean {
  return PENDING_STATUSES.includes(quote.status) && !isQuoteExpired(quote);
}

/** Calcula o status "efetivo" considerando a expiração (exibição apenas). */
export function effectiveStatus(quote: Quote): QuoteStatus {
  if (isQuoteExpired(quote) && PENDING_STATUSES.includes(quote.status)) return 'expirado';
  return quote.status;
}

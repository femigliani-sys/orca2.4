'use client';

import { useMemo, useState } from 'react';
import {
  Download,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  CalendarDays,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/ui/logo';
import { formatCurrency, formatDateFull, quoteNumberLabel, cn } from '@/lib/utils';
import { downloadQuotePdf } from '@/lib/pdf';
import { buildWaLink } from '@/lib/whatsapp';
import { effectiveStatus } from '@/lib/quote-utils';
import type { Company, Quote } from '@/lib/types';

interface PublicQuoteData {
  quote: Quote;
  company: Company;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'bg-ink-100 text-ink-600' },
  enviado: { label: 'Enviado', cls: 'bg-blue-50 text-blue-700' },
  visualizado: { label: 'Visualizado', cls: 'bg-sky-50 text-sky-700' },
  negociacao: { label: 'Em negociação', cls: 'bg-amber-50 text-amber-700' },
  aprovado: { label: 'Aprovado ✓', cls: 'bg-emerald-50 text-emerald-700' },
  recusado: { label: 'Recusado', cls: 'bg-rose-50 text-rose-700' },
  expirado: { label: 'Expirado', cls: 'bg-ink-100 text-ink-500' },
};

/** Visualização pública do orçamento (link compartilhado). */
export function PublicQuoteView({ quote, company, onApproved }: PublicQuoteData & { onApproved?: () => void }) {
  const [approving, setApproving] = useState(false);
  const status = effectiveStatus(quote);
  const expired = status === 'expirado';
  const canApprove = ['enviado', 'visualizado', 'negociacao'].includes(status);
  const s = STATUS_LABEL[status] ?? STATUS_LABEL.enviado;

  const waPhone = company.whatsapp || company.phone || '';
  const waText = `Olá! Vim do orçamento ${quoteNumberLabel(quote.number)} da ${company.name}.`;
  const waLink = waPhone ? buildWaLink(waPhone, waText) : '';

  function handleApprove() {
    setApproving(true);
    onApproved?.();
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3">
        {company.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logoUrl} alt={company.name} className="h-12 w-12 rounded-xl border border-ink-200 object-contain bg-white p-1" />
        ) : (
          <Logo />
        )}
        <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', s.cls)}>{s.label}</span>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-card">
        {/* Meta */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-ink-50/50 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-400">Orçamento</p>
            <p className="text-lg font-bold text-ink-950">{quoteNumberLabel(quote.number)}</p>
          </div>
          <div className="text-right text-xs text-ink-500">
            <p>Emitido em {formatDateFull(quote.createdAt)}</p>
            <p className="mt-0.5 flex items-center justify-end gap-1">
              <CalendarDays className="size-3.5" />
              Válido até {formatDateFull(quote.validUntil)} ({quote.validityDays} dias)
            </p>
          </div>
        </div>

        {/* Cliente */}
        <div className="border-b border-ink-100 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Cliente</p>
          <p className="mt-1 text-sm font-medium text-ink-900">{quote.customerName}</p>
        </div>

        {/* Itens */}
        <div className="px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Serviços</p>
          <div className="mt-2 divide-y divide-ink-100 rounded-xl border border-ink-100">
            {(quote.items ?? []).map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink-900">{it.name}</p>
                  <p className="text-xs text-ink-400">
                    {it.quantity} × {it.unit} · {formatCurrency(it.price)}
                    {it.observations ? ` · ${it.observations}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-ink-900">{formatCurrency(it.quantity * it.price)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-ink-500">
              <span>Subtotal</span>
              <span>{formatCurrency(quote.subtotal)}</span>
            </div>
            {quote.discount > 0 && (
              <div className="flex justify-between text-ink-500">
                <span>Desconto</span>
                <span className="text-rose-600">- {formatCurrency(quote.discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-ink-100 pt-2">
              <span className="font-semibold text-ink-900">Total</span>
              <span className="text-2xl font-bold text-ink-950">{formatCurrency(quote.total)}</span>
            </div>
          </div>
        </div>

        {/* Observações e termos */}
        {(quote.notes || quote.terms) && (
          <div className="border-t border-ink-100 bg-ink-50/40 px-6 py-4 text-xs text-ink-500">
            {quote.notes && (
              <p className="whitespace-pre-line">
                <span className="font-semibold text-ink-700">Observações: </span>
                {quote.notes}
              </p>
            )}
            {quote.terms && <p className="mt-2 whitespace-pre-line text-ink-400">{quote.terms}</p>}
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-col gap-2 border-t border-ink-100 bg-white px-6 py-4 sm:flex-row">
          {canApprove && !expired && (
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" loading={approving} onClick={handleApprove}>
              <CheckCircle2 className="size-4" /> Aprovar orçamento
            </Button>
          )}
          {status === 'aprovado' && (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="size-5" /> Orçamento aprovado!
            </div>
          )}
          {waLink && (
            <Button asChild variant="whatsapp" className="flex-1">
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" /> Falar com {company.name.split(' ')[0]}
              </a>
            </Button>
          )}
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => downloadQuotePdf(company, quote)}
          >
            <Download className="size-4" /> Baixar PDF
          </Button>
        </div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-400">
        <ShieldCheck className="size-3.5 text-emerald-500" />
        Documento gerado com segurança pelo OrçaAI · {company.name}
      </p>
      {quote.viewedAt && (
        <p className="mt-1 flex items-center justify-center gap-1 text-center text-[11px] text-ink-300">
          <Eye className="size-3" /> Visualizado em {formatDateFull(quote.viewedAt)}
        </p>
      )}
    </div>
  );
}

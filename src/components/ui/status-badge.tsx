import type { QuoteStatus } from '@/lib/types';
import { QUOTE_STATUS_MAP } from '@/lib/constants';
import { effectiveStatus } from '@/lib/quote-utils';
import type { Quote } from '@/lib/types';
import { Badge } from './badge';
import { cn } from '@/lib/utils';

const VARIANT_MAP: Record<QuoteStatus, 'secondary' | 'info' | 'warning' | 'success' | 'danger' | 'default'> = {
  rascunho: 'secondary',
  enviado: 'info',
  visualizado: 'default',
  negociacao: 'warning',
  aprovado: 'success',
  recusado: 'danger',
  expirado: 'secondary',
};

export function StatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  const s = QUOTE_STATUS_MAP[status];
  return (
    <Badge variant={VARIANT_MAP[status]} className={cn('whitespace-nowrap', className)}>
      {s.label}
    </Badge>
  );
}

export function QuoteStatusBadge({ quote, className }: { quote: Quote; className?: string }) {
  return <StatusBadge status={effectiveStatus(quote)} className={className} />;
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { KanbanSquare, Plus } from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { QuoteStatusBadge } from '@/components/ui/status-badge';
import { db } from '@/lib/db';
import { cn, formatCurrency, formatShortDate, quoteNumberLabel } from '@/lib/utils';
import { PIPELINE_STAGES } from '@/lib/constants';
import { effectiveStatus } from '@/lib/quote-utils';
import type { Quote } from '@/lib/types';

export default function PipelinePage() {
  const { quotes, loading, refresh } = useData();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const stages = useMemo(() => {
    return PIPELINE_STAGES.map((stage) => ({
      ...stage,
      quotes: quotes.filter((q) => stage.statuses.includes(effectiveStatus(q))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    }));
  }, [quotes]);

  async function handleDrop(stageId: string) {
    if (!dragId) return;
    const stage = PIPELINE_STAGES.find((s) => s.id === stageId);
    const quote = quotes.find((q) => q.id === dragId);
    if (!stage || !quote) return;
    const targetStatus = stage.statuses[0];
    if (effectiveStatus(quote) === targetStatus) return;
    try {
      await db.updateQuoteStatus(quote.id, targetStatus);
      refresh();
      toast.success(`Orçamento ${quoteNumberLabel(quote.number)} movido para "${stage.label}".`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível mover.');
    }
    setDragId(null);
    setOverStage(null);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-[420px] rounded-xl" />
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Pipeline de vendas"
          description="Arraste seus orçamentos entre as etapas e veja sua venda avançar."
          actions={
            <Link href="/app/orcamentos/novo">
              <Button><Plus className="size-4" /> Novo orçamento</Button>
            </Link>
          }
        />
        <EmptyState
          icon={KanbanSquare}
          title="Pipeline vazio"
          description={'Crie um orçamento e ele aparecerá na coluna "Novo".'}
          action={
            <Link href="/app/orcamentos/novo">
              <Button><Plus className="size-4" /> Criar orçamento</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline de vendas"
        description="Arraste os cards entre as colunas para atualizar o status."
        actions={
          <Link href="/app/orcamentos/novo">
            <Button><Plus className="size-4" /> Novo orçamento</Button>
          </Link>
        }
      />

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {stages.map((stage) => (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(stage.id);
            }}
            onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
            onDrop={() => handleDrop(stage.id)}
            className={cn(
              'flex min-h-[420px] w-72 shrink-0 flex-col rounded-xl border bg-ink-100/50 transition-colors',
              overStage === stage.id ? 'border-brand-400 bg-brand-50/50' : 'border-ink-200/70',
            )}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">{stage.label}</p>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-500 shadow-sm">
                {stage.quotes.length}
              </span>
            </div>
            <div className="flex-1 space-y-2.5 px-3 pb-3">
              {stage.quotes.length === 0 && (
                <div className="grid h-24 place-items-center rounded-lg border border-dashed border-ink-200 text-xs text-ink-300">
                  Arraste orçamentos para cá
                </div>
              )}
              {stage.quotes.map((q: Quote) => (
                <div
                  key={q.id}
                  draggable
                  onDragStart={() => setDragId(q.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverStage(null);
                  }}
                  className={cn(
                    'cursor-grab rounded-xl border border-ink-200/70 bg-white p-3 shadow-card transition-shadow active:cursor-grabbing',
                    dragId === q.id && 'opacity-50',
                  )}
                >
                  <Link href={`/app/orcamentos/${q.id}`} onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink-900">{q.customerName}</p>
                      <span className="font-mono text-[11px] text-ink-400">{quoteNumberLabel(q.number)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-400">
                      {q.items?.[0]?.name}
                      {q.items.length > 1 ? ` +${q.items.length - 1}` : ''}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="text-sm font-bold text-ink-950">{formatCurrency(q.total)}</span>
                      <span className="text-[11px] text-ink-400">{formatShortDate(q.createdAt)}</span>
                    </div>
                    <div className="mt-2">
                      <QuoteStatusBadge quote={q} />
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-400">
        💡 Dica: arraste o card para a coluna "Aprovado" para marcar a venda como fechada.
      </p>
    </div>
  );
}

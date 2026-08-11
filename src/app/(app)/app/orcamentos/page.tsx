'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText, Filter } from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QuoteStatusBadge } from '@/components/ui/status-badge';
import { formatCurrency, quoteNumberLabel, formatDate } from '@/lib/utils';
import { effectiveStatus } from '@/lib/quote-utils';
import type { QuoteStatus } from '@/lib/types';

const FILTERS: { value: QuoteStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'visualizado', label: 'Visualizado' },
  { value: 'negociacao', label: 'Em negociação' },
  { value: 'aprovado', label: 'Aprovado' },
  { value: 'recusado', label: 'Recusado' },
  { value: 'expirado', label: 'Expirado' },
];

export default function QuotesPage() {
  const { quotes, loading } = useData();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<QuoteStatus | 'todos'>('todos');

  const filtered = useMemo(() => {
    return quotes.filter((q) => {
      const matchesSearch =
        !search ||
        q.customerName.toLowerCase().includes(search.toLowerCase()) ||
        quoteNumberLabel(q.number).includes(search) ||
        q.items.some((it) => it.name.toLowerCase().includes(search.toLowerCase()));
      const matchesFilter = filter === 'todos' || effectiveStatus(q) === filter;
      return matchesSearch && matchesFilter;
    });
  }, [quotes, search, filter]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orçamentos"
        description="Acompanhe e gerencie todos os seus orçamentos."
        actions={
          <Link href="/app/orcamentos/novo">
            <Button>
              <Plus className="size-4" /> Novo orçamento
            </Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
          <Input
            placeholder="Buscar por cliente, número ou serviço…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="hidden size-4 text-ink-400 sm:block" />
          <Select value={filter} onValueChange={(v) => setFilter(v as QuoteStatus | 'todos')}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum orçamento ainda"
          description="Crie seu primeiro orçamento com a ajuda da IA — cole a mensagem do cliente e pronto."
          action={
            <Link href="/app/orcamentos/novo">
              <Button>
                <Plus className="size-4" /> Criar orçamento
              </Button>
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Nada encontrado" description="Tente ajustar a busca ou o filtro." />
      ) : (
        <>
          {/* Tabela (desktop) */}
          <Card className="hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviços</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-sm font-medium text-ink-700">{quoteNumberLabel(q.number)}</TableCell>
                    <TableCell>
                      <Link href={`/app/orcamentos/${q.id}`} className="font-medium text-ink-900 hover:text-brand-600">
                        {q.customerName}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <p className="truncate text-ink-500">
                        {q.items?.[0]?.name}
                        {q.items.length > 1 ? ` +${q.items.length - 1} item(ns)` : ''}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-ink-900">{formatCurrency(q.total)}</TableCell>
                    <TableCell className="text-ink-500">
                      {effectiveStatus(q) === 'expirado' ? (
                        <span className="text-ink-400">Expirado em {formatDate(q.validUntil)}</span>
                      ) : (
                        formatDate(q.validUntil)
                      )}
                    </TableCell>
                    <TableCell>
                      <QuoteStatusBadge quote={q} />
                    </TableCell>
                    <TableCell className="text-ink-500">{formatDate(q.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Cards (mobile) */}
          <div className="grid gap-3 md:hidden">
            {filtered.map((q) => (
              <Link key={q.id} href={`/app/orcamentos/${q.id}`}>
                <Card className="transition-shadow hover:shadow-card-hover">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium text-ink-700">{quoteNumberLabel(q.number)}</span>
                      <QuoteStatusBadge quote={q} />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-ink-900">{q.customerName}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-400">
                      {q.items?.[0]?.name}
                      {q.items.length > 1 ? ` +${q.items.length - 1} item(ns)` : ''}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-base font-bold text-ink-950">{formatCurrency(q.total)}</span>
                      <span className="text-xs text-ink-400">{formatDate(q.createdAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

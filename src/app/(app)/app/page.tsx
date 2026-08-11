'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Sparkles, Plus } from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DashboardKpis,
  QuotesChart,
  RecentActivity,
  MonthSummary,
  QuickCustomers,
  computeDashboardMetrics,
} from '@/components/dashboard/dashboard-widgets';
import { formatCurrency, quoteNumberLabel, timeAgo } from '@/lib/utils';
import { QuoteStatusBadge } from '@/components/ui/status-badge';
import { FREE_MONTHLY_QUOTES } from '@/lib/constants';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function DashboardPage() {
  const { user, company, quotes, customers, loading } = useData();

  const monthStart = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const monthQuotes = quotes.filter(
    (q) => new Date(q.createdAt).getTime() >= monthStart.getTime() && q.status !== 'rascunho',
  );
  const metrics = computeDashboardMetrics(quotes);
  const remainingFree = company?.plan === 'free' ? Math.max(0, FREE_MONTHLY_QUOTES - monthQuotes.length) : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(' ')[0] ?? ''} 👋`}
        description={
          company?.plan === 'free' && remainingFree !== null
            ? `Plano grátis: você ainda pode criar ${remainingFree} orçamento${remainingFree === 1 ? '' : 's'} este mês.`
            : undefined
        }
        actions={
          <Link href="/app/orcamentos/novo">
            <Button>
              <Plus className="size-4" /> Novo orçamento
            </Button>
          </Link>
        }
      />

      {/* Limite do plano grátis */}
      {company?.plan === 'free' && remainingFree !== null && remainingFree <= 2 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-800">
              <strong>Atenção:</strong> você está usando {monthQuotes.length} de {FREE_MONTHLY_QUOTES} orçamentos do
              plano grátis este mês. No plano Pro você tem orçamentos ilimitados + IA.
            </p>
            <Link href="/app/planos">
              <Button variant="secondary" size="sm" className="border-amber-300 bg-white text-amber-800 hover:bg-amber-100">
                Ver planos
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {quotes.length === 0 ? (
        <div className="space-y-6">
          <MonthSummary quotes={quotes} />
          <EmptyState
            icon={Sparkles}
            title="Pronto para vender!"
            description="Crie seu primeiro orçamento: cole a mensagem do cliente e a IA monta tudo para você."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/app/orcamentos/novo">
                  <Button>
                    <Plus className="size-4" /> Criar primeiro orçamento
                  </Button>
                </Link>
                <Link href="/app/servicos">
                  <Button variant="secondary">Cadastrar serviços</Button>
                </Link>
              </div>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="p-5">
              <p className="text-sm font-medium text-ink-500">Dica 1 · Cadastre seus serviços</p>
              <p className="mt-1 text-sm text-ink-500">Cada serviço com preço vira uma sugestão da IA.</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-medium text-ink-500">Dica 2 · Cole a mensagem do cliente</p>
              <p className="mt-1 text-sm text-ink-500">A IA identifica serviço, quantidade e preço do seu catálogo.</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-medium text-ink-500">Dica 3 · Envie pelo WhatsApp</p>
              <p className="mt-1 text-sm text-ink-500">Mensagem pronta + link wa.me. Follow-up em 2 dias.</p>
            </Card>
          </div>
        </div>
      ) : (
        <>
          <MonthSummary quotes={quotes} />

          <DashboardKpis quotes={quotes} />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <QuotesChart quotes={quotes} />
            </div>
            <div className="space-y-4">
              <QuickCustomers count={customers.length} />
              <Card className="p-5">
                <p className="text-sm font-medium text-ink-500">Orçamentos este mês</p>
                <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-950">{monthQuotes.length}</p>
                <p className="mt-1 text-xs text-ink-400">Enviados: {formatCurrency(metrics.sentValue)}</p>
              </Card>
              <Link href="/app/follow-ups" className="block">
                <Card className="p-5 transition-shadow hover:shadow-card-hover">
                  <p className="text-sm font-medium text-ink-500">Follow-ups pendentes</p>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-950">
                    {quotes.length > 0 ? Math.max(0, monthQuotes.filter((q) => q.status === 'enviado').length) : 0}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">Lembretes para não deixar a venda esfriar</p>
                </Card>
              </Link>
            </div>
          </div>

          <RecentActivity quotes={quotes} />
        </>
      )}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  Send,
  Users,
  type LucideIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { subDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Quote, QuoteStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QuoteStatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatCurrency, quoteNumberLabel, timeAgo } from '@/lib/utils';
import { SENT_STATUSES } from '@/lib/constants';
import { effectiveStatus } from '@/lib/quote-utils';

// ---------------------------------------------------------------- KPI
interface KpiProps {
  title: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone: 'brand' | 'emerald' | 'amber' | 'sky' | 'ink';
}

const TONES: Record<KpiProps['tone'], string> = {
  brand: 'bg-brand-50 text-brand-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
  ink: 'bg-ink-100 text-ink-600',
};

export function KpiCard({ title, value, sub, icon: Icon, tone }: KpiProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-ink-500">{title}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-950">{value}</p>
          {sub && <p className="mt-1 text-xs text-ink-400">{sub}</p>}
        </div>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', TONES[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- Métricas
export function computeDashboardMetrics(quotes: Quote[]) {
  const sent = quotes.filter((q) => SENT_STATUSES.includes(effectiveStatus(q))).length;
  const pending = quotes.filter((q) => ['enviado', 'visualizado', 'negociacao'].includes(effectiveStatus(q))).length;
  const approved = quotes.filter((q) => effectiveStatus(q) === 'aprovado').length;
  const approvedValue = quotes.filter((q) => effectiveStatus(q) === 'aprovado').reduce((acc, q) => acc + q.total, 0);
  const sentValue = quotes.filter((q) => SENT_STATUSES.includes(effectiveStatus(q))).reduce((acc, q) => acc + q.total, 0);
  const conversion = sent > 0 ? (approved / sent) * 100 : 0;
  const ticket = approved > 0 ? approvedValue / approved : 0;
  return { sent, pending, approved, approvedValue, sentValue, conversion, ticket };
}

export function DashboardKpis({ quotes }: { quotes: Quote[] }) {
  const m = useMemo(() => computeDashboardMetrics(quotes), [quotes]);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard title="Enviados" value={String(m.sent)} icon={Send} tone="sky" sub="neste período" />
      <KpiCard title="Pendentes" value={String(m.pending)} icon={Clock} tone="amber" sub="aguardando resposta" />
      <KpiCard title="Aprovados" value={String(m.approved)} icon={CheckCircle2} tone="emerald" sub={`R$ ${formatCurrency(m.approvedValue)}`} />
      <KpiCard title="Valor vendido" value={formatCurrency(m.approvedValue)} icon={TrendingUp} tone="brand" sub="aprovado" />
      <KpiCard title="Conversão" value={`${m.conversion.toFixed(1).replace('.', ',')}%`} icon={BarChart3} tone="ink" sub={`ticket médio ${formatCurrency(m.ticket)}`} />
    </div>
  );
}

// ---------------------------------------------------------------- Gráfico
type Period = 7 | 30 | 90;

export function QuotesChart({ quotes }: { quotes: Quote[] }) {
  const [period, setPeriod] = useState<Period>(7);

  const data = useMemo(() => {
    const start = subDays(new Date(), period - 1);
    start.setHours(0, 0, 0, 0);
    const days: { key: string; label: string; criados: number; aprovados: number }[] = [];
    for (let i = 0; i < period; i++) {
      const d = subDays(new Date(), period - 1 - i);
      days.push({ key: d.toISOString().slice(0, 10), label: format(d, 'dd/MM', { locale: ptBR }), criados: 0, aprovados: 0 });
    }
    const byDay = new Map(days.map((d) => [d.key, d]));
    for (const q of quotes) {
      const created = parseISO(q.createdAt);
      if (created < start) continue;
      const key = created.toISOString().slice(0, 10);
      const bucket = byDay.get(key);
      if (!bucket) continue;
      if (q.status !== 'rascunho') bucket.criados += 1;
      if (effectiveStatus(q) === 'aprovado') bucket.aprovados += 1;
    }
    return days;
  }, [quotes, period]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Orçamentos por período</CardTitle>
          <CardDescription className="mt-1">Criados vs. aprovados</CardDescription>
        </div>
        <Tabs value={String(period)} onValueChange={(v) => setPeriod(Number(v) as Period)}>
          <TabsList>
            <TabsTrigger value="7">7 dias</TabsTrigger>
            <TabsTrigger value="30">30 dias</TabsTrigger>
            <TabsTrigger value="90">90 dias</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {quotes.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="Sem dados ainda"
            description="Seus orçamentos aparecerão aqui em gráficos claros."
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} interval={period > 30 ? 6 : 2} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(99,102,241,0.06)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="criados" name="Criados" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="aprovados" name="Aprovados" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- Atividade recente
export function RecentActivity({ quotes }: { quotes: Quote[] }) {
  const recent = useMemo(() => [...quotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8), [quotes]);

  if (recent.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Atividade recente</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Clock}
            title="Nenhum orçamento ainda"
            description="Quando você criar orçamentos, eles aparecem aqui."
            action={
              <Link href="/app/orcamentos/novo">
                <Button>+ Criar primeiro orçamento</Button>
              </Link>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividade recente</CardTitle>
        <CardDescription className="mt-1">Seus últimos orçamentos</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-ink-100">
          {recent.map((q) => (
            <li key={q.id}>
              <Link href={`/app/orcamentos/${q.id}`} className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-ink-50/60">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-700">
                  {quoteNumberLabel(q.number).replace('#', '')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{q.customerName}</p>
                  <p className="truncate text-xs text-ink-400">
                    {q.items?.[0]?.name}
                    {q.items.length > 1 ? ` +${q.items.length - 1} item(ns)` : ''} · {timeAgo(q.createdAt)}
                  </p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-ink-900">{formatCurrency(q.total)}</p>
                  <QuoteStatusBadge quote={q} className="mt-0.5" />
                </div>
                <QuoteStatusBadge quote={q} className="sm:hidden" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- Resumo do mês
export function MonthSummary({ quotes }: { quotes: Quote[] }) {
  const m = useMemo(() => computeDashboardMetrics(quotes), [quotes]);
  return (
    <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-white">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-800">
              Você enviou <strong>{formatCurrency(m.sentValue)}</strong> em orçamentos este mês.
            </p>
            <p className="mt-1 text-sm text-brand-700">
              <strong>{formatCurrency(m.approvedValue)}</strong> foram aprovados · conversão de{' '}
              <strong>{m.conversion.toFixed(1).replace('.', ',')}%</strong>
            </p>
          </div>
          <Link href="/app/orcamentos/novo">
            <Button>+ Novo orçamento</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------- Clientes rápidos
export function QuickCustomers({ count }: { count: number }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink-500">Clientes cadastrados</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-950">{count}</p>
        </div>
        <span className="grid size-9 place-items-center rounded-lg bg-ink-100 text-ink-600">
          <Users className="size-5" />
        </span>
      </div>
    </Card>
  );
}

export type { QuoteStatus };

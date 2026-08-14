'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Gem, CreditCard, Lock, ArrowRight, Loader2, CheckCircle2, XCircle, Receipt } from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { db } from '@/lib/db';
import { PLANS, formatPlanPrice, getPlan } from '@/lib/plans';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { PlanId } from '@/lib/types';

export default function PlansPage() {
  return (
    <Suspense fallback={<PlansSkeleton />}>
      <PlansPageContent />
    </Suspense>
  );
}

function PlansSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

function PlansPageContent() {
  const { company, loading, refresh } = useData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [payments, setPayments] = useState<Awaited<ReturnType<typeof db.listPayments>>>([]);
  const [subscription, setSubscription] = useState<Awaited<ReturnType<typeof db.getSubscription>>>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [statusBanner, setStatusBanner] = useState<'success' | 'pending' | 'failure' | null>(null);

  const loadBilling = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([db.listPayments(), db.getSubscription()]);
      setPayments(p);
      setSubscription(s);
    } catch {
      // silencioso — banner de dados cobre
    }
  }, []);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success' || status === 'pending' || status === 'failure') {
      setStatusBanner(status);
      if (status === 'success') {
        refresh();
        loadBilling();
      }
      router.replace('/app/planos');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (loading || !company) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const currentCompany = company;
  const currentPlan = getPlan(currentCompany.plan);
  const sub = subscription;

  async function cancelSubscription() {
    setCancelling(true);
    try {
      await db.cancelSubscription();
      refresh();
      await loadBilling();
      setConfirmCancel(false);
      toast.success('Assinatura cancelada. Você voltou ao plano gratuito.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cancelar.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos"
        description="Escolha o plano ideal para o seu momento. Cancele quando quiser."
      />

      {/* Banners de retorno do pagamento */}
      {statusBanner === 'success' && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            <p className="text-sm text-emerald-800">
              <strong>Pagamento aprovado!</strong> Seu plano já está ativo — aproveite todos os recursos.
            </p>
          </CardContent>
        </Card>
      )}
      {statusBanner === 'pending' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="size-5 shrink-0 animate-spin text-amber-600" />
            <p className="text-sm text-amber-800">
              <strong>Pagamento pendente.</strong> Assim que for confirmado, seu plano é ativado automaticamente.
            </p>
          </CardContent>
        </Card>
      )}
      {statusBanner === 'failure' && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="size-5 shrink-0 text-rose-600" />
            <p className="text-sm text-rose-800">
              <strong>Pagamento não concluído.</strong> Você pode tentar novamente — nenhum valor foi cobrado sem sua
              confirmação.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status da assinatura */}
      <Card className="border-brand-200 bg-brand-50/60">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-white shadow-sm">
              <Gem className="size-5 text-brand-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">
                Seu plano atual: <span className="text-brand-700">{currentPlan.name}</span>
              </p>
              <p className="text-xs text-ink-500">
                {currentCompany.plan === 'free' ? (
                  'Até 5 orçamentos por mês, 10 serviços e 30 clientes.'
                ) : sub?.renewsAt ? (
                  `Assinatura ativa · renova em ${formatDate(sub.renewsAt)}`
                ) : (
                  'Todos os recursos liberados.'
                )}
              </p>
              {sub?.status === 'pendente' && (
                <Badge variant="warning" className="mt-1">Pagamento pendente de confirmação</Badge>
              )}
              {sub?.status === 'cancelado' && currentCompany.plan === 'free' && (
                <Badge variant="secondary" className="mt-1">Assinatura cancelada</Badge>
              )}
            </div>
          </div>
          {currentCompany.plan !== 'free' && (
            <Button variant="secondary" onClick={() => setConfirmCancel(true)} className="shrink-0">
              Cancelar assinatura
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = currentCompany.plan === plan.id;
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.highlighted
                  ? 'border-brand-600 bg-ink-950 text-white shadow-card-hover lg:-translate-y-2'
                  : 'border-ink-200/70 bg-white shadow-card'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                  Mais popular
                </span>
              )}
              <div className="flex items-center justify-between">
                <h3 className={`text-lg font-semibold ${plan.highlighted ? 'text-white' : 'text-ink-900'}`}>{plan.name}</h3>
                {isCurrent && <Badge variant={plan.highlighted ? 'default' : 'success'}>Plano atual</Badge>}
              </div>
              <p className={`mt-1 text-sm ${plan.highlighted ? 'text-ink-300' : 'text-ink-500'}`}>{plan.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className={`text-4xl font-bold tracking-tight ${plan.highlighted ? 'text-white' : 'text-ink-950'}`}>
                  {formatPlanPrice(plan)}
                </span>
                <span className={`text-sm ${plan.highlighted ? 'text-ink-400' : 'text-ink-400'}`}>/mês</span>
              </div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className={`mt-0.5 size-4 shrink-0 ${plan.highlighted ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    <span className={plan.highlighted ? 'text-ink-100' : 'text-ink-600'}>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className={`mt-8 w-full ${plan.highlighted ? 'bg-brand-500 hover:bg-brand-400' : ''}`}
                variant={plan.highlighted ? 'default' : 'secondary'}
                disabled={isCurrent}
                onClick={() => {
                  if (plan.id === 'free') {
                    setConfirmCancel(true);
                  } else {
                    router.push(`/app/planos/checkout?plan=${plan.id}`);
                  }
                }}
              >
                {isCurrent ? 'Plano atual' : plan.id === 'free' ? 'Voltar para o grátis' : `Assinar ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Info de pagamento */}
      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-100">
              <CreditCard className="size-5 text-ink-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Pagamento via Mercado Pago</p>
              <p className="mt-1 text-sm text-ink-500">
                Pagamento com <strong>Pix, cartão de crédito ou boleto</strong>, processado pelo Mercado Pago com
                assinatura recorrente mensal.
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                <Lock className="size-3.5" /> Seus dados de pagamento ficam protegidos e processados pelo Mercado Pago.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-100">
              <ArrowRight className="size-5 text-ink-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Garantia</p>
              <p className="mt-1 text-sm text-ink-500">
                Sem fidelidade. Cancele quando quiser e volte ao plano gratuito automaticamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de pagamentos */}
      <Card>
        <CardContent className="p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Receipt className="size-4 text-ink-400" /> Histórico de pagamentos
          </p>
          {payments.length === 0 ? (
            <p className="mt-3 rounded-xl bg-ink-50 p-4 text-center text-xs text-ink-400">
              Nenhum pagamento registrado ainda. Assine um plano para ver o histórico aqui.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-ink-100">
              {payments.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${p.status === 'aprovado' ? 'bg-emerald-500' : p.status === 'pendente' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                    <span className="font-medium text-ink-900">Plano {getPlan(p.plan).name}</span>
                    <span className="text-xs text-ink-400">· {formatDateTime(p.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-900">{formatCurrency(p.amount)}</span>
                    <Badge
                      variant={p.status === 'aprovado' ? 'success' : p.status === 'pendente' ? 'warning' : 'danger'}
                    >
                      {p.status === 'aprovado' ? 'Aprovado' : p.status === 'pendente' ? 'Pendente' : 'Recusado'}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={
          currentCompany.plan === 'free'
            ? 'Voltar para o plano gratuito?'
            : `Cancelar assinatura do ${currentPlan.name}?`
        }
        description={
          currentCompany.plan === 'free'
            ? 'Você já está no plano gratuito.'
            : 'Sua assinatura será cancelada e o acesso aos recursos pagos será removido. Você pode assinar novamente quando quiser.'
        }
        confirmLabel={currentCompany.plan === 'free' ? 'Confirmar' : 'Cancelar assinatura'}
        loading={cancelling}
        onConfirm={cancelSubscription}
      />
    </div>
  );
}

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Gem, Sparkles, CreditCard, Lock, QrCode, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { db, isDemo } from '@/lib/db';
import { PLANS, formatPlanPrice, getPlan } from '@/lib/plans';
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
  const [choosing, setChoosing] = useState<PlanId | null>(null);
  const [applying, setApplying] = useState(false);
  const [simCheckout, setSimCheckout] = useState<{ checkoutId: string; plan: PlanId } | null>(null);
  const [simPaying, setSimPaying] = useState(false);
  const [statusBanner, setStatusBanner] = useState<'success' | 'pending' | 'failure' | null>(null);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success' || status === 'pending' || status === 'failure') {
      setStatusBanner(status);
      if (status === 'success') refresh();
      // limpa a URL
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

  async function choosePlan(plan: PlanId) {
    if (plan === currentCompany.plan) return;
    setChoosing(plan);
    setApplying(true);
    try {
      if (plan === 'free') {
        // Voltar para o grátis é imediato (sem pagamento)
        await db.setPlan('free');
        refresh();
        toast.success('Você voltou ao plano gratuito.');
        setChoosing(null);
        return;
      }

      if (isDemo()) {
        // Modo demonstração: checkout simulado
        const res = await db.startCheckout({ plan });
        if (res.simulated && res.checkoutId) {
          setSimCheckout({ checkoutId: res.checkoutId, plan });
        }
        setChoosing(null);
        return;
      }

      // Produção: checkout real via Mercado Pago
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const json = (await res.json().catch(() => ({}))) as { initPoint?: string; error?: string };
      if (!res.ok || !json.initPoint) {
        throw new Error(json.error || 'Não foi possível iniciar o pagamento.');
      }
      window.location.href = json.initPoint; // redireciona para o Checkout Pro
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível iniciar o checkout.');
      setChoosing(null);
    } finally {
      setApplying(false);
    }
  }

  async function simulatePay() {
    if (!simCheckout) return;
    setSimPaying(true);
    try {
      await db.completeCheckout({ checkoutId: simCheckout.checkoutId });
      refresh();
      toast.success('Pagamento aprovado! Bem-vindo ao plano Pro 🎉');
      setSimCheckout(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir o pagamento.');
    } finally {
      setSimPaying(false);
    }
  }

  const simPlan = simCheckout ? getPlan(simCheckout.plan) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos"
        description="Escolha o plano ideal para o seu momento. Cancele quando quiser."
      />

      {/* Banners de retorno do Mercado Pago */}
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
              <strong>Pagamento pendente.</strong> Assim que o pagamento for confirmado, seu plano é ativado
              automaticamente.
            </p>
          </CardContent>
        </Card>
      )}
      {statusBanner === 'failure' && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="flex items-center gap-3 p-4">
            <p className="text-sm text-rose-800">
              <strong>Pagamento não concluído.</strong> Você pode tentar novamente — nenhum valor foi cobrado sem sua
              confirmação.
            </p>
          </CardContent>
        </Card>
      )}

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
                {company.plan === 'free'
                  ? 'Até 5 orçamentos por mês, 10 serviços e 30 clientes.'
                  : 'Todos os recursos liberados.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = company.plan === plan.id;
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
                disabled={isCurrent || applying}
                loading={choosing === plan.id && applying}
                onClick={() => choosePlan(plan.id)}
              >
                {isCurrent ? 'Plano atual' : plan.id === 'free' ? 'Voltar para o grátis' : `Assinar ${plan.name} — ${formatPlanPrice(plan)}/mês`}
              </Button>
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-100">
              <CreditCard className="size-5 text-ink-600" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">Pagamento via Mercado Pago</p>
              <p className="mt-1 text-sm text-ink-500">
                Pagamento com <strong>Pix, cartão de crédito ou boleto</strong>, processado pelo Mercado Pago com toda a
                segurança. A assinatura é mensal e pode ser cancelada quando quiser.
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-400">
                <Lock className="size-3.5" /> Seus dados de pagamento ficam protegidos e processados pelo Mercado Pago.
              </p>
            </div>
          </div>
          {isDemo() && (
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-50">
                <Sparkles className="size-5 text-amber-600" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900">Modo demonstração</p>
                <p className="mt-1 text-sm text-ink-500">
                  Você está sem chaves do Mercado Pago, então o checkout é <strong>simulado</strong> — o plano é ativado
                  na hora. Em produção, o usuário é redirecionado para o checkout real.
                </p>
              </div>
            </div>
          )}
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

      {/* Modal de pagamento simulado (modo demonstração) */}
      <Dialog open={simCheckout !== null} onOpenChange={(o) => !o && setSimCheckout(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader className="items-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50">
              <QrCode className="size-8 text-brand-600" />
            </span>
            <DialogTitle className="mt-3">Pagamento {simPlan ? `— Plano ${simPlan.name}` : ''}</DialogTitle>
            <DialogDescription>
              {isDemo()
                ? 'Este é um checkout de demonstração. Em produção você pagaria via Pix ou cartão no Mercado Pago.'
                : 'Aguarde a confirmação do pagamento.'}
            </DialogDescription>
          </DialogHeader>
          {simPlan && (
            <div className="mx-auto w-full max-w-[220px] rounded-xl border border-ink-100 bg-ink-50/60 p-4">
              <p className="text-xs uppercase tracking-wide text-ink-400">Valor</p>
              <p className="mt-1 text-2xl font-bold text-ink-950">{formatPlanPrice(simPlan)}/mês</p>
              <p className="mt-1 text-xs text-ink-400">Pix · Cartão · Boleto</p>
            </div>
          )}
          <DialogFooter className="mt-2 justify-center">
            <Button variant="secondary" onClick={() => setSimCheckout(null)} disabled={simPaying}>
              Cancelar
            </Button>
            <Button onClick={simulatePay} loading={simPaying} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="size-4" /> Simular pagamento aprovado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

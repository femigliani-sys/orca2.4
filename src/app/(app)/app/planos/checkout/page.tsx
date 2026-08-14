'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Check,
  CreditCard,
  QrCode,
  Barcode,
  Loader2,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { useData } from '@/components/providers/data-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { db, isDemo } from '@/lib/db';
import { getPlan } from '@/lib/plans';
import { cn, formatCurrency } from '@/lib/utils';
import type { PlanId } from '@/lib/types';

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

type Method = 'pix' | 'cartao' | 'boleto';

function CheckoutContent() {
  const { company, loading, refresh } = useData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const planParam = (searchParams.get('plan') ?? '') as PlanId;

  const [method, setMethod] = useState<Method>('pix');
  const [processing, setProcessing] = useState(false);
  const [simCheckout, setSimCheckout] = useState<{ checkoutId: string } | null>(null);
  const [simPaying, setSimPaying] = useState(false);
  const [done, setDone] = useState(false);

  const plan = getPlan(planParam);
  const validPlan = planParam === 'pro' || planParam === 'business';

  // Plano gratuito não tem checkout
  useEffect(() => {
    if (planParam && !validPlan) {
      toast.error('Escolha o plano Pro ou Business para assinar.');
      router.replace('/app/planos');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planParam]);

  if (loading || !company) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const currentPlan = getPlan(company.plan);
  const isCurrent = company.plan === planParam;

  async function pay() {
    if (isCurrent) return;
    setProcessing(true);
    try {
      if (isDemo()) {
        // Modo demonstração (local)
        const res = await db.startCheckout({ plan: planParam });
        if (res.simulated && res.checkoutId) {
          setSimCheckout({ checkoutId: res.checkoutId });
        }
        return;
      }
      // Produção: API route (real com MP, simulada sem MP)
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planParam }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        initPoint?: string;
        simulated?: boolean;
        checkoutId?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || 'Não foi possível iniciar o pagamento.');
      }
      if (json.initPoint) {
        window.location.href = json.initPoint;
        return;
      }
      if (json.simulated && json.checkoutId) {
        setSimCheckout({ checkoutId: json.checkoutId });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível iniciar o checkout.');
    } finally {
      setProcessing(false);
    }
  }

  async function simulatePay() {
    if (!simCheckout) return;
    setSimPaying(true);
    try {
      if (isDemo()) {
        await db.completeCheckout({ checkoutId: simCheckout.checkoutId });
      } else {
        const res = await fetch('/api/billing/checkout/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkoutId: simCheckout.checkoutId }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) throw new Error(json.error || 'Não foi possível concluir.');
      }
      await refresh();
      setSimCheckout(null);
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível concluir o pagamento.');
    } finally {
      setSimPaying(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50">
          <CheckCircle2 className="size-9 text-emerald-600" />
        </span>
        <h1 className="mt-6 text-2xl font-bold text-ink-950">Pagamento aprovado! 🎉</h1>
        <p className="mt-2 text-ink-500">
          Seu plano <strong>{plan.name}</strong> está ativo. Todos os recursos foram liberados.
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <Button onClick={() => router.push('/app')}>Ir para o dashboard</Button>
          <Button variant="secondary" onClick={() => router.push('/app/planos')}>
            Ver planos
          </Button>
        </div>
      </div>
    );
  }

  const methods: { id: Method; label: string; icon: typeof QrCode; desc: string }[] = [
    { id: 'pix', label: 'Pix', icon: QrCode, desc: 'Aprovação na hora' },
    { id: 'cartao', label: 'Cartão', icon: CreditCard, desc: 'Crédito em até 12x' },
    { id: 'boleto', label: 'Boleto', icon: Barcode, desc: 'Compensa em 1-2 dias' },
  ];

  return (
    <div className="space-y-6">
      <Link href="/app/planos" className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-600">
        <ArrowLeft className="size-4" /> Planos
      </Link>
      <PageHeader
        className="mt-1"
        title={`Assinar plano ${plan.name}`}
        description="Pagamento seguro via Mercado Pago. Cancele quando quiser."
      />

      {isCurrent && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-800">
            <strong>Você já está no plano {plan.name}.</strong> Seu acesso está ativo.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Resumo */}
        <div className="lg:col-span-2">
          <Card className={cn('overflow-hidden border-2', plan.highlighted ? 'border-brand-600' : 'border-ink-200')}>
            <div className={cn('px-6 py-5', plan.highlighted ? 'bg-ink-950 text-white' : 'bg-ink-50')}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {plan.highlighted && <Badge variant="default">Mais popular</Badge>}
              </div>
              <p className={cn('mt-1 text-sm', plan.highlighted ? 'text-ink-300' : 'text-ink-500')}>{plan.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold">{formatCurrency(plan.price)}</span>
                <span className={cn('text-sm', plan.highlighted ? 'text-ink-400' : 'text-ink-400')}>/mês</span>
              </div>
            </div>
            <CardContent className="p-6">
              <ul className="space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                    <span className="text-ink-600">{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 space-y-1.5 border-t border-ink-100 pt-4 text-sm">
                <div className="flex justify-between text-ink-500">
                  <span>Assinatura mensal</span>
                  <span>{formatCurrency(plan.price)}</span>
                </div>
                <div className="flex justify-between font-semibold text-ink-900">
                  <span>Total hoje</span>
                  <span>{formatCurrency(plan.price)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pagamento */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Como deseja pagar?</CardTitle>
              <CardDescription className="mt-1">Processado com segurança pelo Mercado Pago.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {methods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors',
                      method === m.id
                        ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600'
                        : 'border-ink-200 bg-white hover:border-brand-300',
                    )}
                  >
                    <m.icon className={cn('size-5', method === m.id ? 'text-brand-600' : 'text-ink-400')} />
                    <span className="text-sm font-semibold text-ink-900">{m.label}</span>
                    <span className="text-xs text-ink-400">{m.desc}</span>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-4 text-sm text-ink-600">
                <p className="flex items-center gap-2 font-medium text-ink-800">
                  <ShieldCheck className="size-4 text-emerald-600" /> Compra protegida
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  Seus dados de pagamento são processados exclusivamente pelo Mercado Pago. Após a aprovação, o plano é
                  ativado automaticamente.
                </p>
              </div>

              <Button
                size="lg"
                className="w-full"
                loading={processing}
                disabled={isCurrent}
                onClick={pay}
              >
                {isCurrent ? `Você já está no ${plan.name}` : `Pagar ${formatCurrency(plan.price)} com ${method === 'pix' ? 'Pix' : method === 'cartao' ? 'Cartão' : 'Boleto'}`}
              </Button>

              <p className="text-center text-xs text-ink-400">
                Ao assinar você concorda com os termos de uso. Cancele quando quiser.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de pagamento simulado */}
      <Dialog open={simCheckout !== null} onOpenChange={(o) => !o && setSimCheckout(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader className="items-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50">
              <QrCode className="size-8 text-brand-600" />
            </span>
            <DialogTitle className="mt-3">Pagamento {plan.name}</DialogTitle>
            <DialogDescription>
              {isDemo()
                ? 'Checkout de demonstração — em produção o pagamento é feito no Mercado Pago (Pix, cartão ou boleto).'
                : 'Modo simulado ativo (chave do Mercado Pago não configurada). O pagamento real será habilitado quando a chave for adicionada.'}
            </DialogDescription>
          </DialogHeader>

          {/* QR Code ilustrativo */}
          <div className="mx-auto w-fit rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
            <QrMock />
          </div>
          <p className="text-xs text-ink-400">QR Code ilustrativo · Pix de demonstração</p>

          <div className="mx-auto w-full max-w-[220px] rounded-xl border border-ink-100 bg-ink-50/60 p-4">
            <p className="text-xs uppercase tracking-wide text-ink-400">Valor</p>
            <p className="mt-1 text-2xl font-bold text-ink-950">{formatCurrency(plan.price)}/mês</p>
          </div>

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

/** QR Code ilustrativo (somente visual, para o modo simulado). */
function QrMock() {
  const cells = 21;
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= cells - 7 && y < 7) || (x < 7 && y >= cells - 7);
  const finderOn = (x: number, y: number) => {
    const lx = x < 7 ? x : x >= cells - 7 ? x - (cells - 7) : x;
    const ly = y < 7 ? y : y >= cells - 7 ? y - (cells - 7) : y;
    const inBorder = lx === 0 || lx === 6 || ly === 0 || ly === 6;
    const inCore = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
    return inBorder || inCore;
  };
  const randomOn = (x: number, y: number) => ((x * 31 + y * 17 + x * y) % 3) !== 0;
  return (
    <svg viewBox={`0 0 ${cells} ${cells}`} className="size-40" shapeRendering="crispEdges">
      <rect x={0} y={0} width={cells} height={cells} fill="#ffffff" />
      {Array.from({ length: cells }).map((_, y) =>
        Array.from({ length: cells }).map((_, x) => {
          const on = inFinder(x, y) ? finderOn(x, y) : randomOn(x, y);
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={on ? '#1e293b' : '#ffffff'} />;
        }),
      )}
    </svg>
  );
}

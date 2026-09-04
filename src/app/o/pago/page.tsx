'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';

/**
 * Página de retorno do pagamento do orçamento (back_url do Mercado Pago).
 * Ao voltar aprovado, chama /api/billing/finalize para aprovar o orçamento
 * automaticamente (não depende apenas do webhook).
 */
function PagoContent() {
  const params = useSearchParams();
  const ok = params.get('ok');
  const collectionStatus = params.get('collection_status');
  const finalized = useRef(false);
  const [status, setStatus] = useState<'ok' | 'pending' | 'fail'>(
    ok === '1' ? 'ok' : collectionStatus === 'approved' ? 'ok' : collectionStatus ? 'pending' : ok === '0' ? 'pending' : 'pending',
  );

  useEffect(() => {
    if (finalized.current) return;
    finalized.current = true;
    const effective = collectionStatus ?? (ok === '1' ? 'approved' : 'rejected');
    if (effective === 'approved') {
      const body = {
        status: 'approved',
        externalReference: params.get('external_reference') ?? '',
        paymentId: params.get('collection_id') ?? params.get('payment_id') ?? '',
        preferenceId: params.get('preference_id') ?? '',
      };
      fetch('/api/billing/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(() => setStatus('ok'))
        .catch(() => setStatus('ok')); // mantém aprovado na tela mesmo se o finalize falhar (webhook cobre)
    } else {
      setStatus('pending');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4">
      <Logo />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-ink-200/70 bg-white p-8 text-center shadow-card-hover">
        {status === 'ok' ? (
          <>
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50">
              <CheckCircle2 className="size-9 text-emerald-600" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-ink-950">Pagamento aprovado! 🎉</h1>
            <p className="mt-2 text-sm text-ink-500">
              Obrigado! O prestador já foi notificado e entrará em contato para agendar o serviço.
            </p>
          </>
        ) : status === 'pending' ? (
          <>
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-amber-50">
              <Clock className="size-9 text-amber-500" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-ink-950">Pagamento em análise</h1>
            <p className="mt-2 text-sm text-ink-500">
              Seu pagamento está sendo processado. Assim que for confirmado, o orçamento é aprovado automaticamente.
            </p>
          </>
        ) : (
          <>
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-rose-50">
              <XCircle className="size-9 text-rose-500" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-ink-950">Pagamento não concluído</h1>
            <p className="mt-2 text-sm text-ink-500">
              Se desejar, tente novamente pelo link do orçamento.
            </p>
          </>
        )}
        <Link href="/" className="mt-6 block">
          <Button variant="secondary">Voltar ao início</Button>
        </Link>
      </div>
      <p className="mt-6 text-xs text-ink-400">Pagamento processado com segurança pelo Mercado Pago · OrçaAI</p>
    </div>
  );
}

export default function PagoPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-ink-50">
          <Loader2 className="size-6 animate-spin text-brand-600" />
        </div>
      }
    >
      <PagoContent />
    </Suspense>
  );
}

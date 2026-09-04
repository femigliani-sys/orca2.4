'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';

/**
 * Página de retorno do pagamento do orçamento (back_url do Mercado Pago).
 * A URL traz ?t=<token-do-link>&collection_status=approved|pending|...
 * Ao voltar aprovado, chama /api/billing/finalize com o TOKEN (caminho
 * confiável — não depende de external_reference) para aprovar o orçamento.
 */
function PagoContent() {
  const params = useSearchParams();
  const token = params.get('t') ?? '';
  const collectionStatus = params.get('collection_status');
  const ok = params.get('ok');
  const done = useRef(false);
  const [state, setState] = useState<'ok' | 'pending' | 'fail' | 'checking'>('checking');

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const status =
      collectionStatus ??
      (ok === '1' ? 'approved' : ok === '0' ? 'rejected' : null);

    if (status !== 'approved') {
      setState(status === 'pending' ? 'pending' : status === 'rejected' ? 'fail' : 'pending');
      return;
    }

    // Aprovado → finaliza com o token
    const body: Record<string, string> = { status: 'approved' };
    if (token) body.token = token;
    if (params.get('external_reference')) body.externalReference = params.get('external_reference')!;
    if (params.get('collection_id')) body.paymentId = params.get('collection_id')!;
    if (params.get('payment_id')) body.paymentId = body.paymentId || params.get('payment_id')!;
    if (params.get('preference_id')) body.preferenceId = params.get('preference_id')!;

    fetch('/api/billing/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((json: { activated?: boolean; error?: string }) => {
        // Se o finalize falhou (ex.: migração pendente), ainda mostra aprovado;
        // o webhook + botão "sincronizar" do dono cobrem depois.
        if (json.error) console.warn('[o/pago] finalize:', json.error);
        setState('ok');
      })
      .catch(() => setState('ok'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4">
      <Logo />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-ink-200/70 bg-white p-8 text-center shadow-card-hover">
        {state === 'checking' && (
          <>
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-ink-50">
              <Loader2 className="size-8 animate-spin text-brand-600" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-ink-950">Confirmando pagamento…</h1>
          </>
        )}
        {state === 'ok' && (
          <>
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50">
              <CheckCircle2 className="size-9 text-emerald-600" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-ink-950">Pagamento aprovado! 🎉</h1>
            <p className="mt-2 text-sm text-ink-500">
              Obrigado! O prestador já foi notificado e entrará em contato para agendar o serviço.
            </p>
          </>
        )}
        {state === 'pending' && (
          <>
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-amber-50">
              <Clock className="size-9 text-amber-500" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-ink-950">Pagamento em análise</h1>
            <p className="mt-2 text-sm text-ink-500">
              Seu pagamento está sendo processado. Assim que for confirmado, o orçamento é aprovado automaticamente.
            </p>
          </>
        )}
        {state === 'fail' && (
          <>
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-rose-50">
              <XCircle className="size-9 text-rose-500" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-ink-950">Pagamento não concluído</h1>
            <p className="mt-2 text-sm text-ink-500">Se desejar, tente novamente pelo link do orçamento.</p>
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

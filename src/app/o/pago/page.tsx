'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock } from 'lucide-react';

function PagoContent() {
  const params = useSearchParams();
  const ok = params.get('ok');

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4">
      <Logo />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-ink-200/70 bg-white p-8 text-center shadow-card-hover">
        {ok === '1' ? (
          <>
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50">
              <CheckCircle2 className="size-9 text-emerald-600" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-ink-950">Pagamento aprovado! 🎉</h1>
            <p className="mt-2 text-sm text-ink-500">
              Obrigado! O prestador já foi notificado e entrará em contato para agendar o serviço.
            </p>
          </>
        ) : (
          <>
            <span className="mx-auto grid size-16 place-items-center rounded-full bg-amber-50">
              <Clock className="size-9 text-amber-500" />
            </span>
            <h1 className="mt-5 text-xl font-bold text-ink-950">Pagamento pendente</h1>
            <p className="mt-2 text-sm text-ink-500">
              Se o pagamento não foi concluído, você pode tentar novamente pelo link do orçamento.
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
        <div className="grid min-h-screen place-items-center bg-ink-50 text-sm text-ink-400">Carregando…</div>
      }
    >
      <PagoContent />
    </Suspense>
  );
}

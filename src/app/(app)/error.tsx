'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Error boundary do grupo (app) — pega erros de renderização do layout/shell
 * inteiro (não só das páginas), garantindo NUNCA tela branca no painel.
 */
export default function AppGroupError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[OrçaAI] erro no app:', error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-ink-200/70 bg-white p-8 text-center shadow-card">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-50">
          <AlertTriangle className="size-6 text-amber-500" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink-950">Algo deu errado</h1>
        <p className="mt-2 text-sm text-ink-500">
          Ocorreu um erro ao carregar o painel. Seus dados estão seguros — recarregue para continuar.
        </p>
        {process.env.NODE_ENV !== 'production' && error && (
          <p className="mt-3 break-words rounded-lg bg-ink-50 p-3 text-left text-xs text-ink-500">{error.message}</p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw className="size-4" /> Tentar novamente
          </Button>
        </div>
      </div>
    </div>
  );
}

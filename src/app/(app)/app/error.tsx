'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[OrçaAI] erro na página do app:', error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md rounded-2xl border border-ink-200/70 bg-white p-8 text-center shadow-card">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-50">
          <AlertTriangle className="size-6 text-amber-500" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink-950">Algo deu errado</h1>
        <p className="mt-2 text-sm text-ink-500">
          Ocorreu um erro inesperado nesta página. Seus dados estão salvos — recarregue para continuar.
        </p>
        <Button className="mt-6" onClick={reset}>
          <RotateCcw className="size-4" /> Tentar novamente
        </Button>
      </div>
    </div>
  );
}

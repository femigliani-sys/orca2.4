'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OnboardingError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-50 px-4">
      <div className="max-w-md rounded-2xl border border-ink-200/70 bg-white p-8 text-center shadow-card">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-amber-50">
          <AlertTriangle className="size-6 text-amber-500" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink-950">Não foi possível continuar</h1>
        <p className="mt-2 text-sm text-ink-500">Tente novamente para completar a configuração da sua conta.</p>
        <Button className="mt-6" onClick={reset}>
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}

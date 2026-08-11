'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ErrInfo {
  message: string;
  time: string;
}

/**
 * Aviso global de erros não capturados (window.onerror / unhandledrejection).
 * Em vez de tela branca silenciosa, mostra uma barra com a mensagem do erro —
 * essencial para diagnosticar problemas em produção (Vercel).
 */
export function GlobalErrorOverlay() {
  const [errors, setErrors] = useState<ErrInfo[]>([]);

  useEffect(() => {
    function onError(event: ErrorEvent) {
      const msg = event.message || (event.error as Error)?.message || 'Erro desconhecido';
      setErrors((prev) => [...prev.slice(-2), { message: msg.slice(0, 300), time: new Date().toLocaleTimeString('pt-BR') }]);
    }
    function onRejection(event: PromiseRejectionEvent) {
      const msg = (event.reason as Error)?.message || String(event.reason ?? 'Erro desconhecido');
      setErrors((prev) => [...prev.slice(-2), { message: msg.slice(0, 300), time: new Date().toLocaleTimeString('pt-BR') }]);
    }
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2">
      {errors.map((e, i) => (
        <div key={i} className="rounded-xl border border-rose-200 bg-white p-3 shadow-2xl">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-rose-700">Erro na aplicação · {e.time}</p>
              <p className="mt-0.5 break-words text-xs text-ink-600">{e.message}</p>
            </div>
            <button
              onClick={() => setErrors((prev) => prev.filter((_, idx) => idx !== i))}
              className="rounded p-0.5 text-ink-400 hover:bg-ink-100"
              aria-label="Fechar aviso de erro"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

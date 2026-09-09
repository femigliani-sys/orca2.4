'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CookieConsent {
  essential: boolean;
  analytics: boolean;
  at: string;
}

const STORAGE_KEY = 'orcaai_cookie_consent';

export function readCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    return null;
  }
}

export function saveCookieConsent(analytics: boolean) {
  const value: CookieConsent = { essential: true, analytics, at: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* storage indisponível — segue sem persistir */
  }
}

/**
 * Banner de consentimento de cookies em conformidade com a LGPD.
 * - Essenciais: sempre ativos (necessários para sessão/funcionamento).
 * - Analytics/preferências: só com autorização do usuário.
 * A preferência fica salva; o usuário pode fechar/revisar quando quiser.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState<'all' | 'essential' | null>(null);

  useEffect(() => {
    const consent = readCookieConsent();
    // Exibe enquanto não houver decisão registrada
    if (!consent) {
      const t = window.setTimeout(() => setVisible(true), 800);
      return () => window.clearTimeout(t);
    }
    return;
  }, []);

  function choose(mode: 'all' | 'essential') {
    setSaving(mode);
    saveCookieConsent(mode === 'all');
    // pequeno atraso só para dar feedback visual
    window.setTimeout(() => {
      setVisible(false);
      setSaving(null);
    }, 200);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-4 shadow-2xl sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-brand-50">
            <Cookie className="size-5 text-brand-600" />
          </span>
          <div className="text-sm text-ink-600">
            <p className="font-semibold text-ink-900">Cookies e privacidade</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Usamos cookies essenciais para o funcionamento do site e, somente com sua autorização, cookies de
              medição para melhorar o produto. Você pode aceitar tudo ou apenas os essenciais. Saiba mais na nossa{' '}
              <Link href="/privacidade" className="font-medium text-brand-600 underline hover:text-brand-700">
                Política de Privacidade
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col lg:flex-row">
          <Button size="sm" loading={saving === 'all'} onClick={() => choose('all')} className="min-w-[9rem]">
            Aceitar todos
          </Button>
          <Button size="sm" variant="secondary" loading={saving === 'essential'} onClick={() => choose('essential')}>
            Somente essenciais
          </Button>
          <button
            onClick={() => choose('essential')}
            aria-label="Fechar aviso de cookies (somente essenciais)"
            className="ml-auto rounded-md p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600 sm:ml-0 lg:order-first"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2, FileQuestion } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { PublicQuoteView } from '@/components/quotes/public-quote-view';
import { isDemo } from '@/lib/db';
import { localGetQuoteByShareToken } from '@/lib/db/local';
import { localTouchQuote } from '@/lib/db/local';
import { db } from '@/lib/db';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { Company, Quote } from '@/lib/types';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ready'; quote: Quote; company: Company }
  | { phase: 'notfound'; message?: string }
  | { phase: 'error'; message: string };

/** Página pública do orçamento (link compartilhado — plano Pro+). */
export default function PublicQuotePage({ params }: { params: { token: string } }) {
  const token = params.token;
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isDemo()) {
          // Modo demonstração: lê do localStorage do navegador
          const found = localGetQuoteByShareToken(token);
          if (!found) {
            setState({ phase: 'notfound' });
            return;
          }
          if (!cancelled) {
            setState({ phase: 'ready', quote: found.quote, company: found.company });
            localTouchQuote(found.quote.id); // marca visualizado
          }
          return;
        }

        // Produção: API pública (security definer)
        const res = await fetch(`/api/public/quotes/${token}`);
        const json = (await res.json().catch(() => ({}))) as { data?: unknown; error?: string };
        if (!res.ok || !json.data) {
          const needsMigration = json.error?.includes('0005') ?? false;
          setState(
            needsMigration
              ? { phase: 'error', message: json.error ?? 'Erro ao carregar.' }
              : { phase: 'notfound', message: json.error },
          );
          return;
        }
        const data = json.data as {
          id: string;
          number: number;
          customer_name: string;
          status: string;
          items: Quote['items'];
          subtotal: number;
          discount: number;
          total: number;
          validity_days: number;
          valid_until: string;
          notes: string | null;
          terms: string | null;
          created_at: string;
          viewed_at: string | null;
          company: {
            name: string;
            phone?: string | null;
            whatsapp?: string | null;
            email?: string | null;
            address?: string | null;
            logo_url?: string | null;
            settings: Record<string, unknown>;
          };
        };
        const company: Company = {
          id: '',
          ownerId: '',
          name: data.company.name || 'Empresa',
          businessType: '',
          phone: data.company.phone ?? undefined,
          whatsapp: data.company.whatsapp ?? undefined,
          email: data.company.email ?? undefined,
          address: data.company.address ?? undefined,
          logoUrl: data.company.logo_url ?? undefined,
          settings: { ...DEFAULT_SETTINGS, ...(data.company.settings ?? {}) } as Company['settings'],
          plan: 'pro',
          quoteCounter: 0,
          createdAt: '',
        };
        const quote: Quote = {
          id: data.id,
          companyId: '',
          number: data.number,
          customerId: null,
          customerName: data.customer_name,
          status: data.status as Quote['status'],
          items: data.items ?? [],
          subtotal: data.subtotal,
          discount: data.discount,
          total: data.total,
          validityDays: data.validity_days,
          validUntil: data.valid_until,
          notes: data.notes ?? undefined,
          terms: data.terms ?? undefined,
          createdAt: data.created_at,
          updatedAt: data.created_at,
          viewedAt: data.viewed_at,
          approvedAt: null,
        };
        if (!cancelled) setState({ phase: 'ready', quote, company });
      } catch (err) {
        if (!cancelled) setState({ phase: 'error', message: err instanceof Error ? err.message : 'Erro ao carregar.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleApprove() {
    if (state.phase !== 'ready') return;
    try {
      if (isDemo()) {
        await db.updateQuoteStatus(state.quote.id, 'aprovado');
        const found = localGetQuoteByShareToken(token);
        if (found) setState({ phase: 'ready', quote: { ...found.quote, status: 'aprovado', approvedAt: new Date().toISOString() }, company: found.company });
        setApproved(true);
        return;
      }
      const res = await fetch(`/api/public/quotes/${token}`, { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown };
      if (!res.ok || !json.ok) throw new Error('Não foi possível aprovar.');
      setApproved(true);
      // recarrega o estado
      const reload = await fetch(`/api/public/quotes/${token}`);
      const rj = (await reload.json().catch(() => ({}))) as { data?: unknown };
      if (rj.data) {
        const d = rj.data as { status: string };
        setState((prev) => (prev.phase === 'ready' ? { ...prev, quote: { ...prev.quote, status: d.status as Quote['status'] } } : prev));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao aprovar.');
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="border-b border-ink-200/70 bg-white">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <Link href="/">
            <Logo />
          </Link>
          <Link href="/" className="text-xs font-medium text-ink-400 hover:text-ink-600">
            Feito com OrçaAI
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        {state.phase === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-ink-400">
            <Loader2 className="size-8 animate-spin text-brand-600" />
            <p className="text-sm">Carregando orçamento…</p>
          </div>
        )}

        {state.phase === 'ready' && (
          <PublicQuoteView
            quote={state.quote}
            company={state.company}
            onApproved={handleApprove}
          />
        )}

        {state.phase === 'notfound' && (
          <div className="mx-auto max-w-md py-20 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-white shadow-card">
              <FileQuestion className="size-7 text-ink-300" />
            </span>
            <h1 className="mt-5 text-lg font-semibold text-ink-950">Orçamento não encontrado</h1>
            <p className="mt-2 text-sm text-ink-500">
              Este link pode estar incorreto ou o orçamento foi removido.
            </p>
            <Link href="/" className="mt-6 inline-block">
              <Button variant="secondary">Voltar para o início</Button>
            </Link>
          </div>
        )}

        {state.phase === 'error' && (
          <div className="mx-auto max-w-md py-20 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-amber-50">
              <AlertTriangle className="size-7 text-amber-500" />
            </span>
            <h1 className="mt-5 text-lg font-semibold text-ink-950">Não foi possível carregar</h1>
            <p className="mt-2 text-sm text-ink-500">{state.message}</p>
            <p className="mt-3 text-xs text-ink-400">
              Dica: quem compartilhou o link precisa executar a migração 0005 no Supabase.
            </p>
          </div>
        )}
      </main>

      <footer className="border-t border-ink-200/70 bg-white py-6 text-center text-xs text-ink-400">
        <Logo iconOnly className="justify-center" />
        <p className="mt-2">OrçaAI — Transforme pedidos de orçamento em vendas.</p>
      </footer>
    </div>
  );
}

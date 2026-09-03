'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Loader2, Mail, RefreshCw } from 'lucide-react';
import { db, isDemo } from '@/lib/db';
import { friendlyError } from '@/lib/utils';

/**
 * Confirmação de e-mail — fluxo completo:
 * 1. Ao se cadastrar com confirmação ativa, o usuário é mandado para cá
 *    (?email=...) e vê "verifique seu e-mail" com opção de reenviar.
 * 2. O link do e-mail de confirmação cai AQUI com ?code=... → trocamos o
 *    código por sessão e seguimos para o onboarding/painel.
 * (Antes, não existia esta tela: o link de confirmação caía na home e,
 *  tentando reenviar às cegas, o Supabase acusava "rate limit exceeded".)
 */
function ConfirmEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  const emailParam = searchParams.get('email') ?? '';
  const errorParam = searchParams.get('error');
  const errorDesc = searchParams.get('error_description') ?? 'O link expirou ou já foi usado.';

  const [phase, setPhase] = useState<'carregando' | 'confirma' | 'pronto' | 'erro' | 'aguardando'>('carregando');
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (errorParam) {
      setLastError(errorDesc);
      setPhase('erro');
      return;
    }
    if (code) {
      void (async () => {
        try {
          const session = await db.getSession();
          if (!session.userId) {
            await db.exchangeCodeForSession(code);
          }
          setPhase('pronto');
          // Decisão de destino: onboarding se ainda não concluiu, painel se já
          setTimeout(async () => {
            const user = await db.getCurrentUser().catch(() => null);
            router.replace(user?.onboarded ? '/app' : '/onboarding');
          }, 1400);
        } catch (err) {
          setLastError(`Não foi possível confirmar: ${friendlyError(err)}`);
          setPhase('erro');
        }
      })();
      return;
    }
    // Acesso normal (recém-cadastrado ou reabriu a página) → aguardando confirmação
    setPhase('aguardando');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, errorParam]);

  async function resend() {
    if (!emailParam || cooldown > 0) return;
    setResending(true);
    try {
      await db.resendConfirmation(emailParam);
      toastSuccess();
      setCooldown(60);
      const t = window.setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            window.clearInterval(t);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setLastError(friendlyError(err));
    } finally {
      setResending(false);
    }
  }

  function toastSuccess() {
    // usa um estado simples em vez do sonner (disponível no layout raiz)
    setLastError(null);
    setPhase('aguardando');
  }

  const title =
    phase === 'pronto' ? 'E-mail confirmado!' : phase === 'erro' ? 'Não foi possível confirmar' : 'Confirme seu e-mail';

  return (
    <AuthLayout
      title={title}
      subtitle="Estamos quase lá — um último passo para liberar sua conta."
      footer={
        <Link href="/auth/login" className="font-medium text-brand-600 hover:text-brand-700">
          ← Voltar para o login
        </Link>
      }
    >
      {phase === 'carregando' && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-400">
          <Loader2 className="size-4 animate-spin text-brand-600" /> Verificando…
        </div>
      )}

      {phase === 'pronto' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-emerald-900">Tudo certo! 🎉</p>
          <p className="mt-1 text-sm text-emerald-700">
            Seu e-mail foi confirmado. Preparando seu painel…
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-600">
            <Loader2 className="size-3.5 animate-spin" /> Redirecionando
          </div>
        </div>
      )}

      {phase === 'erro' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{lastError ?? errorDesc}</span>
          </div>
          {!isDemo() && emailParam && (
            <Button variant="secondary" className="w-full" onClick={resend} loading={resending} disabled={cooldown > 0}>
              <RefreshCw className="size-4" />
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar e-mail de confirmação'}
            </Button>
          )}
          <Link href="/auth/login" className="block">
            <Button className="w-full">Ir para o login</Button>
          </Link>
        </div>
      )}

      {phase === 'aguardando' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-5 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-full bg-white shadow-sm">
              <Mail className="size-5 text-sky-600" />
            </span>
            <p className="mt-3 text-sm font-medium text-sky-900">
              Enviamos um link de confirmação
              {emailParam ? (
                <>
                  {' '}para <strong>{emailParam}</strong>
                </>
              ) : (
                ' para o seu e-mail'
              )}
            </p>
            <p className="mt-1.5 text-xs text-sky-700">
              Clique no link dentro do e-mail para ativar sua conta. Confira também a caixa de spam/promoções.
            </p>
          </div>

          {!isDemo() && emailParam && (
            <Button variant="secondary" className="w-full" onClick={resend} loading={resending} disabled={cooldown > 0}>
              <RefreshCw className="size-4" />
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar e-mail'}
            </Button>
          )}

          <p className="text-center text-xs text-ink-400">
            Para evitar limites do provedor, o botão de reenvio só pode ser usado uma vez por minuto.
          </p>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs text-amber-800">
            Já confirmou?{' '}
            <Link href="/auth/login" className="font-semibold text-amber-900 underline">
              Fazer login
            </Link>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout title="Confirme seu e-mail">
          <div className="py-8 text-center text-sm text-ink-400">Carregando…</div>
        </AuthLayout>
      }
    >
      <ConfirmEmailContent />
    </Suspense>
  );
}

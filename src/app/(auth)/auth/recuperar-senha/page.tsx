'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/auth/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { db, isDemo } from '@/lib/db';
import { friendlyError } from '@/lib/utils';

/**
 * Recuperar senha — fluxo completo:
 * 1. Modo "pedir": informa o e-mail → Supabase envia link com ?code=
 * 2. Modo "nova senha": o link de recuperação volta PARA ESTA página com
 *    ?code=... → trocamos o código por sessão e exibimos o formulário de
 *    nova senha (antes, o link só voltava para o formulário de e-mail).
 * 3. Sucesso: senha alterada → volta para o login com aviso.
 */
function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<'carregando' | 'pedir' | 'nova-senha' | 'feito'>('carregando');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const code = searchParams.get('code');
  const errorParam = searchParams.get('error');
  const errorDesc = searchParams.get('error_description') ?? 'O link expirou ou já foi usado. Solicite um novo.';

  // Decide o modo inicial com base na URL (link de recuperação vem com ?code=)
  useEffect(() => {
    if (errorParam) {
      setNotice(errorDesc);
      setPhase('pedir');
      return;
    }
    if (code) {
      // Veio do e-mail de recuperação
      void (async () => {
        try {
          // Se já há sessão (código trocado antes), pula direto para nova senha
          const session = await db.getSession();
          if (session.userId) {
            setPhase('nova-senha');
            return;
          }
          await db.exchangeCodeForSession(code);
          setPhase('nova-senha');
        } catch (err) {
          setNotice(`Não foi possível validar o link: ${friendlyError(err)}`);
          setPhase('pedir');
        }
      })();
      return;
    }
    // Acesso normal (sem código) → mostrar formulário de e-mail
    setPhase('pedir');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, errorParam]);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Informe seu e-mail.');
      return;
    }
    setLoading(true);
    try {
      await db.resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      toast.error('As senhas não conferem.');
      return;
    }
    setLoading(true);
    try {
      await db.updatePassword(password);
      // Encerra a sessão de recuperação e volta para o login
      await db.signOut();
      router.replace('/auth/login?senha=ok');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------- UI
  const inner = (
    <>
      {phase === 'carregando' && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-400">
          <Loader2 className="size-4 animate-spin text-brand-600" /> Verificando o link…
        </div>
      )}

      {phase === 'pedir' && (
        <>
          {sent ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <span className="mx-auto grid size-10 place-items-center rounded-full bg-white shadow-sm">
                <Mail className="size-5 text-emerald-600" />
              </span>
              <p className="mt-3 text-sm font-semibold text-emerald-900">Verifique sua caixa de entrada 📩</p>
              <p className="mt-1.5 text-sm text-emerald-700">
                {isDemo()
                  ? 'No modo demonstração o e-mail não é enviado de verdade. Configure o Supabase para testar a recuperação completa.'
                  : 'Enviamos um link de recuperação. Clique nele para definir uma nova senha (confira também o spam).'}
              </p>
              {!isDemo() && (
                <button
                  onClick={() => setSent(false)}
                  className="mt-3 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Não recebeu? Enviar novamente
                </button>
              )}
            </div>
          ) : (
            <>
              {notice && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}
              <form onSubmit={requestReset} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail cadastrado</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="voce@empresa.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" loading={loading}>
                  Enviar link de recuperação
                </Button>
              </form>
            </>
          )}
        </>
      )}

      {phase === 'nova-senha' && (
        <form onSubmit={saveNewPassword} className="space-y-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="size-4 text-sky-600" /> Identidade confirmada!
            </span>
            <p className="mt-1 text-xs text-sky-700">Defina sua nova senha para continuar.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np">Nova senha</Label>
            <Input
              id="np"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="npc">Confirmar nova senha</Label>
            <Input
              id="npc"
              type="password"
              placeholder="Repita a nova senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Salvar nova senha
          </Button>
        </form>
      )}

      {phase === 'feito' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
          <p className="mt-2 text-sm font-semibold text-emerald-900">Senha alterada com sucesso!</p>
          <p className="mt-1 text-sm text-emerald-700">Entre com sua nova senha.</p>
        </div>
      )}
    </>
  );

  return (
    <AuthLayout
      title={phase === 'nova-senha' ? 'Definir nova senha' : 'Recuperar senha'}
      subtitle={
        phase === 'nova-senha'
          ? 'Sua identidade foi confirmada pelo link do e-mail.'
          : 'Enviaremos um link para você redefinir sua senha.'
      }
      footer={
        <Link href="/auth/login" className="font-medium text-brand-600 hover:text-brand-700">
          ← Voltar para o login
        </Link>
      }
    >
      {inner}
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthLayout title="Recuperar senha"><div className="py-8 text-center text-sm text-ink-400">Carregando…</div></AuthLayout>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
